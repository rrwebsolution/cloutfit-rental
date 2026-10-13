"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { FittingSlotPicker } from "@/components/site/fitting-slot-picker";
import { requestFitting } from "@/lib/actions/public";
import { fieldErrors, fittingRequestSchema } from "@/lib/validation";
import { formatDate, formatTime } from "@/lib/dates";

type Form = {
  full_name: string;
  email: string;
  mobile: string;
  booking_reference: string;
  outfit_id: string;
  notes: string;
};

export function FittingForm({
  outfits,
  today,
  maxDate,
  initialOutfitId,
  initialReference,
}: {
  outfits: { id: string; name: string }[];
  today: string;
  maxDate: string;
  initialOutfitId: string;
  initialReference: string;
}) {
  const [form, setForm] = useState<Form>({
    full_name: "",
    email: "",
    mobile: "",
    booking_reference: initialReference,
    outfit_id: initialOutfitId,
    notes: "",
  });
  const [slot, setSlot] = useState({ date: "", time: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const set =
    (key: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, fitting_date: slot.date, fitting_time: slot.time };
    const parsed = fittingRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFormError("Please check the highlighted fields.");
      return;
    }
    setErrors({});
    setFormError("");
    startTransition(async () => {
      const result = await requestFitting(payload);
      if (result.ok) {
        setDone(true);
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        toast.error(result.message);
        // The slot may have just been taken: force a fresh list.
        if (!result.fieldErrors) setSlot((s) => ({ date: s.date, time: "" }));
      }
    });
  };

  if (done) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 font-heading text-2xl">Fitting request received</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          {formatDate(slot.date)} at {formatTime(slot.time)}. We sent the details to {form.email} and
          will email you again once it is confirmed.
        </p>
        <Link href="/catalogue" className={buttonVariants({ size: "xl", className: "mt-6" })}>
          Browse Collection
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fit-name" label="Full name" required error={errors.full_name} className="sm:col-span-2">
          <Input value={form.full_name} onChange={set("full_name")} autoComplete="name" {...fieldAria("fit-name", errors.full_name)} />
        </Field>
        <Field id="fit-email" label="Email" required error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" {...fieldAria("fit-email", errors.email)} />
        </Field>
        <Field id="fit-mobile" label="Mobile number" required error={errors.mobile}>
          <Input type="tel" inputMode="tel" value={form.mobile} onChange={set("mobile")} autoComplete="tel" placeholder="0917 123 4567" {...fieldAria("fit-mobile", errors.mobile)} />
        </Field>
        <Field id="fit-outfit" label="Outfit to try" error={errors.outfit_id}>
          <NativeSelect value={form.outfit_id} onChange={set("outfit_id")} className="w-full" {...fieldAria("fit-outfit", errors.outfit_id)}>
            <NativeSelectOption value="">Not sure yet</NativeSelectOption>
            {outfits.map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>
                {o.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field
          id="fit-reference"
          label="Booking reference"
          error={errors.booking_reference}
          hint="Optional — if you already reserved."
        >
          <Input
            value={form.booking_reference}
            onChange={set("booking_reference")}
            placeholder="CLT-2026-0001"
            autoComplete="off"
            className="uppercase placeholder:normal-case"
            {...fieldAria("fit-reference", errors.booking_reference, "hint")}
          />
        </Field>
      </div>

      <FittingSlotPicker
        date={slot.date}
        time={slot.time}
        onChange={setSlot}
        minDate={today}
        maxDate={maxDate}
        error={errors.fitting_date ?? errors.fitting_time}
        idPrefix="fit"
      />

      <Field id="fit-notes" label="Notes" error={errors.notes}>
        <Textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Occasion, preferred styles, sizes to prepare…" {...fieldAria("fit-notes", errors.notes)} />
      </Field>

      <FormError message={formError} />

      <Button type="submit" size="xl" disabled={pending} className="sm:w-fit">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Sending request…" : "Request Fitting"}
      </Button>
    </form>
  );
}
