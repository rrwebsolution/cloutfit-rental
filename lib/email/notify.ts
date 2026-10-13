import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, type EmailImage } from "@/lib/email/template";
import { settingsFromRows, type Settings } from "@/lib/settings";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import {
  ACTIVE_FITTING_STATUSES,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPE_LABEL,
} from "@/lib/constants";
import { SITE_URL } from "@/lib/site";
import type { Booking, BookingItem, FittingAppointment, Payment, PaymentReceipt } from "@/lib/types";

// Every notification the system sends, for both the shop (admin inbox) and the
// customer. Each function loads what it needs by id, so callers only say WHAT
// happened. All of them are safe to fire and forget.

type Row = [string, string];

type Context = {
  settings: Settings;
  adminEmail: string;
  footer: string;
};

async function loadContext(): Promise<Context> {
  const { data } = await createAdminClient().from("system_settings").select("key, value");
  const rows = (data ?? []) as { key: string; value: unknown }[];
  const settings = settingsFromRows(rows);
  const override = rows.find((r) => r.key === "notification_email")?.value;
  const adminEmail =
    (typeof override === "string" && override.trim()) || process.env.ADMIN_NOTIFICATION_EMAIL || "";
  const footer = [settings.business_name, settings.business_address, settings.business_mobile]
    .filter(Boolean)
    .join(" · ");
  return { settings, adminEmail, footer };
}

type BookingBundle = {
  booking: Booking;
  items: BookingItem[];
  fitting: FittingAppointment | null;
  /** Primary photo of the booked outfit, shown at the top of booking emails. */
  image: EmailImage | null;
};

async function loadBooking(bookingId: string): Promise<BookingBundle | null> {
  const supabase = createAdminClient();
  const [{ data: booking }, { data: items }, { data: fittings }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle(),
    supabase
      .from("booking_items")
      .select("*, outfit:outfits ( images:outfit_images ( url, alt, is_primary, sort_order ) )")
      .eq("booking_id", bookingId),
    supabase
      .from("fitting_appointments")
      .select("*")
      .eq("booking_id", bookingId)
      .in("status", ACTIVE_FITTING_STATUSES)
      .order("appointment_date")
      .limit(1),
  ]);
  if (!booking) return null;

  type ItemRow = BookingItem & {
    outfit: { images: { url: string; alt: string; is_primary: boolean; sort_order: number }[] } | null;
  };
  const itemRows = (items ?? []) as ItemRow[];
  // Outfit photos live in the public outfit-images bucket, so email clients
  // can load them directly by URL.
  const photo = itemRows
    .flatMap((item) =>
      [...(item.outfit?.images ?? [])]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
        .slice(0, 1)
        .map((image) => ({ url: image.url, alt: image.alt || item.outfit_name })),
    )
    .at(0);

  return {
    booking: booking as Booking,
    image: photo ?? null,
    items: itemRows,
    fitting: ((fittings ?? [])[0] as FittingAppointment | undefined) ?? null,
  };
}

const outfitLine = (items: BookingItem[]) =>
  items.map((i) => `${i.outfit_name} (${i.size}, ${i.color})`).join(", ") || "—";

const fittingLine = (f: FittingAppointment | null) =>
  f ? `${formatDate(f.appointment_date)} – ${formatTime(f.start_time)}` : "Not scheduled";

function bookingRows({ booking, items, fitting }: BookingBundle, withContact: boolean): Row[] {
  const rows: Row[] = [["Booking Reference", booking.reference]];
  if (withContact) {
    rows.push(
      ["Customer", booking.customer_name],
      ["Mobile", booking.customer_mobile],
      ["Email", booking.customer_email],
    );
  }
  rows.push(
    ["Outfit", outfitLine(items)],
    ["Rental Date", formatDate(booking.rental_start)],
    ["Return Date", formatDate(booking.rental_end)],
    ["Fitting Appointment", fittingLine(fitting)],
    ["Reservation Fee", formatPeso(booking.reservation_fee)],
    ["Payment Status", PAYMENT_STATUS_LABEL[booking.fee_status]],
  );
  return rows;
}

