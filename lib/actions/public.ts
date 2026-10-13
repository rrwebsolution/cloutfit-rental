"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAvailability, getFittingSlots } from "@/lib/data/catalogue";
import { findBookingByToken } from "@/lib/data/customer-booking";
import {
  bookingSchema,
  contactSchema,
  fieldErrors,
  fittingRequestSchema,
  paymentSchema,
  trackSchema,
} from "@/lib/validation";
import { extensionFor, MAX_PROOF_BYTES, sniffImageType, validateImageFile } from "@/lib/uploads";
import { addDays, isISODate, shopToday } from "@/lib/dates";
import { normalizeMobile, paymentMethodLabel } from "@/lib/format";
import { CUSTOMER_CANCELLABLE, PAYMENT_PROOF_BUCKET } from "@/lib/constants";
import {
  notifyBookingCancelled,
  notifyContactMessage,
  notifyFittingScheduled,
  notifyNewReservation,
  notifyPaymentSubmitted,
} from "@/lib/email/notify";
import type { ActionResult, AvailabilityRange, Booking, FittingSlot } from "@/lib/types";

// Server Actions used by the public site. Customers are not signed in, so
// these validate everything, then act with the service-role client. The
// database functions make the final, race-safe decisions.

const NOT_CONFIGURED: ActionResult<never> = {
  ok: false,
  message: "The booking system is not connected yet. Please try again later.",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turn an error raised by our SQL functions into a customer-facing message. */
function dbMessage(error: { message?: string; details?: string | null } | null): string {
  const known = ["UNAVAILABLE", "OUTFIT_UNAVAILABLE", "INVALID_DATES", "INVALID_FITTING", "SLOT_UNAVAILABLE", "NOT_FOUND"];
  if (error?.message && known.includes(error.message) && error.details) return error.details;
  console.error("Database error:", error);
  return "Something went wrong on our side. Please try again.";
}

// ---- Availability (read-only helpers for the calendar UI) ---------------------

export async function fetchAvailability(
  outfitId: string,
  from: string,
  to: string,
): Promise<AvailabilityRange[]> {
  if (!UUID.test(outfitId) || !isISODate(from) || !isISODate(to) || to < from) return [];
  // Cap the window so the endpoint cannot be used to dump years of data.
  const cappedTo = to > addDays(from, 100) ? addDays(from, 100) : to;
  return getAvailability(from, cappedTo, outfitId);
}

export async function checkVariantAvailable(
  variantId: string,
  from: string,
  to: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (!UUID.test(variantId) || !isISODate(from) || !isISODate(to) || to < from) return false;
  const { data, error } = await createAdminClient().rpc("is_variant_available", {
    p_variant: variantId,
    p_start: from,
    p_end: to,
  });
  return !error && data === true;
}

export async function fetchFittingSlots(date: string): Promise<FittingSlot[]> {
  if (!isISODate(date)) return [];
  return getFittingSlots(date);
}

// ---- Create booking ----------------------------------------------------------

export async function createBooking(
  input: unknown,
): Promise<ActionResult<{ reference: string; token: string }>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { data, error } = await createAdminClient().rpc("create_booking", { p: parsed.data });
  if (error || !data) return { ok: false, message: dbMessage(error) };

  const result = data as { id: string; reference: string; access_token: string };
  notifyNewReservation(result.id);

  return {
    ok: true,
    message: "Reservation created.",
    data: { reference: result.reference, token: result.access_token },
  };
}

// ---- Reservation fee / proof of payment ---------------------------------------

