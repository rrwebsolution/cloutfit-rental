"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, fail, isUuid, ok, parse, staffAction } from "@/lib/actions/helpers";
import {
  collectPaymentSchema,
  rescheduleBookingSchema,
  rescheduleFittingSchema,
} from "@/lib/validation";
import { ACTIVE_FITTING_STATUSES, BOOKING_STATUSES, BOOKING_STATUS_LABEL, PAYMENT_PROOF_BUCKET } from "@/lib/constants";
import { formatDate, formatDateRange, formatTime } from "@/lib/dates";
import {
  notifyBookingCancelled,
  notifyBookingChanged,
  notifyBookingConfirmed,
  notifyFittingUpdate,
  notifyPaymentCollected,
  notifyPaymentResult,
} from "@/lib/email/notify";
import type { ActionResult, Booking, BookingStatus, FittingAppointment, PaymentReceipt } from "@/lib/types";

// ---- Booking status -----------------------------------------------------------------

/**
 * Move a booking to any status. The database trigger records the change in
 * the timeline (with who and when) and refuses to re-activate a booking whose
 * dates have since been taken.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note = "",
): Promise<ActionResult> {
  return staffAction("bookings.manage", async ({ supabase }) => {
    if (!isUuid(bookingId) || !BOOKING_STATUSES.includes(status)) return fail("Invalid request.");
    const cleanNote = String(note ?? "").trim().slice(0, 300);

    const { data: current } = await supabase.from("bookings").select("status").eq("id", bookingId).maybeSingle();
    if (!current) return fail("Booking not found.");
    if (current.status === status) return fail(`This booking is already ${BOOKING_STATUS_LABEL[status]}.`);

    if (status === "cancelled") {
      await supabase.from("bookings").update({ cancel_reason: cleanNote }).eq("id", bookingId);
    }
    const { error } = await supabase.rpc("set_booking_status", {
      p_booking_id: bookingId,
      p_status: status,
      p_note: cleanNote,
    });
    if (error) return fail(dbError(error));

    if (status === "cancelled") {
      await supabase
        .from("fitting_appointments")
        .update({ status: "cancelled" })
        .eq("booking_id", bookingId)
        .in("status", ACTIVE_FITTING_STATUSES);
      notifyBookingCancelled(bookingId, "staff");
    } else if (status === "confirmed") {
      notifyBookingConfirmed(bookingId);
    }
    return ok(`Booking marked as ${BOOKING_STATUS_LABEL[status]}.`);
  });
}

export async function rescheduleBooking(input: unknown): Promise<ActionResult> {
  return staffAction("bookings.manage", async ({ supabase }) => {
    const parsed = parse(rescheduleBookingSchema, input);
    if (parsed.error) return parsed.error;
    const { booking_id, rental_start, rental_end } = parsed.data;

    const { data: before } = await supabase
      .from("bookings")
      .select("rental_start, rental_end")
      .eq("id", booking_id)
      .maybeSingle();
    if (!before) return fail("Booking not found.");
    if (before.rental_start === rental_start && before.rental_end === rental_end) {
      return fail("Those are already the booking's dates.");
    }

    // The bookings_guard trigger re-checks availability for the new dates.
    const { error } = await supabase
      .from("bookings")
      .update({ rental_start, rental_end })
      .eq("id", booking_id);
    if (error) {
      return error.message === "UNAVAILABLE"
        ? fail("Please check the highlighted fields.", { rental_start: dbError(error) })
        : fail(dbError(error));
    }

    notifyBookingChanged(
      booking_id,
      `The rental dates were changed from ${formatDateRange(before.rental_start, before.rental_end)} to ${formatDateRange(rental_start, rental_end)}.`,
    );
    return ok("Booking rescheduled.");
  });
}

export async function saveBookingNotes(bookingId: string, notes: string): Promise<ActionResult> {
  return staffAction("bookings.manage", async ({ supabase }) => {
    const { error } = await supabase
      .from("bookings")
      .update({ internal_notes: String(notes ?? "").trim().slice(0, 2000) })
      .eq("id", bookingId);
    if (error) return fail(dbError(error));
    return ok("Notes saved.");
  });
}

// ---- Payments ------------------------------------------------------------------------

/**
 * Verify a payment. The database function `verify_payment` does everything
 * in ONE transaction: marks the payment verified (who + when + notes), sets
 * the reservation fee to verified, moves the booking to Reserved and writes
 * the timeline entry. Uploading a screenshot never does any of this by itself.
 */