const adminBookingUrl = (id: string) => `${SITE_URL}/admin/bookings/${id}`;
const customerBookingUrl = (b: Booking) =>
  `${SITE_URL}/booking/${b.reference}?token=${b.access_token}`;

/** Run after the response is sent so emails never slow down or break a request. */
function background(task: () => Promise<void>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error("Notification failed:", error);
    }
  });
}

// ---- New reservation ---------------------------------------------------------

export function notifyNewReservation(bookingId: string) {
  background(async () => {
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
    if (!bundle) return;
    const { booking } = bundle;
    const name = ctx.settings.business_name;

    await Promise.all([
      sendEmail({
        to: ctx.adminEmail,
        template: "admin.new_reservation",
        bookingId,
        replyTo: booking.customer_email,
        subject: `New Cloutfit Reservation – ${booking.reference}`,
        html: renderEmail({
          businessName: name,
          footer: ctx.footer,
          image: bundle.image,
          preview: `${booking.customer_name} reserved ${outfitLine(bundle.items)}`,
          heading: "New Reservation Received",
          rows: [
            ...bookingRows(bundle, true),
            ...(booking.notes ? ([["Customer Notes", booking.notes]] as Row[]) : []),
          ],
          cta: { label: "View Booking", url: adminBookingUrl(booking.id) },
        }),
      }),
      sendEmail({
        to: booking.customer_email,
        template: "customer.reservation_received",
        bookingId,
        subject: `We received your reservation – ${booking.reference}`,
        html: renderEmail({
          businessName: name,
          footer: ctx.footer,
          image: bundle.image,
          preview: `Your booking reference is ${booking.reference}`,
          heading: "Your reservation is in",
          intro: [
            `Hi ${booking.customer_name},`,
            booking.reservation_fee > 0
              ? `Thank you for choosing ${name}. Your outfit is on hold. To secure it, please pay the ${formatPeso(booking.reservation_fee)} reservation fee and submit your proof of payment.`
              : `Thank you for choosing ${name}. We received your reservation and will confirm it shortly.`,
          ],
          rows: bookingRows(bundle, false),
          cta: { label: "View My Booking", url: customerBookingUrl(booking) },
          outro: ["Keep this email — the button above is your private link to this booking."],
        }),
      }),
    ]);
  });
}

// ---- Fitting -----------------------------------------------------------------

async function loadFitting(fittingId: string) {
  const supabase = createAdminClient();
  const { data: fitting } = await supabase
    .from("fitting_appointments")
    .select("*, customer:customers ( full_name, email, mobile ), outfit:outfits ( name )")
    .eq("id", fittingId)
    .maybeSingle();
  if (!fitting) return null;
  let booking: Booking | null = null;
  if (fitting.booking_id) {
    const { data } = await supabase.from("bookings").select("*").eq("id", fitting.booking_id).maybeSingle();
    booking = (data as Booking | null) ?? null;
  }
  return {
    fitting: fitting as FittingAppointment & {
      customer: { full_name: string; email: string; mobile: string } | null;
      outfit: { name: string } | null;
    },
    booking,
  };
}

