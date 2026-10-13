import type { PaymentState, PaymentSummary } from "@/lib/types";

// Money helpers shared by the server and the browser. All arithmetic is done
// in whole centavos (integers) so there is never a floating-point surprise
// like 0.1 + 0.2. The database is the source of truth for every total; these
// are only used to format rows and to preview change while a cashier types.

/** "1,400.50" / 1400.5 → 140050. Returns null for anything that is not a valid amount. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "number" ? String(value) : value.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export const fromCents = (cents: number): number => cents / 100;

/** Change to give back, in centavos. Null when the cash does not cover the amount. */
export function changeDue(amountCents: number | null, cashCents: number | null): number | null {
  if (amountCents === null || cashCents === null || amountCents <= 0) return null;
  return cashCents >= amountCents ? cashCents - amountCents : null;
}

type SummaryRow = { [K in keyof PaymentSummary]: unknown };

/** Normalise a `booking_payment_summary` row (Postgres numerics arrive as strings or numbers). */
export function toPaymentSummary(row: SummaryRow): PaymentSummary {
  return {
    booking_id: String(row.booking_id),
    total_rental: Number(row.total_rental),
    reservation_fee: Number(row.reservation_fee),
    fee_deductible: Boolean(row.fee_deductible),
    total_due: Number(row.total_due),
    fee_paid: Number(row.fee_paid),
    other_paid: Number(row.other_paid),
    total_paid: Number(row.total_paid),
    balance: Number(row.balance),
    overpayment: Number(row.overpayment),
    pending_count: Number(row.pending_count),
    last_payment_at: (row.last_payment_at as string | null) ?? null,
    payment_state: row.payment_state as PaymentState,
  };
}

export const PAYMENT_SUMMARY_COLUMNS =
  "booking_id, total_rental, reservation_fee, fee_deductible, total_due, fee_paid, other_paid, total_paid, balance, overpayment, pending_count, last_payment_at, payment_state";
