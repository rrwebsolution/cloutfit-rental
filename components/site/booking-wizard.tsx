"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvailabilityCalendar, type DateRange } from "@/components/shared/availability-calendar";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { OutfitImage } from "@/components/shared/outfit-image";
import { FittingSlotPicker } from "@/components/site/fitting-slot-picker";
import {
  defaultMethodId,
  PaymentFields,
  PaymentInstructions,
  type PaymentInfo,
} from "@/components/site/payment-fields";
import { useAvailability } from "@/components/site/use-availability";
import { VariantPicker } from "@/components/site/variant-picker";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import { checkVariantAvailable, createBooking, submitPayment } from "@/lib/actions/public";
import { customerSchema, fieldErrors } from "@/lib/validation";
import { MAX_PROOF_BYTES, validateImageFile } from "@/lib/uploads";
import { diffDays, formatDate, formatDateRange, formatTime } from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailabilityRange, PublicOutfit } from "@/lib/types";

const STEPS = ["Outfit", "Schedule", "Your Details", "Fitting", "Reservation Fee", "Confirmation"];

type Customer = { full_name: string; email: string; mobile: string; address: string; notes: string };
type Check = "idle" | "checking" | "available" | "unavailable";

export function BookingWizard({
  outfit,
  initialVariantId,
  initialRange,
  initialRanges,
  today,
  loadedTo,
  maxDate,
  maxRentalDays,
  payment,
}: {
  outfit: PublicOutfit;
  initialVariantId: string | null;
  initialRange: DateRange;
  initialRanges: AvailabilityRange[];
  today: string;
  loadedTo: string;
  maxDate: string;
  maxRentalDays: number;
  payment: PaymentInfo;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(initialVariantId ?? outfit.variants[0]?.id ?? null);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [check, setCheck] = useState<Check>("idle");
  const [customer, setCustomer] = useState<Customer>({ full_name: "", email: "", mobile: "", address: "", notes: "" });
  const [fitting, setFitting] = useState({ date: "", time: "" });
  const [skipFitting, setSkipFitting] = useState(false);
  const [payNow, setPayNow] = useState(payment.fee > 0);
  const [methodId, setMethodId] = useState(() => defaultMethodId(payment.methods));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, startSubmit] = useTransition();
  const paymentForm = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const variant = outfit.variants.find((v) => v.id === variantId) ?? null;
  const variants = useMemo(() => (variant ? [variant] : []), [variant]);
  const { month, setMonth, statuses, loading, isRangeFree } = useAvailability({
    outfit,
    variants,
    initialRanges,
    loadedFrom: today,
    loadedTo,
    initialMonth: (initialRange.from ?? today).slice(0, 7),
  });

  // Step 2: confirm the chosen dates with the server as soon as they are set.
  useEffect(() => {
    if (!variantId || !range.from || !range.to) return;
    let cancelled = false;
    const { from, to } = range;
    (async () => {
      setCheck("checking");
      const ok = await checkVariantAvailable(variantId, from, to);
      if (!cancelled) setCheck(ok ? "available" : "unavailable");
    })();
    return () => {
      cancelled = true;
    };
  }, [variantId, range]);

  const goTo = (next: number) => {
    setErrors({});
    setFormError("");
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const selectDate = (date: string) => {
    setFormError("");
    setCheck("idle");
    setFitting({ date: "", time: "" });
    if (!range.from || range.to || date < range.from) {
      setRange({ from: date, to: null });
      return;
    }
    if (diffDays(range.from, date) + 1 > maxRentalDays) {
      toast.error(`Rentals are limited to ${maxRentalDays} days.`);
      return;
    }
    if (!isRangeFree(range.from, date)) {
      toast.error("Those dates include a day that is already booked.");
      setRange({ from: date, to: null });
      return;
    }
    setRange({ from: range.from, to: date });
  };

  const next = () => {
    if (step === 0) {
      if (!variant) return setFormError("Please choose a size and color.");
      return goTo(1);
    }
    if (step === 1) {
      if (!range.from || !range.to) return setFormError("Please choose your rental and return dates.");
      if (check === "checking") return setFormError("Still checking availability — one moment.");
      if (check !== "available") return setFormError("Those dates are not available. Please choose different dates.");
      return goTo(2);
    }
    if (step === 2) {
      const parsed = customerSchema.safeParse(customer);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return setFormError("Please check the highlighted fields.");
      }
      return goTo(3);
    }
    if (step === 3) {
      if (!skipFitting && (!fitting.date || !fitting.time)) {
        return setFormError("Choose a fitting date and time, or skip the fitting for now.");
      }
      return goTo(4);
    }
  };

  const confirm = () => {
    if (!variant || !range.from || !range.to) return;
    setErrors({});
    setFormError("");

    // Validate the payment before creating the booking, so a typo here does
    // not leave the customer with a booking and no payment attached.
    let paymentData: FormData | null = null;
    if (payNow && paymentForm.current) {
      paymentData = new FormData(paymentForm.current);
      const problems: Record<string, string> = {};
      if (String(paymentData.get("reference_number") ?? "").trim().length < 4) {
        problems.reference_number = "Enter the payment reference number.";
      }
      if (!paymentData.get("payment_method_id") && String(paymentData.get("method") ?? "").trim().length < 2) {
        problems.method = "Enter the payment method you used.";
      }
      if (!(Number(paymentData.get("amount")) > 0)) problems.amount = "Enter the amount paid.";
      if (!paymentData.get("payment_date")) problems.payment_date = "Enter the payment date.";
      const file = paymentData.get("proof");
      if (!(file instanceof File) || file.size === 0) {
        problems.proof = "Attach a screenshot or photo of your receipt.";
      } else {
        const fileProblem = validateImageFile(file, MAX_PROOF_BYTES);
        if (fileProblem) problems.proof = fileProblem;
      }
      if (Object.keys(problems).length > 0) {
        setErrors(problems);
        return setFormError("Please complete your payment details, or choose to pay later.");
      }
    }

    startSubmit(async () => {
      const result = await createBooking({
        ...customer,
        variant_id: variant.id,
        rental_start: range.from,
        rental_end: range.to,
        fitting_date: skipFitting ? "" : fitting.date,
        fitting_time: skipFitting ? "" : fitting.time,
      });

      if (!result.ok || !result.data) {
        setFormError(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.message);
        return;
      }

      const { reference, token } = result.data;
      if (paymentData) {
        paymentData.set("reference", reference);
        paymentData.set("token", token);
        const paid = await submitPayment({ ok: false, message: "" }, paymentData);
        if (!paid.ok) {
          toast.warning(`Your reservation is saved, but the payment was not: ${paid.message}`, { duration: 9000 });
        }
      }
      toast.success(`Reservation ${reference} created.`);
      startNavigationProgress();
      router.push(`/booking/${reference}?token=${token}&new=1`);
    });
  };

  const set = (key: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCustomer((c) => ({ ...c, [key]: e.target.value }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        {/* Stepper */}
        <ol className="mb-8 flex items-center" aria-label="Booking progress">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary bg-surface text-primary ring-4 ring-primary/15",
                  i > step && "border-border bg-surface text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
                <span className="sr-only">
                  {label}
                  {i < step ? " (completed)" : ""}
                </span>
              </span>
              {i < STEPS.length - 1 ? (
                <span aria-hidden className={cn("mx-1.5 h-px flex-1 sm:mx-2.5", i < step ? "bg-primary" : "bg-border")} />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="surface-card p-5 sm:p-8">
          <p className="eyebrow">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 ref={heading} tabIndex={-1} className="mt-2 font-heading text-2xl outline-none sm:text-3xl">
            {
              [
                "Your selected outfit",
                "Rental schedule",
                "Your information",
                "Fitting appointment",
                "Reservation fee",
              ][step]
            }
          </h2>

          <div className="mt-6">
            {step === 0 ? (
              <div className="grid gap-6 sm:grid-cols-[11rem_1fr]">
                <OutfitImage
                  src={outfit.images[0]?.url}
                  alt={outfit.name}
                  sizes="176px"
                  className="aspect-[3/4] w-full max-w-44 rounded-2xl border border-border"
                />
                <div className="grid content-start gap-5">
                  <div>
                    <p className="text-xs tracking-[0.2em] text-muted-red uppercase">{outfit.category?.name ?? "Collection"}</p>
                    <p className="mt-1 font-heading text-2xl text-primary-dark">{outfit.name}</p>
                    <p className="mt-1">
                      <span className="text-xl font-semibold text-primary">{formatPeso(outfit.rental_price)}</span>
                      <span className="text-sm text-muted-foreground"> / rental</span>
                    </p>
                  </div>
                  <VariantPicker
                    variants={outfit.variants}
                    selectedId={variantId}
                    onSelect={(v) => {
                      setFormError("");
                      setVariantId(v.id);
                      setRange({ from: null, to: null });
                      setCheck("idle");
                    }}
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-5">
                <p className="text-sm text-muted-foreground">
                  Tap your <strong className="text-foreground">rental date</strong>, then your{" "}
                  <strong className="text-foreground">return date</strong>. Rentals run up to {maxRentalDays} days.
                </p>
                <div className="max-w-md">
                  <AvailabilityCalendar
                    month={month}
                    onMonthChange={setMonth}
                    statuses={statuses}
                    today={today}
                    minMonth={today.slice(0, 7)}
                    maxMonth={maxDate.slice(0, 7)}
                    range={range}
                    onSelect={selectDate}
                    loading={loading}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateBox label="Rental date" value={range.from} />
                  <DateBox label="Return date" value={range.to} />
                </div>
                <div aria-live="polite" className="min-h-6 text-sm">
                  {check === "checking" ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
                    </p>
                  ) : check === "available" ? (
                    <p className="flex items-center gap-2 font-medium text-success">
                      <CheckCircle2 className="size-4" aria-hidden /> Available for your dates
                    </p>
                  ) : check === "unavailable" ? (
                    <p className="flex items-center gap-2 font-medium text-destructive">
                      <XCircle className="size-4" aria-hidden /> Not available for those dates — please choose others
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="bk-name" label="Full name" required error={errors.full_name} className="sm:col-span-2">
                  <Input value={customer.full_name} onChange={set("full_name")} autoComplete="name" {...fieldAria("bk-name", errors.full_name)} />
                </Field>
                <Field id="bk-email" label="Email" required error={errors.email} hint="Your confirmation is sent here.">
                  <Input type="email" value={customer.email} onChange={set("email")} autoComplete="email" {...fieldAria("bk-email", errors.email, "hint")} />
                </Field>
                <Field id="bk-mobile" label="Mobile number" required error={errors.mobile}>
                  <Input type="tel" inputMode="tel" value={customer.mobile} onChange={set("mobile")} autoComplete="tel" placeholder="0917 123 4567" {...fieldAria("bk-mobile", errors.mobile)} />
                </Field>
                <Field id="bk-address" label="Address" required error={errors.address} className="sm:col-span-2">
                  <Input value={customer.address} onChange={set("address")} autoComplete="street-address" {...fieldAria("bk-address", errors.address)} />
                </Field>
                <Field id="bk-notes" label="Notes / special requests" error={errors.notes} className="sm:col-span-2">
                  <Textarea value={customer.notes} onChange={set("notes")} rows={3} placeholder="Event type, alterations, anything we should know…" {...fieldAria("bk-notes", errors.notes)} />
                </Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-5">
                <p className="text-sm text-muted-foreground">
                  Try the outfit on before your event. Fittings are scheduled on or before your rental date
                  {range.from ? ` (${formatDate(range.from)})` : ""}.
                </p>
                {!skipFitting ? (
                  <FittingSlotPicker
                    date={fitting.date}
                    time={fitting.time}
                    onChange={setFitting}
                    minDate={today}
                    maxDate={range.from ?? maxDate}
                    error={errors.fitting_time}
                  />
                ) : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={skipFitting}
                    onChange={(e) => setSkipFitting(e.target.checked)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="font-medium text-foreground">Skip for now</span>
                    <span className="block text-muted-foreground">I&apos;ll book a fitting later from the Book a Fitting page.</span>
                  </span>
                </label>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-6">
                {payment.fee > 0 ? (
                  <>
                    <PaymentInstructions info={payment} selectedId={methodId} onSelect={setMethodId} />
                    <fieldset className="grid gap-2 sm:grid-cols-2">
                      <legend className="sr-only">When would you like to pay?</legend>
                      {[
                        { value: true, title: "I've paid — submit proof now", text: "Fastest way to secure your outfit." },
                        { value: false, title: "Pay later", text: "Submit proof from your booking page." },
                      ].map((option) => (
                        <label
                          key={String(option.value)}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors",
                            payNow === option.value ? "border-primary bg-accent/50" : "border-border bg-surface hover:border-primary/40",
                          )}
                        >
                          <input
                            type="radio"
                            name="pay-when"
                            checked={payNow === option.value}
                            onChange={() => setPayNow(option.value)}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <span>
                            <span className="font-medium text-foreground">{option.title}</span>
                            <span className="block text-muted-foreground">{option.text}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {payNow ? (
                      <form ref={paymentForm} onSubmit={(e) => e.preventDefault()} noValidate>
                        <PaymentFields info={payment} methodId={methodId} today={today} errors={errors} />
                      </form>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border bg-surface/60 p-4 text-sm text-muted-foreground">
                        Your outfit will be held as <strong className="text-foreground">Awaiting Payment</strong>.
                        Unpaid reservations may be released, so please pay soon.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                    No reservation fee is required right now. Confirm to place your reservation.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <FormError message={formError} />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" size="xl" disabled={step === 0 || submitting} onClick={() => goTo(step - 1)}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            {step < 4 ? (
              <Button type="button" size="xl" onClick={next}>
                Continue <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button type="button" size="xl" disabled={submitting} onClick={confirm}>
                {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {submitting ? "Processing Reservation..." : "Confirm Reservation"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Running summary */}
      <aside aria-label="Reservation summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="surface-card p-5">
          <p className="eyebrow">Summary</p>
          <div className="mt-4 flex gap-3">
            <OutfitImage src={outfit.images[0]?.url} alt="" sizes="64px" className="size-16 shrink-0 rounded-xl border border-border" />
            <div className="min-w-0">
              <p className="font-heading text-lg leading-tight text-primary-dark">{outfit.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {variant ? `${variant.size} · ${variant.color}` : "Choose size & color"}
              </p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <SummaryRow label="Rental dates" value={range.from && range.to ? formatDateRange(range.from, range.to) : "—"} />
            <SummaryRow
              label="Fitting"
              value={
                skipFitting
                  ? "Skipped for now"
                  : fitting.date && fitting.time
                    ? `${formatDate(fitting.date)}, ${formatTime(fitting.time)}`
                    : "—"
              }
            />
            <SummaryRow label="Rental price" value={formatPeso(outfit.rental_price)} />
            <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <dt className="font-medium text-foreground">Reservation fee due now</dt>
              <dd className="font-heading text-xl text-primary">{formatPeso(payment.fee)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The rental price is settled when you claim your outfit.
          </p>
        </div>
      </aside>
    </div>
  );
}

function DateBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs tracking-[0.16em] text-muted-red uppercase">{label}</p>
      <p className={cn("mt-1 font-medium", value ? "text-foreground" : "text-muted-foreground")}>
        {value ? formatDate(value) : "Not selected"}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