export async function verifyPayment(paymentId: string, notes = ""): Promise<ActionResult> {
  return staffAction("payments.verify", async ({ supabase }) => {
    if (!isUuid(paymentId)) return fail("Invalid request.");
    const { error } = await supabase.rpc("verify_payment", {
      p_payment_id: paymentId,
      p_notes: String(notes ?? "").trim().slice(0, 300),
    });
    if (error) return fail(paymentError(error));

    notifyPaymentResult(paymentId);
    return ok("Payment verified. The reservation is now secured.");
  });
}

export async function rejectPayment(paymentId: string, reason: string): Promise<ActionResult> {
  return staffAction("payments.verify", async ({ supabase }) => {
    if (!isUuid(paymentId)) return fail("Invalid request.");
    const { error } = await supabase.rpc("reject_payment", {
      p_payment_id: paymentId,
      p_reason: String(reason ?? "").trim().slice(0, 300),
    });
    if (error) return fail(paymentError(error));

    notifyPaymentResult(paymentId);
    return ok("Payment rejected. The customer has been asked to resubmit.");
  });
}

/** Messages raised by verify_payment / reject_payment carry their text in `details`. */
function paymentError(error: { message?: string; details?: string | null; code?: string }): string {
  const known = ["NOT_FOUND", "ALREADY_DONE", "REASON_REQUIRED", "INVALID", "INSUFFICIENT_CASH", "EXCEEDS_BALANCE"];
  if (error.message && known.includes(error.message) && error.details) return error.details;
  return dbError(error);
}

/**
 * Record a payment staff received directly: cash at the counter (with change)
 * or an online transfer they have already confirmed. The database function
 * `collect_payment` validates everything again and writes the transaction
 * atomically; `request_id` makes a repeated click return the same payment.
 */
export async function collectPayment(input: unknown): Promise<ActionResult<PaymentReceipt>> {
  return staffAction<PaymentReceipt>("payments.verify", async ({ supabase }) => {
    const parsed = parse(collectPaymentSchema, input);
    if (parsed.error) return parsed.error;
    const v = parsed.data;

    const { data, error } = await supabase.rpc("collect_payment", {
      p: {
        booking_id: v.booking_id,
        request_id: v.request_id,
        payment_type: v.payment_type,
        is_cash: v.is_cash,
        payment_method_id: v.is_cash ? "" : v.payment_method_id,
        method: v.is_cash ? "Cash" : v.method,
        amount: v.amount,
        cash_received: v.is_cash ? v.cash_received : "",
        reference_number: v.is_cash ? "" : v.reference_number,
        payment_date: v.payment_date,
        notes: v.notes,
      },
    });
    if (error || !data) {
      const message = paymentError(error ?? {});
      const field =
        error?.message === "INSUFFICIENT_CASH" ? "cash_received" : error?.message === "EXCEEDS_BALANCE" ? "amount" : null;
      return field ? fail(message, { [field]: message }) : fail(message);
    }

    const r = data as Record<string, unknown>;
    const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
    const receipt: PaymentReceipt = {
      payment_id: String(r.payment_id),
      duplicate: Boolean(r.duplicate),
      booking_reference: String(r.booking_reference),
      customer_name: String(r.customer_name),
      amount: Number(r.amount),
      cash_received: num(r.cash_received),
      change: num(r.change),
      method: String(r.method),
      payment_type: r.payment_type as PaymentReceipt["payment_type"],
      payment_date: String(r.payment_date),
      reference_number: String(r.reference_number ?? ""),
      total_due: Number(r.total_due),
      total_paid: Number(r.total_paid),
      balance: Number(r.balance),
      overpayment: Number(r.overpayment),
      payment_state: r.payment_state as PaymentReceipt["payment_state"],
    };
    // A repeated click returns the same payment; do not email the receipt twice.
    if (!receipt.duplicate) notifyPaymentCollected(receipt, v.booking_id);
    return ok("Payment recorded.", receipt);
  });
}

/** Mark a verified payment as refunded. It stays in the history but stops counting as paid. */
export async function refundPayment(paymentId: string, reason: string): Promise<ActionResult> {
  return staffAction("payments.verify", async ({ supabase }) => {
    if (!isUuid(paymentId)) return fail("Invalid request.");
    const { error } = await supabase.rpc("refund_payment", {
      p_payment_id: paymentId,
      p_reason: String(reason ?? "").trim().slice(0, 300),
    });
    if (error) return fail(paymentError(error));
    return ok("Payment marked as refunded.");
  });
}

/**
 * Short-lived signed URL for a proof of payment. The bucket is private; this
 * only runs for verified staff, and the link expires after two minutes.
 */