/** A customer requested a stand-alone fitting (or added one to a booking). */
export function notifyFittingScheduled(fittingId: string) {
  background(async () => {
    const [ctx, data] = await Promise.all([loadContext(), loadFitting(fittingId)]);
    if (!data?.fitting.customer) return;
    const { fitting, booking } = data;
    const customer = fitting.customer!;
    const rows: Row[] = [
      ["Customer", customer.full_name],
      ["Mobile", customer.mobile],
      ["Email", customer.email],
      ["Fitting Date", formatDate(fitting.appointment_date)],
      ["Fitting Time", formatTime(fitting.start_time)],
      ["Outfit", fitting.outfit?.name ?? "Not specified"],
      ["Booking Reference", booking?.reference ?? "None yet"],
      ...(fitting.notes ? ([["Notes", fitting.notes]] as Row[]) : []),
    ];

    await Promise.all([
      sendEmail({
        to: ctx.adminEmail,
        template: "admin.fitting_scheduled",
        bookingId: booking?.id,
        replyTo: customer.email,
        subject: `New Fitting Appointment – ${formatDate(fitting.appointment_date)}, ${formatTime(fitting.start_time)}`,
        html: renderEmail({
          businessName: ctx.settings.business_name,
          footer: ctx.footer,
          preview: `${customer.full_name} requested a fitting`,
          heading: "New Fitting Appointment",
          rows,
          cta: { label: "View Fittings", url: `${SITE_URL}/admin/fittings` },
        }),
      }),
      sendEmail({
        to: customer.email,
        template: "customer.fitting_requested",
        bookingId: booking?.id,
        subject: `Fitting request received – ${formatDate(fitting.appointment_date)}`,
        html: renderEmail({
          businessName: ctx.settings.business_name,
          footer: ctx.footer,
          preview: "We received your fitting request",
          heading: "Your fitting request is in",
          intro: [
            `Hi ${customer.full_name},`,
            "We received your fitting appointment request. We will email you again once it is confirmed.",
          ],
          rows: rows.filter(([label]) => !["Customer", "Mobile", "Email", "Notes"].includes(label)),
          outro: ctx.settings.business_address ? [`Find us at: ${ctx.settings.business_address}`] : [],
        }),
      }),
    ]);
  });
}

/** Staff confirmed, rescheduled or cancelled a fitting. */
export function notifyFittingUpdate(fittingId: string, change: "confirmed" | "rescheduled" | "cancelled") {
  background(async () => {
    const [ctx, data] = await Promise.all([loadContext(), loadFitting(fittingId)]);
    if (!data?.fitting.customer) return;
    const { fitting, booking } = data;
    const customer = fitting.customer!;
    const copy = {
      confirmed: {
        subject: "Your fitting is confirmed",
        heading: "Your fitting is confirmed",
        line: "Your fitting appointment is confirmed. We look forward to seeing you!",
      },
      rescheduled: {
        subject: "Your fitting has been rescheduled",
        heading: "Your fitting has a new schedule",
        line: "Your fitting appointment has been moved. Here is your new schedule:",
      },
      cancelled: {
        subject: "Your fitting was cancelled",
        heading: "Your fitting was cancelled",
        line: "Your fitting appointment below has been cancelled. You can book a new one any time.",
      },
    }[change];

    await sendEmail({
      to: customer.email,
      template: `customer.fitting_${change}`,
      bookingId: booking?.id,
      subject: `${copy.subject} – ${formatDate(fitting.appointment_date)}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        preview: copy.subject,
        heading: copy.heading,
        intro: [`Hi ${customer.full_name},`, copy.line],
        rows: [
          ["Fitting Date", formatDate(fitting.appointment_date)],
          ["Fitting Time", formatTime(fitting.start_time)],
          ["Outfit", fitting.outfit?.name ?? "Not specified"],
          ...(booking ? ([["Booking Reference", booking.reference]] as Row[]) : []),
        ],
        cta:
          change === "cancelled"
            ? { label: "Book a Fitting", url: `${SITE_URL}/fitting` }
            : booking
              ? { label: "View My Booking", url: customerBookingUrl(booking) }
              : undefined,
        outro:
          change !== "cancelled" && ctx.settings.business_address
            ? [`Find us at: ${ctx.settings.business_address}`]
            : [],
      }),
    });
  });
}

// ---- Payments ----------------------------------------------------------------

async function loadPayment(paymentId: string) {
  const { data } = await createAdminClient().from("payments").select("*").eq("id", paymentId).maybeSingle();
  return (data as Payment | null) ?? null;
}

const paymentRows = (p: Payment): Row[] => [
  ["Payment Type", PAYMENT_TYPE_LABEL[p.payment_type]],
  ["Amount", formatPeso(p.amount)],
  ["Method", p.method],
  ["Reference Number", p.reference_number || "—"],
  ["Payment Date", formatDate(p.payment_date)],
];

/** Customer submitted the reservation fee / proof of payment. */
export function notifyPaymentSubmitted(paymentId: string) {
  background(async () => {
    const payment = await loadPayment(paymentId);
    if (!payment) return;
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(payment.booking_id)]);
    if (!bundle) return;
    const { booking } = bundle;

    await sendEmail({
      to: ctx.adminEmail,
      template: "admin.payment_submitted",
      bookingId: booking.id,
      replyTo: booking.customer_email,
      subject: `Reservation Payment Submitted – ${booking.reference}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        image: bundle.image,
        preview: `${booking.customer_name} submitted ${formatPeso(payment.amount)}`,
        heading: "Reservation Payment Submitted",
        intro: ["A customer submitted proof of payment. Please review and verify it."],
        rows: [
          ["Booking Reference", booking.reference],
          ["Customer", booking.customer_name],
          ["Mobile", booking.customer_mobile],
          ...paymentRows(payment),
          ["Proof of Payment", payment.proof_path ? "Attached to the booking" : "Not provided"],
        ],
        cta: { label: "Review Payment", url: adminBookingUrl(booking.id) },
      }),
    });
  });
}

