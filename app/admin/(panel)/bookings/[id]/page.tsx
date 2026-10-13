import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Mail, MapPin, Phone } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import {
  ProofButton,
  RescheduleBookingDialog,
  UpdateStatusDialog,
} from "@/components/admin/booking-dialogs";
import { CollectPaymentDialog } from "@/components/admin/collect-payment-dialog";
import { FittingActions } from "@/components/admin/fitting-actions";
import { PaymentBreakdown, PaymentTotals, pesoExact } from "@/components/admin/payment-summary";
import { NotesForm } from "@/components/admin/notes-form";
import { PageHeader, Panel, PanelEmpty } from "@/components/admin/page-header";
import {
  BookingStatusBadge,
  FittingStatusBadge,
  PaymentStatusBadge,
  ToneBadge,
} from "@/components/shared/status-badge";
import {
  refundPayment,
  rejectPayment,
  saveBookingNotes,
  saveFittingNotes,
  updateBookingStatus,
  verifyPayment,
} from "@/lib/actions/bookings";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPaymentMethods } from "@/lib/data/payment-methods";
import { getSettings } from "@/lib/settings";
import { isUuid } from "@/lib/actions/helpers";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { addDays, diffDays, formatDate, formatDateTime, formatTime, shopToday } from "@/lib/dates";
import { formatPeso, paymentMethodLabel } from "@/lib/format";
import { PAYMENT_SUMMARY_COLUMNS, toPaymentSummary } from "@/lib/payments";
import type {
  Booking,
  BookingItem,
  EmailStatusRow,
  FittingAppointment,
  Payment,
  StatusHistoryEntry,
} from "@/lib/types";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: bookingRow }, { data: items }, { data: fittings }, { data: payments }, { data: history }, { data: emails }, { data: summaryRow }, settings, paymentMethods] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
      supabase.from("booking_items").select("*").eq("booking_id", id),
      supabase.from("fitting_appointments").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*, verifier:profiles ( full_name )")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("booking_status_history")
        .select("*, actor:profiles ( full_name )")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("email_logs")
        .select("id, recipient, subject, status, error, created_at")
        .eq("booking_id", id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("booking_payment_summary").select(PAYMENT_SUMMARY_COLUMNS).eq("booking_id", id).maybeSingle(),
      getSettings(),
      getPaymentMethods(),
    ]);

  const booking = bookingRow as Booking | null;
  if (!booking) notFound();

  const today = shopToday();
  const maxDate = addDays(today, settings.booking_window_days);
  const itemRows = (items ?? []) as BookingItem[];
  const fittingRows = (fittings ?? []) as FittingAppointment[];
  const paymentRows = (payments ?? []) as (Payment & { verifier: { full_name: string } | null })[];
  const historyRows = (history ?? []) as (StatusHistoryEntry & { actor: { full_name: string } | null })[];
  const emailRows = (emails ?? []) as EmailStatusRow[];
  // Totals come from the database view (verified payments only), never from
  // adding things up in the browser.
  const summary = summaryRow ? toPaymentSummary(summaryRow) : null;
  const feeOutstanding = Number(booking.reservation_fee) > 0 && booking.fee_status !== "verified";
  const overdue = booking.status === "rented" && booking.rental_end < today;
  const s = booking.status;
  const bind = updateBookingStatus.bind(null, booking.id);

  return (
    <>
      <PageHeader
        title={booking.reference}
        description={`Created ${formatDateTime(booking.created_at)}`}
        back={{ href: "/admin/bookings", label: "All bookings" }}
      >
        <BookingStatusBadge status={s} />
        {overdue ? <ToneBadge tone="danger">{diffDays(booking.rental_end, today)} days overdue</ToneBadge> : null}
      </PageHeader>

      {/* Primary actions for the current stage */}
      <div className="surface-card mb-6 flex flex-wrap items-center gap-2 p-4">
        {["pending", "reserved", "for_fitting"].includes(s) ? (
          <ActionButton action={bind.bind(null, "confirmed")} variant="default">
            <Check aria-hidden /> Confirm Booking
          </ActionButton>
        ) : null}
        {s === "confirmed" ? (
          <ActionButton
            action={bind.bind(null, "rented")}
            variant="default"
            confirm={{
              title: "Mark as rented?",
              description: "Do this when the customer has claimed the outfit.",
              confirmLabel: "Mark as Rented",
            }}
          >
            Mark as Rented
          </ActionButton>
        ) : null}
        {s === "rented" ? (
          <ActionButton
            action={bind.bind(null, "returned")}
            variant="default"
            confirm={{
              title: "Mark as returned?",
              description: "The outfit becomes available for other dates again.",
              confirmLabel: "Mark as Returned",
            }}
          >
            Mark as Returned
          </ActionButton>
        ) : null}
        {s === "returned" ? (
          <ActionButton action={bind.bind(null, "completed")} variant="default">
            Complete Booking
          </ActionButton>
        ) : null}
        {!["cancelled", "completed", "returned"].includes(s) ? (
          <RescheduleBookingDialog bookingId={booking.id} rentalStart={booking.rental_start} rentalEnd={booking.rental_end} />
        ) : null}
        <UpdateStatusDialog bookingId={booking.id} current={s} />
        {["pending", "awaiting_payment", "payment_submitted"].includes(s) ? (
          <ActionButton
            action={bind.bind(null, "cancelled")}
            variant="destructive"
            reason={{ label: "Reason (shared with the customer)", required: true }}
            confirm={{
              title: "Reject this booking?",
              description: "The booking is cancelled, its dates are released, and the customer is emailed.",
              confirmLabel: "Reject Booking",
              destructive: true,
            }}
          >
            Reject
          </ActionButton>
        ) : !["cancelled", "completed", "returned"].includes(s) ? (
          <ActionButton
            action={bind.bind(null, "cancelled")}
            variant="destructive"
            reason={{ label: "Reason (shared with the customer)", required: true }}
            confirm={{
              title: "Cancel this booking?",
              description: "Its dates are released and the customer is emailed.",
              confirmLabel: "Cancel Booking",
              destructive: true,
            }}
          >
            Cancel Booking
          </ActionButton>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Rental">
            <ul className="divide-y divide-border">
              {itemRows.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                  <div>
                    <Link href={`/admin/outfits/${item.outfit_id}`} className="font-medium text-foreground hover:text-primary">
                      {item.outfit_name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Size {item.size} · {item.color}
                    </p>
                  </div>
                  <p className="font-medium">{formatPeso(item.rental_price)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
              <Info label="Rental date" value={formatDate(booking.rental_start)} />
              <Info label="Return date" value={formatDate(booking.rental_end)} />
              <Info label="Days" value={String(diffDays(booking.rental_start, booking.rental_end) + 1)} />
              <Info label="Rental total" value={formatPeso(booking.total_rental)} />
            </dl>
            {booking.notes ? (
              <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                <span className="font-medium">Customer notes: </span>
                {booking.notes}
              </p>
            ) : null}
            {s === "cancelled" && booking.cancel_reason ? (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <span className="font-medium">Cancellation reason: </span>
                {booking.cancel_reason}
              </p>
            ) : null}
          </Panel>

          <Panel title="Payment summary">
            {summary ? (
              <>
                <PaymentTotals summary={summary} />
                <div className="mt-5 grid gap-5 border-t border-border pt-5 md:grid-cols-[1fr_auto] md:items-start">
                  <PaymentBreakdown summary={summary} className="max-w-md" />
                  {s !== "cancelled" ? (
                    <CollectPaymentDialog
                      bookingId={booking.id}
                      reference={booking.reference}
                      customerName={booking.customer_name}
                      summary={summary}
                      feeOutstanding={feeOutstanding}
                      methods={paymentMethods.map((m) => ({ id: m.id, label: paymentMethodLabel(m) }))}
                      today={today}
                      size="xl"
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <PanelEmpty>Payment summary is unavailable.</PanelEmpty>
            )}
          </Panel>

          <Panel title="Payment history">
            {paymentRows.length === 0 ? (
              <PanelEmpty>No payments yet.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {paymentRows.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-sm">
                      <p className="text-xs tracking-[0.14em] text-muted-red uppercase">{formatDate(p.payment_date)}</p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {PAYMENT_TYPE_LABEL[p.payment_type]} · <span className="tabular-nums">{pesoExact(Number(p.amount))}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {p.method}
                        {p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                      </p>
                      {p.cash_received !== null ? (
                        <p className="text-xs text-muted-foreground">
                          Cash received {pesoExact(Number(p.cash_received))} · change {pesoExact(Number(p.change_amount ?? 0))}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {p.verified_at
                          ? `${p.status === "rejected" ? "Rejected" : p.status === "refunded" ? "Refunded" : p.proof_path ? "Verified" : "Processed"} by ${p.verifier?.full_name || "staff"} · ${formatDateTime(p.verified_at)}`
                          : `Submitted ${formatDateTime(p.created_at)}`}
                      </p>
                      {p.rejection_reason ? <p className="mt-1 text-xs text-destructive">Reason: {p.rejection_reason}</p> : null}
                      {p.verification_notes ? <p className="mt-1 text-xs text-muted-foreground">{p.verification_notes}</p> : null}
                      {p.notes ? <p className="mt-1 text-xs text-muted-foreground">Note: {p.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <PaymentStatusBadge status={p.status} />
                      {p.proof_path ? <ProofButton paymentId={p.id} /> : null}
                      {p.status === "submitted" || p.status === "pending" ? (
                        <>
                          <ActionButton
                            action={verifyPayment.bind(null, p.id)}
                            size="sm"
                            variant="default"
                            reason={{ label: "Verification notes (optional)", placeholder: "e.g. Matched against the GCash statement." }}
                            confirm={{
                              title: "Verify this payment?",
                              description:
                                "Only verify after you have confirmed the money was received. The reservation is then secured and the customer is emailed.",
                              confirmLabel: "Verify Payment",
                            }}
                          >
                            Verify
                          </ActionButton>
                          <ActionButton
                            action={rejectPayment.bind(null, p.id)}
                            size="sm"
                            variant="destructive"
                            reason={{ label: "Reason (shared with the customer)", required: true, placeholder: "e.g. Reference number does not match." }}
                            confirm={{
                              title: "Reject this payment?",
                              description: "The customer is emailed and asked to submit their payment again.",
                              confirmLabel: "Reject Payment",
                              destructive: true,
                            }}
                          >
                            Reject
                          </ActionButton>
                        </>
                      ) : null}
                      {p.status === "verified" ? (
                        <ActionButton
                          action={refundPayment.bind(null, p.id)}
                          size="sm"
                          reason={{ label: "Reason for the refund", required: true, placeholder: "e.g. Overpayment returned in cash." }}
                          confirm={{
                            title: "Mark this payment as refunded?",
                            description:
                              "Do this after the money has been returned. The payment stays in the history but no longer counts toward the amount paid.",
                            confirmLabel: "Mark as Refunded",
                            destructive: true,
                          }}
                        >
                          Refund
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Fitting appointments">
            {fittingRows.length === 0 ? (
              <PanelEmpty>No fitting scheduled for this booking.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {fittingRows.map((f) => (
                  <li key={f.id} className="grid gap-3 py-4 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-medium text-foreground">
                          {formatDate(f.appointment_date)} – {formatTime(f.start_time)}
                        </p>
                        {f.notes ? <p className="text-muted-foreground">Customer: {f.notes}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FittingStatusBadge status={f.status} />
                        <FittingActions fittingId={f.id} status={f.status} today={today} maxDate={maxDate} />
                      </div>
                    </div>
                    <NotesForm action={saveFittingNotes.bind(null, f.id)} initial={f.admin_notes} label="Fitting notes" placeholder="Measurements, alterations, remarks…" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Customer" action={{ href: `/admin/customers/${booking.customer_id}`, label: "View record" }}>
            <p className="font-heading text-xl text-primary-dark">{booking.customer_name}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-primary" aria-hidden />
                <a href={`tel:${booking.customer_mobile}`} className="hover:text-primary">
                  {booking.customer_mobile}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-primary" aria-hidden />
                <a href={`mailto:${booking.customer_email}`} className="break-all hover:text-primary">
                  {booking.customer_email}
                </a>
              </li>
              {booking.customer_address ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {booking.customer_address}
                </li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Internal notes">
            <NotesForm action={saveBookingNotes.bind(null, booking.id)} initial={booking.internal_notes} />
          </Panel>

          <Panel title="Status timeline">
            <ol className="relative space-y-5 border-l border-border pl-5">
              {historyRows.map((h, i) => (
                <li key={h.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute top-1 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "bg-border"}`}
                  />
                  <ToneBadge tone={BOOKING_STATUS_TONE[h.to_status]}>{BOOKING_STATUS_LABEL[h.to_status]}</ToneBadge>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatDateTime(h.created_at)} · {h.actor?.full_name || (h.changed_by ? "Staff" : "Customer / system")}
                    {h.from_status ? ` · from ${BOOKING_STATUS_LABEL[h.from_status]}` : ""}
                  </p>
                  {h.note ? <p className="mt-1 text-sm text-foreground/80">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Email log">
            {emailRows.length === 0 ? (
              <PanelEmpty>No emails recorded for this booking.</PanelEmpty>
            ) : (
              <ul className="space-y-3 text-sm">
                {emailRows.map((e) => (
                  <li key={e.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{e.subject}</p>
                      <ToneBadge tone={e.status === "sent" ? "success" : e.status === "failed" ? "danger" : "muted"}>
                        {e.status}
                      </ToneBadge>
                    </div>
                    <p className="text-xs break-all text-muted-foreground">
                      To {e.recipient || "—"} · {formatDateTime(e.created_at)}
                    </p>
                    {e.error ? <p className="text-xs text-destructive">{e.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-[0.14em] text-muted-red uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
      {badge ? <dd className="mt-1">{badge}</dd> : null}
    </div>
  );
}
