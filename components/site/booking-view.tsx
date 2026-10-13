import Link from "next/link";
import { CalendarDays, CalendarClock, CircleDollarSign, Ruler, Undo2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OutfitImage } from "@/components/shared/outfit-image";
import {
  BookingStatusBadge,
  FittingStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import { CancelBookingButton } from "@/components/site/cancel-booking-button";
import { PaymentForm } from "@/components/site/payment-form";
import type { PaymentInfo } from "@/components/site/payment-fields";
import { BOOKING_STATUS_HELP, CUSTOMER_CANCELLABLE, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import type { CustomerBookingView } from "@/lib/data/customer-booking";

/**
 * A customer's view of their booking: status, outfit, dates, fitting, fee,
 * and (when due) the payment form. Shared by the confirmation page and
 * Track Booking.
 */
export function BookingView({
  booking,
  payment,
  today,
}: {
  booking: CustomerBookingView;
  payment: PaymentInfo;
  today: string;
}) {
  const closed = ["cancelled", "completed", "returned"].includes(booking.status);
  const canPay =
    !closed && booking.reservation_fee > 0 && (booking.fee_status === "pending" || booking.fee_status === "rejected");
  const rejected = booking.payments.find((p) => p.status === "rejected");
  const canAddFitting =
    !closed && booking.status !== "rented" && (!booking.fitting || ["cancelled", "completed"].includes(booking.fitting.status));

  return (
    <div className="grid gap-6">
      <section className="surface-card p-5 sm:p-7" aria-label="Booking status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted-red uppercase">Booking reference</p>
            <p className="mt-1 font-heading text-3xl tracking-wide text-primary">{booking.reference}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="mt-4 text-sm text-foreground/80">{BOOKING_STATUS_HELP[booking.status]}</p>
        {booking.status === "cancelled" && booking.cancel_reason ? (
          <p className="mt-2 text-sm text-muted-foreground">Reason: {booking.cancel_reason}</p>
        ) : null}
      </section>

      <section className="surface-card p-5 sm:p-7" aria-label="Booking details">
        <ul className="grid gap-4">
          {booking.items.map((item) => (
            <li key={`${item.outfit_name}-${item.size}-${item.color}`} className="flex gap-4">
              <OutfitImage src={item.image_url} alt={item.outfit_name} sizes="80px" className="h-28 w-20 shrink-0 rounded-xl border border-border" />
              <div className="min-w-0">
                <p className="font-heading text-xl text-primary-dark">
                  {item.slug ? (
                    <Link href={`/outfits/${item.slug}`} className="hover:text-primary">
                      {item.outfit_name}
                    </Link>
                  ) : (
                    item.outfit_name
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Size {item.size} · {item.color}
                </p>
                <p className="mt-2 font-medium text-foreground">{formatPeso(item.rental_price)} rental</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <Detail icon={CalendarDays} label="Rental date" value={formatDate(booking.rental_start)} />
          <Detail icon={Undo2} label="Return date" value={formatDate(booking.rental_end)} />
          <Detail
            icon={Ruler}
            label="Fitting appointment"
            value={
              booking.fitting
                ? `${formatDate(booking.fitting.appointment_date)} – ${formatTime(booking.fitting.start_time)}`
                : "Not scheduled"
            }
            badge={booking.fitting ? <FittingStatusBadge status={booking.fitting.status} /> : null}
          />
          <Detail
            icon={CircleDollarSign}
            label="Reservation fee"
            value={formatPeso(booking.reservation_fee)}
            badge={<PaymentStatusBadge status={booking.fee_status} />}
          />
        </dl>

        {canAddFitting ? (
          <Link
            href={`/fitting?reference=${booking.reference}`}
            className={buttonVariants({ variant: "outline", size: "md", className: "mt-6 border-primary/40 text-primary" })}
          >
            <CalendarClock aria-hidden /> Schedule a Fitting
          </Link>
        ) : null}
      </section>

      {canPay ? (
        <section className="surface-card p-5 sm:p-7" aria-labelledby="pay-heading">
          <h2 id="pay-heading" className="font-heading text-2xl">
            {booking.fee_status === "rejected" ? "Resubmit your payment" : "Pay your reservation fee"}
          </h2>
          {booking.fee_status === "rejected" ? (
            <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              Your previous payment could not be verified
              {rejected?.rejection_reason ? `: ${rejected.rejection_reason}` : "."}
            </p>
          ) : null}
          <div className="mt-5">
            <PaymentForm reference={booking.reference} token={booking.access_token} info={payment} today={today} />
          </div>
        </section>
      ) : null}

      {booking.summary ? (
        <section className="surface-card p-5 sm:p-7" aria-labelledby="balance-heading">
          <h2 id="balance-heading" className="font-heading text-xl">
            Payment summary
          </h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["Total", booking.summary.total_due, "text-primary-dark"],
              ["Paid", booking.summary.total_paid, "text-success"],
              ["Balance", booking.summary.balance, "text-primary"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl border border-border bg-background/60 px-2 py-3">
                <dt className="text-[0.7rem] tracking-[0.18em] text-muted-red uppercase">{label}</dt>
                <dd className={`mt-1 font-heading text-xl ${tone}`}>{formatPeso(value as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            {booking.summary.balance === 0 && booking.summary.total_paid > 0
              ? "This booking is fully paid. Thank you!"
              : `The remaining ${formatPeso(booking.summary.balance)} is settled when you claim your outfit.`}{" "}
            {booking.reservation_fee > 0
              ? booking.summary.fee_deductible
                ? "Your reservation fee is deducted from the rental total."
                : "The reservation fee is a separate charge, not deducted from the rental."
              : ""}{" "}
            Payments count once we have verified them.
          </p>
        </section>
      ) : null}

      {booking.payments.length > 0 ? (
        <section className="surface-card p-5 sm:p-7" aria-labelledby="payments-heading">
          <h2 id="payments-heading" className="font-heading text-xl">
            Payments
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {booking.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {formatPeso(p.amount)} · {PAYMENT_TYPE_LABEL[p.payment_type]}
                  </p>
                  <p className="text-muted-foreground">
                    {p.method}
                    {p.reference_number ? ` · Ref ${p.reference_number}` : ""} · {formatDate(p.payment_date)}
                  </p>
                </div>
                <PaymentStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {CUSTOMER_CANCELLABLE.includes(booking.status) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">Plans changed? You can cancel this booking.</p>
          <CancelBookingButton reference={booking.reference} token={booking.access_token} />
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      </span>
      <div>
        <dt className="text-xs tracking-[0.16em] text-muted-red uppercase">{label}</dt>
        <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
        {badge ? <dd className="mt-1.5">{badge}</dd> : null}
      </div>
    </div>
  );
}