/**
 * Staff collected a payment at the counter (cash or online). Emails the
 * customer a receipt with what was paid and what is still owed. The figures
 * come from the receipt the database returned, so they match what the cashier saw.
 */
export function notifyPaymentCollected(receipt: PaymentReceipt, bookingId: string) {
  background(async () => {
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
    if (!bundle) return;
    const { booking } = bundle;
    const exact = (amount: number) =>
      `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fullyPaid = receipt.balance === 0 && receipt.total_paid >= receipt.total_due;
    // Deposits and "other" payments do not pay down the rental, so say so.
    const countsTowardRental = !["deposit", "other"].includes(receipt.payment_type);

    await sendEmail({
      to: booking.customer_email,
      template: "customer.payment_received",
      bookingId,
      subject: `Payment received – ${booking.reference}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        image: bundle.image,
        preview: `We received ${exact(receipt.amount)}`,
        heading: fullyPaid ? "Payment received — fully paid" : "Payment received",
        intro: [
          `Hi ${booking.customer_name},`,
          fullyPaid
            ? `Thank you! We received your payment of ${exact(receipt.amount)} and your booking is now fully paid.`
            : `Thank you! We received your payment of ${exact(receipt.amount)}.`,
        ],
        rows: [
          ["Booking Reference", booking.reference],
          ["Outfit", outfitLine(bundle.items)],
          ["Payment", `${exact(receipt.amount)} · ${PAYMENT_TYPE_LABEL[receipt.payment_type]}`],
          ["Payment Method", receipt.method],
          ...(receipt.reference_number ? ([["Reference Number", receipt.reference_number]] as Row[]) : []),
          ...(receipt.cash_received !== null ? ([["Cash Received", exact(receipt.cash_received)]] as Row[]) : []),
          ...(receipt.change !== null ? ([["Change", exact(receipt.change)]] as Row[]) : []),
          ["Payment Date", formatDate(receipt.payment_date)],
          ["Total Amount", exact(receipt.total_due)],
          ["Total Paid", exact(receipt.total_paid)],
          ["Remaining Balance", fullyPaid ? "₱0.00 — Fully paid" : exact(receipt.balance)],
          ...(receipt.overpayment > 0 ? ([["Overpayment", exact(receipt.overpayment)]] as Row[]) : []),
        ],
        cta: { label: "View My Booking", url: customerBookingUrl(booking) },
        outro: countsTowardRental
          ? []
          : ["This payment is held separately and does not reduce your rental balance."],
      }),
    });
  });
}