export async function submitPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const parsed = paymentSchema.safeParse({
    reference: formData.get("reference"),
    token: formData.get("token"),
    payment_method_id: formData.get("payment_method_id") ?? "",
    method: formData.get("method") ?? "",
    reference_number: formData.get("reference_number"),
    amount: formData.get("amount"),
    payment_date: formData.get("payment_date"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const input = parsed.data;

  if (input.payment_date > shopToday()) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: { payment_date: "Payment date cannot be in the future." },
    };
  }

  const booking = await findBookingByToken(input.reference, input.token);
  if (!booking) return { ok: false, message: "We could not find that booking." };
  if (["cancelled", "completed", "returned"].includes(booking.status)) {
    return { ok: false, message: "This booking is closed and no longer accepts payments." };
  }
  if (booking.fee_status === "verified") {
    return { ok: false, message: "Your reservation fee is already verified." };
  }
  if (booking.fee_status === "submitted") {
    return { ok: false, message: "We already have your payment and are verifying it." };
  }

  // Resolve the payment method on the server. The browser only sends an id;
  // the name recorded on the payment comes from the database, and the method
  // must still be active.
  let methodId: string | null = null;
  let methodLabel = input.method;
  if (input.payment_method_id) {
    const { data: method } = await createAdminClient()
      .from("payment_methods")
      .select("id, name, provider")
      .eq("id", input.payment_method_id)
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle();
    if (!method) {
      const message = "That payment method is no longer available. Please choose another.";
      return { ok: false, message, fieldErrors: { payment_method_id: message } };
    }
    methodId = method.id as string;
    methodLabel = paymentMethodLabel(method as { name: string; provider: string });
  } else {
    const { count } = await createAdminClient()
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if ((count ?? 0) > 0) {
      const message = "Please choose a payment method.";
      return { ok: false, message, fieldErrors: { payment_method_id: message } };
    }
    if (methodLabel.length < 2) {
      const message = "Enter the payment method you used.";
      return { ok: false, message, fieldErrors: { method: message } };
    }
  }

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Please attach your proof of payment.",
      fieldErrors: { proof: "Attach a screenshot or photo of your receipt." },
    };
  }
  const fileError = validateImageFile(file, MAX_PROOF_BYTES);
  if (fileError) return { ok: false, message: fileError, fieldErrors: { proof: fileError } };

  // Never trust the declared MIME type: check the actual bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const realType = sniffImageType(bytes);
  if (!realType) {
    const message = "That file is not a valid JPG, PNG or WebP image.";
    return { ok: false, message, fieldErrors: { proof: message } };
  }

  const supabase = createAdminClient();
  // Server-generated path: the customer's filename is never used.
  const path = `${booking.id}/${randomUUID()}.${extensionFor(realType)}`;
  const upload = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(path, bytes, { contentType: realType, upsert: false });
  if (upload.error) {
    console.error("Proof upload failed:", upload.error.message);
    return { ok: false, message: "We could not upload your proof of payment. Please try again." };
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      booking_id: booking.id,
      customer_id: booking.customer_id,
      amount: input.amount,
      payment_type: "reservation_fee",
      payment_method_id: methodId,
      method: methodLabel,
      reference_number: input.reference_number,
      proof_path: path,
      payment_date: input.payment_date,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !payment) {
    await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
    console.error("Payment insert failed:", error?.message);
    return { ok: false, message: "We could not record your payment. Please try again." };
  }

  await supabase.from("bookings").update({ fee_status: "submitted" }).eq("id", booking.id);
  if (booking.status === "pending" || booking.status === "awaiting_payment") {
    await supabase.rpc("set_booking_status", {
      p_booking_id: booking.id,
      p_status: "payment_submitted",
      p_note: "Customer submitted the reservation fee.",
    });
  }

  notifyPaymentSubmitted(payment.id);
  return { ok: true, message: "Payment submitted. We will verify it shortly." };
}

// ---- Customer cancellation -----------------------------------------------------