export async function getPaymentProofUrl(paymentId: string): Promise<ActionResult<{ url: string }>> {
  return staffAction<{ url: string }>("payments.verify", async ({ supabase }) => {
    // Read through RLS first, so only staff who can see the payment get a link.
    const { data: payment } = await supabase
      .from("payments")
      .select("proof_path")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment?.proof_path) return fail("No proof of payment was uploaded.");

    const { data, error } = await createAdminClient()
      .storage.from(PAYMENT_PROOF_BUCKET)
      .createSignedUrl(payment.proof_path, 120);
    if (error || !data) return fail("Could not open the proof of payment.");
    return ok("Ready.", { url: data.signedUrl });
  });
}

// ---- Fittings ------------------------------------------------------------------------

type FittingAction = "confirm" | "complete" | "cancel";

export async function updateFitting(fittingId: string, action: FittingAction): Promise<ActionResult> {
  return staffAction("fittings.manage", async ({ supabase }) => {
    const status = { confirm: "confirmed", complete: "completed", cancel: "cancelled" }[action];
    if (!status) return fail("Invalid request.");

    const { data } = await supabase.from("fitting_appointments").select("*").eq("id", fittingId).maybeSingle();
    const fitting = data as FittingAppointment | null;
    if (!fitting) return fail("Appointment not found.");
    if (fitting.status === status) return fail(`This appointment is already ${status}.`);

    const { error } = await supabase.from("fitting_appointments").update({ status }).eq("id", fittingId);
    if (error) return fail(dbError(error));

    // Keep the linked booking's status in step with its fitting.
    if (fitting.booking_id) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", fitting.booking_id)
        .maybeSingle();
      const bookingStatus = (booking as Pick<Booking, "status"> | null)?.status;
      if (action === "confirm" && bookingStatus === "reserved") {
        await supabase.rpc("set_booking_status", {
          p_booking_id: fitting.booking_id,
          p_status: "for_fitting",
          p_note: `Fitting confirmed for ${formatDate(fitting.appointment_date)}, ${formatTime(fitting.start_time)}.`,
        });
      }
    }

    if (action === "confirm") notifyFittingUpdate(fittingId, "confirmed");
    if (action === "cancel") notifyFittingUpdate(fittingId, "cancelled");
    return ok(`Appointment ${status}.`);
  });
}

export async function rescheduleFitting(input: unknown): Promise<ActionResult> {
  return staffAction("fittings.manage", async ({ supabase }) => {
    const parsed = parse(rescheduleFittingSchema, input);
    if (parsed.error) return parsed.error;
    const { fitting_id, fitting_date, fitting_time } = parsed.data;

    // Only offer real slots: opening hours, blocked days and capacity.
    const { data: slots, error: slotError } = await supabase.rpc("get_fitting_slots", {
      p_date: fitting_date,
      p_exclude: fitting_id,
    });
    if (slotError) return fail(dbError(slotError));
    const slot = ((slots ?? []) as { slot_time: string; remaining: number }[]).find(
      (s) => s.slot_time.slice(0, 5) === fitting_time,
    );
    if (!slot || slot.remaining < 1) {
      return fail("Please check the highlighted fields.", {
        fitting_time: "That slot is not available. Please choose another time.",
      });
    }

    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "fitting_duration_minutes")
      .maybeSingle();
    const duration = Math.max(5, Number(settings?.value) || 30);
    const [h, m] = fitting_time.split(":").map(Number);
    const endMinutes = Math.min(h * 60 + m + duration, 23 * 60 + 59);
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    const { error } = await supabase
      .from("fitting_appointments")
      .update({
        appointment_date: fitting_date,
        start_time: fitting_time,
        end_time: end,
        status: "rescheduled",
      })
      .eq("id", fitting_id);
    if (error) {
      return error.message === "SLOT_UNAVAILABLE"
        ? fail("Please check the highlighted fields.", { fitting_time: dbError(error) })
        : fail(dbError(error));
    }

    notifyFittingUpdate(fitting_id, "rescheduled");
    return ok("Appointment rescheduled.");
  });
}

export async function saveFittingNotes(fittingId: string, notes: string): Promise<ActionResult> {
  return staffAction("fittings.manage", async ({ supabase }) => {
    const { error } = await supabase
      .from("fitting_appointments")
      .update({ admin_notes: String(notes ?? "").trim().slice(0, 2000) })
      .eq("id", fittingId);
    if (error) return fail(dbError(error));
    return ok("Notes saved.");
  });
}

// ---- Customers -----------------------------------------------------------------------

export async function saveCustomerNotes(customerId: string, notes: string): Promise<ActionResult> {
  return staffAction("customers.manage", async ({ supabase }) => {
    const { error } = await supabase
      .from("customers")
      .update({ notes: String(notes ?? "").trim().slice(0, 2000) })
      .eq("id", customerId);
    if (error) return fail(dbError(error));
    return ok("Notes saved.");
  });
}