/** Staff verified or rejected a payment. */
export function notifyPaymentResult(paymentId: string) {
  background(async () => {
    const payment = await loadPayment(paymentId);
    if (!payment || (payment.status !== "verified" && payment.status !== "rejected")) return;
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(payment.booking_id)]);
    if (!bundle) return;
    const { booking } = bundle;
    const verified = payment.status === "verified";
    const isFee = payment.payment_type === "reservation_fee";

    await sendEmail({
      to: booking.customer_email,
      template: verified ? "customer.payment_verified" : "customer.payment_rejected",
      bookingId: booking.id,
      subject: verified
        ? `${isFee ? "Reservation Confirmed" : "Payment verified"} – ${booking.reference}`
        : `Payment could not be verified – ${booking.reference}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        image: bundle.image,
        preview: verified ? (isFee ? "Your reservation is secured" : "Your payment is verified") : "We could not verify your payment",
        heading: verified ? (isFee ? "Your reservation is confirmed" : "Payment verified") : "We could not verify your payment",
        intro: [
          `Hi ${booking.customer_name},`,
          verified
            ? payment.payment_type === "reservation_fee"
              ? "We verified your reservation fee. Your outfit and dates are now secured — your reservation is confirmed."
              : "We verified your payment. Thank you!"
            : "We were unable to verify the payment below. Please review the details and submit it again.",
        ],
        rows: [
          ["Booking Reference", booking.reference],
          ...paymentRows(payment),
          ...(!verified && payment.rejection_reason
            ? ([["Reason", payment.rejection_reason]] as Row[])
            : []),
        ],
        cta: {
          label: verified ? "View My Booking" : "Resubmit Payment",
          url: customerBookingUrl(booking),
        },
      }),
    });
  });
}

// ---- Status & changes ---------------------------------------------------------

/** Customer email when staff confirm a reservation. */
export function notifyBookingConfirmed(bookingId: string) {
  background(async () => {
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
    if (!bundle) return;
    const { booking } = bundle;
    await sendEmail({
      to: booking.customer_email,
      template: "customer.reservation_confirmed",
      bookingId,
      subject: `Reservation confirmed – ${booking.reference}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        image: bundle.image,
        preview: "Your reservation is confirmed",
        heading: "Your reservation is confirmed",
        intro: [
          `Hi ${booking.customer_name},`,
          `Good news — your reservation is ${BOOKING_STATUS_LABEL[booking.status].toLowerCase()}. Here are your details:`,
        ],
        rows: bookingRows(bundle, false),
        cta: { label: "View My Booking", url: customerBookingUrl(booking) },
        outro: ["Please bring a valid ID when you claim your outfit."],
      }),
    });
  });
}

/** Booking cancelled, either by the customer or by staff. */
export function notifyBookingCancelled(bookingId: string, by: "customer" | "staff") {
  background(async () => {
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
    if (!bundle) return;
    const { booking } = bundle;
    const reason: Row[] = booking.cancel_reason ? [["Reason", booking.cancel_reason]] : [];
    const tasks = [
      sendEmail({
        to: booking.customer_email,
        template: "customer.booking_cancelled",
        bookingId,
        subject: `Booking cancelled – ${booking.reference}`,
        html: renderEmail({
          businessName: ctx.settings.business_name,
          footer: ctx.footer,
          image: bundle.image,
          preview: "Your booking was cancelled",
          heading: "Your booking was cancelled",
          intro: [
            `Hi ${booking.customer_name},`,
            by === "customer"
              ? "As requested, your booking below has been cancelled."
              : "Your booking below has been cancelled. Please contact us if you have any questions.",
          ],
          rows: [
            ["Booking Reference", booking.reference],
            ["Outfit", outfitLine(bundle.items)],
            ["Rental Date", formatDate(booking.rental_start)],
            ["Return Date", formatDate(booking.rental_end)],
            ...reason,
          ],
          cta: { label: "Browse Collection", url: `${SITE_URL}/catalogue` },
        }),
      }),
    ];
    if (by === "customer") {
      tasks.push(
        sendEmail({
          to: ctx.adminEmail,
          template: "admin.booking_cancelled",
          bookingId,
          replyTo: booking.customer_email,
          subject: `Booking Cancelled – ${booking.reference}`,
          html: renderEmail({
            businessName: ctx.settings.business_name,
            footer: ctx.footer,
            image: bundle.image,
            preview: `${booking.customer_name} cancelled ${booking.reference}`,
            heading: "Booking Cancelled by Customer",
            intro: ["The outfit and dates below are available again."],
            rows: [...bookingRows(bundle, true), ...reason],
            cta: { label: "View Booking", url: adminBookingUrl(booking.id) },
          }),
        }),
      );
    }
    await Promise.all(tasks);
  });
}

