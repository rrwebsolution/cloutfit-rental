"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { PaymentStateBadge } from "@/components/shared/status-badge";
import { collectPayment } from "@/lib/actions/bookings";
import { PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import { changeDue, fromCents, toCents } from "@/lib/payments";
import { cn } from "@/lib/utils";
import type { PaymentReceipt, PaymentSummary } from "@/lib/types";

type Kind = "auto" | "reservation_fee" | "deposit" | "other";
type ButtonProps = React.ComponentProps<typeof Button>;

const CASH = "cash";
const OTHER = "other";

/** Always two decimals here, so cashiers read exact centavos. */
const peso = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * "Collect Payment" for staff: cash (with live change calculation) or an
 * online payment already confirmed. The amounts shown are a preview only —
 * the server recalculates and validates everything before saving.
 */
export function CollectPaymentDialog({
  bookingId,
  reference,
  customerName,
  summary,
  feeOutstanding,
  methods,
  today,
  variant = "default",
  size = "md",
}: {
  bookingId: string;
  reference: string;
  customerName: string;
  summary: PaymentSummary;
  /** True when the reservation fee has not been verified yet. */
  feeOutstanding: boolean;
  /** Active online payment methods (id + label). Cash is always offered. */
  methods: { id: string; label: string }[];
  today: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [kind, setKind] = useState<Kind>("auto");
  const [method, setMethod] = useState(CASH);
  const [otherMethod, setOtherMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [cash, setCash] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultAmount = (k: Kind) =>
    k === "auto" ? (summary.balance > 0 ? summary.balance.toFixed(2) : "") : k === "reservation_fee" ? summary.reservation_fee.toFixed(2) : "";

  const start = () => {
    // A fresh id per attempt: the server treats a repeat of the same id as the
    // same payment, so a double click or a retry can never charge twice.
    setRequestId(crypto.randomUUID());
    setKind("auto");
    setMethod(CASH);
    setOtherMethod("");
    setAmount(defaultAmount("auto"));
    setCash("");
    setReferenceNumber("");
    setDate(today);
    setNotes("");
    setErrors({});
    setMessage("");
    setReceipt(null);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    if (receipt) router.refresh();
  };

  const isCash = method === CASH;
  const amountCents = toCents(amount);
  const cashCents = toCents(cash);
  const balanceCents = Math.round(summary.balance * 100);
  const change = isCash ? changeDue(amountCents, cashCents) : null;
  const paysRental = kind === "auto";

  // Live validation, mirrored (and enforced) by the database function.
  const amountProblem =
    amount === ""
      ? ""
      : amountCents === null || amountCents <= 0
        ? "Enter an amount greater than zero."
        : isCash && paysRental && amountCents > balanceCents
          ? `More than the remaining balance (${peso(summary.balance)}). Give the excess back as change.`
          : "";
  const cashProblem =
    isCash && cash !== ""
      ? cashCents === null
        ? "Enter a valid amount."
        : amountCents !== null && cashCents < amountCents
          ? "Insufficient cash received"
          : ""
      : "";
  const methodProblem = method === OTHER && otherMethod.trim().length < 2 && otherMethod !== "" ? "Enter the method used." : "";

  const ready =
    amountCents !== null &&
    amountCents > 0 &&
    !amountProblem &&
    (isCash ? cashCents !== null && cashCents >= amountCents : method !== OTHER || otherMethod.trim().length >= 2);

  const remainingAfter = paysRental && amountCents !== null ? Math.max(balanceCents - amountCents, 0) : balanceCents;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || pending) return;
    startTransition(async () => {
      const result = await collectPayment({
        booking_id: bookingId,
        request_id: requestId,
        payment_type: kind,
        is_cash: isCash,
        payment_method_id: !isCash && method !== OTHER ? method : "",
        method: method === OTHER ? otherMethod : "",
        amount: fromCents(amountCents!),
        cash_received: isCash ? fromCents(cashCents!) : undefined,
        reference_number: referenceNumber,
        payment_date: date,
        notes,
      });
      if (result.ok && result.data) {
        setReceipt(result.data);
        toast.success(result.data.duplicate ? "This payment was already recorded." : "Payment recorded.");
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={start}>
        <Banknote aria-hidden /> Collect Payment
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : pending ? undefined : close())}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-lg">
          {receipt ? (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Payment successful</DialogTitle>
                <DialogDescription className="sr-only">Summary of the payment that was just recorded.</DialogDescription>
              </DialogHeader>
              <PaymentReceiptView receipt={receipt} />
              <DialogFooter>
                <Button type="button" onClick={close}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={submit} className="grid gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>Collect Payment</DialogTitle>
                <DialogDescription>
                  {reference} · {customerName}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-3 gap-2 text-center">
                <Figure label="Total amount due" value={peso(summary.total_due)} />
                <Figure label="Previously paid" value={peso(summary.total_paid)} />
                <Figure label="Remaining balance" value={peso(summary.balance)} strong />
              </dl>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="cp-kind" label="Payment for" required>
                  <NativeSelect
                    className="w-full"
                    value={kind}
                    onChange={(e) => {
                      const next = e.target.value as Kind;
                      setKind(next);
                      setAmount(defaultAmount(next));
                    }}
                    {...fieldAria("cp-kind")}
                  >
                    <NativeSelectOption value="auto">Rental balance</NativeSelectOption>
                    {feeOutstanding ? <NativeSelectOption value="reservation_fee">Reservation fee</NativeSelectOption> : null}
                    <NativeSelectOption value="deposit">Security deposit (held separately)</NativeSelectOption>
                    <NativeSelectOption value="other">Other</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field id="cp-method" label="Payment method" required error={errors.method || methodProblem}>
                  <NativeSelect className="w-full" value={method} onChange={(e) => setMethod(e.target.value)} {...fieldAria("cp-method", errors.method)}>
                    <NativeSelectOption value={CASH}>Cash</NativeSelectOption>
                    {methods.map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>
                        {m.label}
                      </NativeSelectOption>
                    ))}
                    <NativeSelectOption value={OTHER}>Other online payment</NativeSelectOption>
                  </NativeSelect>
                </Field>
                {method === OTHER ? (
                  <Field id="cp-other" label="Which method?" required className="sm:col-span-2">
                    <Input value={otherMethod} onChange={(e) => setOtherMethod(e.target.value)} placeholder="e.g. Bank Transfer" maxLength={60} {...fieldAria("cp-other")} />
                  </Field>
                ) : null}

                <Field
                  id="cp-amount"
                  label={isCash ? "Amount to pay (₱)" : "Amount paid (₱)"}
                  required
                  error={errors.amount || amountProblem}
                >
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    {...fieldAria("cp-amount", errors.amount || amountProblem)}
                  />
                </Field>

                {isCash ? (
                  <Field id="cp-cash" label="Cash received (₱)" required error={errors.cash_received || cashProblem}>
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                      placeholder="0.00"
                      {...fieldAria("cp-cash", errors.cash_received || cashProblem)}
                    />
                  </Field>
                ) : (
                  <Field id="cp-ref" label="Reference number" error={errors.reference_number}>
                    <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} autoComplete="off" maxLength={60} {...fieldAria("cp-ref", errors.reference_number)} />
                  </Field>
                )}

                <Field id="cp-date" label="Payment date" required error={errors.payment_date}>
                  <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} {...fieldAria("cp-date", errors.payment_date)} />
                </Field>
                <Field id="cp-notes" label="Notes" error={errors.notes}>
                  <Textarea rows={1} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-10" {...fieldAria("cp-notes", errors.notes)} />
                </Field>
              </div>

              {/* Updates on every keystroke — there is no Calculate button. */}
              <div className="grid gap-2 rounded-xl border border-border bg-background/60 p-4" aria-live="polite">
                {isCash ? (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-foreground">Change</span>
                    {cashProblem === "Insufficient cash received" ? (
                      <span className="text-sm font-semibold text-destructive">Insufficient cash received</span>
                    ) : (
                      <span className={cn("font-heading text-3xl", change === null ? "text-muted-foreground/50" : "text-primary")}>
                        {change === null ? "₱—" : peso(fromCents(change))}
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Balance after this payment</span>
                  <span className="font-semibold text-foreground">
                    {peso(fromCents(remainingAfter))}
                    {paysRental && amountCents !== null && amountCents > 0 && remainingAfter === 0 ? " · Fully paid" : ""}
                  </span>
                </div>
                {!isCash && paysRental && amountCents !== null && amountCents > balanceCents ? (
                  <p className="text-xs text-warning">
                    This is {peso(fromCents(amountCents - balanceCents))} more than the balance and will show as an overpayment.
                  </p>
                ) : null}
                {!paysRental && kind !== "reservation_fee" ? (
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_TYPE_LABEL[kind === "deposit" ? "deposit" : "other"]} is recorded in the history but does not reduce the rental balance.
                  </p>
                ) : null}
              </div>

              <FormError message={Object.keys(errors).length === 0 ? message : ""} />

              <DialogFooter>
                <Button type="button" variant="outline" disabled={pending} onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!ready || pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {pending ? "Processing Payment..." : "Confirm Payment"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-2 py-2.5", strong ? "border-primary/30 bg-accent/50" : "border-border bg-background/60")}>
      <dt className="text-[0.65rem] leading-tight tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("mt-1 text-sm font-semibold sm:text-base", strong ? "text-primary" : "text-foreground")}>{value}</dd>
    </div>
  );
}

/**
 * Payment confirmation. Built from the receipt object the server returns, so
 * the same data can later feed a printable receipt or an emailed copy.
 */
export function PaymentReceiptView({ receipt }: { receipt: PaymentReceipt }) {
  const rows: [string, string][] = [
    ["Booking", receipt.booking_reference],
    ["Customer", receipt.customer_name],
    ["Payment", `${peso(receipt.amount)} · ${PAYMENT_TYPE_LABEL[receipt.payment_type]}`],
    ["Method", receipt.method],
    ...(receipt.reference_number ? ([["Reference number", receipt.reference_number]] as [string, string][]) : []),
    ...(receipt.cash_received !== null ? ([["Cash received", peso(receipt.cash_received)]] as [string, string][]) : []),
    ...(receipt.change !== null ? ([["Change", peso(receipt.change)]] as [string, string][]) : []),
    ["Payment date", formatDate(receipt.payment_date)],
    ["Total paid", `${peso(receipt.total_paid)} of ${peso(receipt.total_due)}`],
    ["Remaining balance", peso(receipt.balance)],
    ...(receipt.overpayment > 0 ? ([["Overpayment", peso(receipt.overpayment)]] as [string, string][]) : []),
  ];
  const fullyPaid = receipt.balance === 0 && (receipt.payment_state === "paid" || receipt.payment_state === "overpaid");

  return (
    <div role="status">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-heading text-2xl text-primary-dark">Payment Successful</p>
      </div>
      <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-background/60 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("text-right font-medium text-foreground", label === "Change" && "text-lg font-semibold text-primary")}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-center">
        {fullyPaid ? (
          <span className="rounded-full bg-success px-4 py-1.5 text-sm font-semibold tracking-[0.18em] text-white uppercase">Fully Paid</span>
        ) : (
          <PaymentStateBadge state={receipt.payment_state} />
        )}
      </div>
      <p className="sr-only">
        {formatPeso(receipt.amount)} recorded for {receipt.booking_reference}.
      </p>
    </div>
  );
}
