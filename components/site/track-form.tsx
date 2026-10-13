"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useFormAction } from "@/components/shared/use-form-action";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import { trackBooking, type TrackResult } from "@/lib/actions/public";

const initial: TrackResult = { ok: false, message: "" };

export function TrackForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, pending, formProps } = useFormAction(trackBooking, initial);

  useEffect(() => {
    if (state.ok && state.data) {
      startNavigationProgress();
      router.push(`/booking/${state.data.reference}?token=${state.data.token}`);
    }
  }, [state, router]);

  const errors = state.fieldErrors ?? {};
  const busy = pending || state.ok;

  return (
    <form {...formProps} className="grid gap-4" noValidate>
      <Field id="track-reference" label="Booking reference" required error={errors.reference}>
        <Input
          name="reference"
          defaultValue={searchParams.get("reference") ?? ""}
          placeholder="CLT-2026-0001"
          autoCapitalize="characters"
          autoComplete="off"
          className="uppercase placeholder:normal-case"
          {...fieldAria("track-reference", errors.reference)}
        />
      </Field>
      <Field
        id="track-contact"
        label="Email or mobile number"
        required
        error={errors.contact}
        hint="Use the same email or mobile number you booked with."
      >
        <Input name="contact" autoComplete="email" {...fieldAria("track-contact", errors.contact, "hint")} />
      </Field>
      {!state.ok ? <FormError message={state.message} /> : null}
      <Button type="submit" size="xl" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {busy ? "Finding your booking…" : "Track Booking"}
      </Button>
    </form>
  );
}
