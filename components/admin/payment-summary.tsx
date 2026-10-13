import { CheckCircle2, CircleAlert } from "lucide-react";
import { PaymentStateBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/types";

/** Two decimals always: staff read exact amounts here. */
export const pesoExact = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * TOTAL / PAID / BALANCE at a glance, plus a FULLY PAID or BALANCE DUE banner.
 * Every figure comes from the database's `booking_payment_summary` view, which
 * counts verified payments only.
 */
export function PaymentTotals({ summary }: { summary: PaymentSummary }) {
  const fullyPaid = summary.balance === 0 && summary.total_paid >= summary.total_due;
  return (
    <div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Total label="Total" value={pesoExact(summary.total_due)} />
        <Total label="Paid" value={pesoExact(summary.total_paid)} tone="paid" />
        <Total label="Balance" value={pesoExact(summary.balance)} tone={fullyPaid ? "paid" : "due"} />
      </dl>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          fullyPaid ? "border-success/30 bg-success/10 text-success" : "border-primary/25 bg-accent/60 text-primary-dark",
        )}
      >
        <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.14em] uppercase">
          {fullyPaid ? <CheckCircle2 className="size-5" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
          {fullyPaid ? "Fully Paid" : `Balance Due: ${pesoExact(summary.balance)}`}
        </p>
        <PaymentStateBadge state={summary.payment_state} />
      </div>

      {summary.overpayment > 0 ? (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="font-semibold">Overpayment: {pesoExact(summary.overpayment)}.</span> The customer has paid more than
          the total due. Refund the excess, or mark the extra payment as refunded once it is returned.
        </p>
      ) : null}
      {summary.pending_count > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {summary.pending_count} payment{summary.pending_count === 1 ? " is" : "s are"} waiting for verification and{" "}
          {summary.pending_count === 1 ? "is" : "are"} not counted yet.
        </p>
      ) : null}
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: "paid" | "due" }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-4 py-4 text-center">
      <dt className="text-xs font-semibold tracking-[0.22em] text-muted-red uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-heading text-2xl sm:text-3xl",
          tone === "paid" ? "text-success" : tone === "due" ? "text-primary" : "text-primary-dark",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The line-by-line "Payment Summary" breakdown. */
export function PaymentBreakdown({ summary, className }: { summary: PaymentSummary; className?: string }) {
  const rows: [string, number][] = [
    ["Total Rental Amount", summary.total_rental],
    ...(!summary.fee_deductible && summary.reservation_fee > 0
      ? ([["Reservation Fee (separate charge)", summary.reservation_fee]] as [string, number][])
      : []),
  ];
  return (
    <dl className={cn("text-sm", className)}>
      {rows.map(([label, value]) => (
        <Line key={label} label={label} value={pesoExact(value)} />
      ))}
      {rows.length > 1 ? <Line label="Total Amount Due" value={pesoExact(summary.total_due)} bold /> : null}
      <div className="my-2 border-t border-dashed border-border" />
      <Line label="Reservation Fee Paid" value={pesoExact(summary.fee_paid)} />
      <Line label="Other Payments" value={pesoExact(summary.other_paid)} />
      <div className="my-2 border-t border-border" />
      <Line label="Total Paid" value={pesoExact(summary.total_paid)} bold />
      <Line label="Remaining Balance" value={pesoExact(summary.balance)} bold accent />
      {summary.overpayment > 0 ? <Line label="Overpayment" value={pesoExact(summary.overpayment)} bold /> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {summary.reservation_fee === 0
          ? "No reservation fee on this booking."
          : summary.fee_deductible
            ? "The reservation fee is deducted from the rental total."
            : "The reservation fee is a separate charge, not deducted from the rental."}{" "}
        Only verified payments are counted.
      </p>
    </dl>
  );
}

function Line({ label, value, bold = false, accent = false }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className={cn(bold ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("tabular-nums", bold ? "font-semibold" : "font-medium", accent ? "text-primary" : "text-foreground")}>{value}</dd>
    </div>
  );
}
