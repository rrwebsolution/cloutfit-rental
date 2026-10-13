"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/components/shared/use-form-action";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { sendContactMessage } from "@/lib/actions/public";
import type { ActionResult } from "@/lib/types";

const initial: ActionResult = { ok: false, message: "" };

export function ContactForm() {
  const { state, pending, formProps } = useFormAction(sendContactMessage, initial);
  const form = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      form.current?.reset();
    }
  }, [state]);

  return (
    <form ref={form} {...formProps} className="grid gap-4" noValidate>
      {/* Honeypot for bots; hidden from people and assistive tech. */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact-name" label="Full name" required error={errors.full_name}>
          <Input name="full_name" autoComplete="name" {...fieldAria("contact-name", errors.full_name)} />
        </Field>
        <Field id="contact-email" label="Email" required error={errors.email}>
          <Input name="email" type="email" autoComplete="email" {...fieldAria("contact-email", errors.email)} />
        </Field>
      </div>
      <Field id="contact-message" label="Message" required error={errors.message}>
        <Textarea name="message" rows={5} {...fieldAria("contact-message", errors.message)} />
      </Field>
      {!state.ok ? <FormError message={state.message} /> : null}
      <Button type="submit" size="xl" disabled={pending} className="sm:w-fit">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {pending ? "Sending…" : "Send Message"}
      </Button>
    </form>
  );
}