/** Important details changed (e.g. rental dates). Tells both sides. */
export function notifyBookingChanged(bookingId: string, summary: string) {
  background(async () => {
    const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
    if (!bundle) return;
    const { booking } = bundle;
    await Promise.all([
      sendEmail({
        to: ctx.adminEmail,
        template: "admin.booking_changed",
        bookingId,
        subject: `Booking Updated – ${booking.reference}`,
        html: renderEmail({
          businessName: ctx.settings.business_name,
          footer: ctx.footer,
          image: bundle.image,
          preview: summary,
          heading: "Booking Details Changed",
          intro: [summary],
          rows: bookingRows(bundle, true),
          cta: { label: "View Booking", url: adminBookingUrl(booking.id) },
        }),
      }),
      sendEmail({
        to: booking.customer_email,
        template: "customer.booking_changed",
        bookingId,
        subject: `Your booking was updated – ${booking.reference}`,
        html: renderEmail({
          businessName: ctx.settings.business_name,
          footer: ctx.footer,
          image: bundle.image,
          preview: summary,
          heading: "Your booking was updated",
          intro: [`Hi ${booking.customer_name},`, summary, "Here are your current details:"],
          rows: bookingRows(bundle, false),
          cta: { label: "View My Booking", url: customerBookingUrl(booking) },
        }),
      }),
    ]);
  });
}

/** Contact form → shop inbox. */
export function notifyContactMessage(input: { full_name: string; email: string; message: string }) {
  background(async () => {
    const ctx = await loadContext();
    await sendEmail({
      to: ctx.adminEmail,
      template: "admin.contact_message",
      replyTo: input.email,
      subject: `Website message from ${input.full_name}`,
      html: renderEmail({
        businessName: ctx.settings.business_name,
        footer: ctx.footer,
        preview: input.message.slice(0, 90),
        heading: "New Website Message",
        rows: [
          ["From", input.full_name],
          ["Email", input.email],
        ],
        outro: input.message.split(/\n+/).filter(Boolean),
      }),
    });
  });
}

/**
 * Rental reminder. Awaited (not backgrounded) because the cron job needs to
 * know whether it was sent before stamping `reminder_sent_at`.
 */
export async function sendRentalReminder(bookingId: string): Promise<boolean> {
  const [ctx, bundle] = await Promise.all([loadContext(), loadBooking(bookingId)]);
  if (!bundle) return false;
  const { booking } = bundle;
  return sendEmail({
    to: booking.customer_email,
    template: "customer.rental_reminder",
    bookingId,
    subject: `Reminder: your rental is on ${formatDate(booking.rental_start)}`,
    html: renderEmail({
      businessName: ctx.settings.business_name,
      footer: ctx.footer,
      image: bundle.image,
      preview: `Your rental starts ${formatDate(booking.rental_start)}`,
      heading: "Your rental is coming up",
      intro: [
        `Hi ${booking.customer_name},`,
        "This is a friendly reminder about your upcoming rental. We can't wait to see you in your outfit!",
      ],
      rows: bookingRows(bundle, false),
      cta: { label: "View My Booking", url: customerBookingUrl(booking) },
      outro: [
        "Please bring a valid ID when you claim your outfit.",
        ...(ctx.settings.business_address ? [`Find us at: ${ctx.settings.business_address}`] : []),
      ],
    }),
  });
}