export async function cancelBooking(
  reference: string,
  token: string,
  reason: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const booking = await findBookingByToken(String(reference), String(token));
  if (!booking) return { ok: false, message: "We could not find that booking." };
  if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
    return {
      ok: false,
      message: "This booking can no longer be cancelled online. Please contact us.",
    };
  }

  const supabase = createAdminClient();
  const cleanReason = String(reason ?? "").trim().slice(0, 300);
  await supabase.from("bookings").update({ cancel_reason: cleanReason }).eq("id", booking.id);
  const { error } = await supabase.rpc("set_booking_status", {
    p_booking_id: booking.id,
    p_status: "cancelled",
    p_note: cleanReason ? `Cancelled by customer: ${cleanReason}` : "Cancelled by customer.",
  });
  if (error) return { ok: false, message: dbMessage(error) };

  await supabase
    .from("fitting_appointments")
    .update({ status: "cancelled" })
    .eq("booking_id", booking.id)
    .in("status", ["pending", "confirmed", "rescheduled"]);

  notifyBookingCancelled(booking.id, "customer");
  return { ok: true, message: "Your booking has been cancelled." };
}

// ---- Track booking -------------------------------------------------------------

export type TrackResult = ActionResult<{ reference: string; token: string }>;

export async function trackBooking(_prev: TrackResult, formData: FormData): Promise<TrackResult> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const parsed = trackSchema.safeParse({
    reference: formData.get("reference"),
    contact: formData.get("contact"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  // One generic message for every failure, so the form cannot be used to
  // discover which references exist.
  const notFound: TrackResult = {
    ok: false,
    message: "We could not find a booking matching those details. Please check and try again.",
  };

  const { data } = await createAdminClient()
    .from("bookings")
    .select("reference, access_token, customer_email, customer_mobile")
    .eq("reference", parsed.data.reference)
    .maybeSingle();
  if (!data) return notFound;

  const row = data as Pick<Booking, "reference" | "access_token" | "customer_email" | "customer_mobile">;
  const contact = parsed.data.contact;
  const emailMatches = contact.toLowerCase() === row.customer_email.toLowerCase();
  const digits = normalizeMobile(contact);
  const mobileMatches = digits.length >= 10 && digits === normalizeMobile(row.customer_mobile);
  if (!emailMatches && !mobileMatches) return notFound;

  return {
    ok: true,
    message: "Booking found.",
    data: { reference: row.reference, token: row.access_token },
  };
}

// ---- Stand-alone fitting request -------------------------------------------------

export async function requestFitting(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const parsed = fittingRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  const v = parsed.data;
  const supabase = createAdminClient();

  let bookingId = "";
  if (v.booking_reference) {
    const { data } = await supabase
      .from("bookings")
      .select("id, customer_email, status")
      .eq("reference", v.booking_reference)
      .maybeSingle();
    // Only attach to a booking the requester demonstrably owns.
    if (!data || data.customer_email !== v.email || ["cancelled", "completed", "returned"].includes(data.status)) {
      return {
        ok: false,
        message: "Please check the highlighted fields.",
        fieldErrors: {
          booking_reference: "We could not match that reference to your email. Leave it blank to continue.",
        },
      };
    }
    bookingId = data.id;
  }

  const { data, error } = await supabase.rpc("book_fitting", {
    p: {
      fitting_date: v.fitting_date,
      fitting_time: v.fitting_time,
      booking_id: bookingId,
      outfit_id: v.outfit_id,
      full_name: v.full_name,
      email: v.email,
      mobile: v.mobile,
      address: "",
      notes: v.notes,
    },
  });
  if (error || !data) return { ok: false, message: dbMessage(error) };

  notifyFittingScheduled((data as { id: string }).id);
  return { ok: true, message: "Fitting request received." };
}

// ---- Contact form -----------------------------------------------------------------

export async function sendContactMessage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  // Honeypot: real visitors never fill this hidden field.
  if (String(formData.get("website") ?? "").trim() !== "") {
    return { ok: true, message: "Thank you! We will get back to you soon." };
  }
  const parsed = contactSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  notifyContactMessage(parsed.data);
  return { ok: true, message: "Thank you! We will get back to you soon." };
}
