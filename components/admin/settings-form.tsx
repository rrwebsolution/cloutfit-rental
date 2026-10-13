"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { saveSettings } from "@/lib/actions/system";
import { WEEKDAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PrivateSettings, Settings } from "@/lib/settings";

type Values = Settings & PrivateSettings;

/**
 * Admin → Settings. Deliberately not a <form> element: the payment-methods
 * manager (with its own dialogs and forms) is rendered inside the Payment
 * section, and forms must not be nested.
 */
export function SettingsForm({
  initial,
  canEdit,
  envNotificationEmail,
  paymentMethods,
}: {
  initial: Values;
  canEdit: boolean;
  /** Whether ADMIN_NOTIFICATION_EMAIL is set on the server (never its value). */
  envNotificationEmail: boolean;
  /** The payment-methods manager, rendered inside "Payment & Reservation". */
  paymentMethods: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const locked = !canEdit || pending;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const text = (key: keyof Values) => ({
    value: String(values[key]),
    disabled: locked,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value as never),
    ...fieldAria(`set-${key}`, errors[key]),
  });

  const save = () =>
    startTransition(async () => {
      const result = await saveSettings(values);
      if (result.ok) {
        setErrors({});
        setMessage("");
        toast.success(result.message);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        toast.error(result.message);
      }
    });

  return (
    <div className="grid gap-6">
      <Section id="business" title="Business Information" description="Shown in the header, footer, contact page and emails.">
        <Field id="set-business_name" label="Business name" required error={errors.business_name}>
          <Input {...text("business_name")} />
        </Field>
        <Field id="set-business_email" label="Business email" error={errors.business_email}>
          <Input type="email" {...text("business_email")} />
        </Field>
        <Field id="set-business_mobile" label="Mobile / contact number" error={errors.business_mobile}>
          <Input {...text("business_mobile")} />
        </Field>
        <Field id="set-business_hours" label="Opening hours" error={errors.business_hours}>
          <Input placeholder="Monday – Saturday, 10:00 AM – 6:00 PM" {...text("business_hours")} />
        </Field>
        <Field id="set-business_address" label="Address" error={errors.business_address} className="sm:col-span-2">
          <Input {...text("business_address")} />
        </Field>
        <Field id="set-social_facebook" label="Facebook" error={errors.social_facebook}>
          <Input type="url" placeholder="https://facebook.com/…" {...text("social_facebook")} />
        </Field>
        <Field id="set-social_instagram" label="Instagram" error={errors.social_instagram}>
          <Input type="url" placeholder="https://instagram.com/…" {...text("social_instagram")} />
        </Field>
        <Field id="set-social_tiktok" label="TikTok" error={errors.social_tiktok}>
          <Input type="url" placeholder="https://tiktok.com/@…" {...text("social_tiktok")} />
        </Field>
      </Section>

      <Section id="booking" title="Booking Settings" description="Limits enforced when customers book.">
        <Field id="set-max_rental_days" label="Maximum rental length (days)" required error={errors.max_rental_days}>
          <Input type="number" min={1} max={60} {...text("max_rental_days")} />
        </Field>
        <Field id="set-booking_window_days" label="Book ahead up to (days)" required error={errors.booking_window_days}>
          <Input type="number" min={7} max={730} {...text("booking_window_days")} />
        </Field>
      </Section>

      <Section id="fitting" title="Fitting Settings" description="Slots are generated from these. Block specific dates under Availability.">
        <fieldset className="sm:col-span-2" disabled={locked}>
          <legend className="mb-2 text-sm font-medium text-foreground">Available fitting days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day, i) => {
              const on = values.fitting_days.includes(i);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set("fitting_days", on ? values.fitting_days.filter((d) => d !== i) : [...values.fitting_days, i].sort())
                  }
                  className={cn(
                    "h-10 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50",
                  )}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {errors.fitting_days ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
              {errors.fitting_days}
            </p>
          ) : null}
        </fieldset>
        <Field id="set-fitting_open_time" label="Opening time" required error={errors.fitting_open_time}>
          <Input type="time" {...text("fitting_open_time")} />
        </Field>
        <Field id="set-fitting_close_time" label="Closing time" required error={errors.fitting_close_time}>
          <Input type="time" {...text("fitting_close_time")} />
        </Field>
        <Field id="set-fitting_duration_minutes" label="Appointment duration (minutes)" required error={errors.fitting_duration_minutes}>
          <Input type="number" min={10} max={240} step={5} {...text("fitting_duration_minutes")} />
        </Field>
        <Field id="set-fitting_max_simultaneous" label="Maximum simultaneous appointments" required error={errors.fitting_max_simultaneous}>
          <Input type="number" min={1} max={20} {...text("fitting_max_simultaneous")} />
        </Field>
      </Section>

      <Section
        id="payment"
        title="Payment & Reservation"
        description="The reservation fee, where customers send it, and what they are told."
      >
        <Field
          id="set-reservation_fee"
          label="Reservation fee (₱)"
          required
          error={errors.reservation_fee}
          hint="Applies to new bookings. Set 0 to disable the fee."
        >
          <Input type="number" min={0} step="1" inputMode="numeric" {...text("reservation_fee")} />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
          <Switch
            checked={values.deduct_reservation_fee}
            disabled={locked}
            onCheckedChange={(checked) => set("deduct_reservation_fee", checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">Deduct reservation fee from rental total</span>
            <span className="block text-muted-foreground">
              {values.deduct_reservation_fee
                ? "ON — a verified reservation fee reduces the remaining rental balance."
                : "OFF — the reservation fee is a separate charge on top of the rental."}{" "}
              Applies to new bookings only.
            </span>
          </span>
        </label>
        <Field
          id="set-payment_instructions"
          label="Payment instructions"
          error={errors.payment_instructions}
          hint="General note shown under every payment method on the reservation fee step."
          className="sm:col-span-2"
        >
          <Textarea rows={3} {...text("payment_instructions")} />
        </Field>
        <div className="border-t border-border pt-5 sm:col-span-2">{paymentMethods}</div>
      </Section>

      <Section id="notifications" title="Notifications" description="Where new reservations, fittings and submitted payments are emailed.">
        <Field
          id="set-notification_email"
          label="Admin email"
          error={errors.notification_email}
          hint={
            envNotificationEmail
              ? "Leave blank to use ADMIN_NOTIFICATION_EMAIL from the server environment."
              : "ADMIN_NOTIFICATION_EMAIL is not set on the server — enter an address here to receive notifications."
          }
          className="sm:col-span-2"
        >
          <Input type="email" placeholder="you@gmail.com" {...text("notification_email")} />
        </Field>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Customers are emailed automatically when a reservation is received, a payment is verified or
          rejected, a fitting changes, and the day before their rental.
        </p>
      </Section>

      <Section id="policies" title="Rental Policies" description="Shown on the Rental Policies page and on every outfit page.">
        <Field id="set-rental_policies" label="Policies" error={errors.rental_policies} hint="One policy per line." className="sm:col-span-2">
          <Textarea rows={8} {...text("rental_policies")} />
        </Field>
      </Section>

      <FormError message={message} />

      {canEdit ? (
        <div className="sticky bottom-4 z-10">
          <Button type="button" size="xl" disabled={pending} className="shadow-lift" onClick={save}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {pending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only administrators can change settings.</p>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="surface-card scroll-mt-20 p-5 sm:p-6" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="font-heading text-xl">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
