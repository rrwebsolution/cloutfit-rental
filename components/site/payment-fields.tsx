"use client";

import { useEffect, useState } from "react";
import { ImageUp, Maximize2, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/shared/form-field";
import { IMAGE_ACCEPT, MAX_PROOF_BYTES, validateImageFile } from "@/lib/uploads";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicPaymentMethod } from "@/lib/types";

export type PaymentInfo = {
  /** Reservation fee from Admin → Settings (never hard-coded). */
  fee: number;
  /** Active payment methods, default first. Empty until the admin adds one. */
  methods: PublicPaymentMethod[];
  /** General payment instructions from Admin → Settings. */
  instructions: string;
};

/** The method pre-selected for the customer: the admin's default, else the first. */
export function defaultMethodId(methods: PublicPaymentMethod[]): string {
  return (methods.find((m) => m.is_default) ?? methods[0])?.id ?? "";
}

/**
 * "Scan to Pay": the reservation fee, a method chooser (when there is more
 * than one), and the selected method's QR code and account details.
 */
export function PaymentInstructions({
  info,
  selectedId,
  onSelect,
}: {
  info: PaymentInfo;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const method = info.methods.find((m) => m.id === selectedId) ?? info.methods[0] ?? null;

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-primary/20 bg-accent/50 p-5 text-center sm:p-6">
        <p className="eyebrow">Reservation Fee</p>
        <p className="mt-2 font-heading text-4xl text-primary-dark">{formatPeso(info.fee)}</p>
        <p className="mt-2 text-sm text-foreground/80">
          {method?.qr_url
            ? "Scan the QR code below to pay your reservation fee."
            : "Pay your reservation fee using the details below."}
        </p>
      </div>

      {info.methods.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Choose payment method</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {info.methods.map((m) => {
              const active = m.id === method?.id;
              return (
                <label
                  key={m.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    active ? "border-primary bg-accent/50" : "border-border bg-surface hover:border-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="payment-method-choice"
                    checked={active}
                    onChange={() => onSelect(m.id)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{m.name}</span>
                    <span className="block truncate text-muted-foreground">
                      {m.account_number || m.account_name || m.provider}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {method ? (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-center text-xs font-semibold tracking-[0.28em] text-primary uppercase">Scan to Pay</p>

          {method.qr_url ? (
            <button
              type="button"
              onClick={() => setZoom(true)}
              aria-label={`Enlarge the ${method.name} QR code`}
              className="group relative mx-auto mt-4 block w-full max-w-[17rem] rounded-2xl border border-border bg-white p-3 shadow-soft transition-shadow outline-none hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {/* A QR code must stay pixel-exact, so it is served as uploaded (no optimizer). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={method.qr_url}
                alt={`${method.name} payment QR code`}
                width={272}
                height={272}
                className="aspect-square w-full rounded-lg object-contain"
              />
              <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[0.7rem] font-medium text-primary-foreground">
                <Maximize2 className="size-3" aria-hidden /> Tap to enlarge
              </span>
            </button>
          ) : (
            <div className="mx-auto mt-4 flex aspect-square w-full max-w-[13rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
              <QrCode className="size-8 text-muted-red" strokeWidth={1.25} aria-hidden />
              No QR code for this method. Use the account details below.
            </div>
          )}

          <dl className="mt-5 grid gap-3 text-center text-sm">
            <div>
              <dt className="sr-only">Payment provider</dt>
              <dd className="font-heading text-lg text-primary-dark">
                {method.name}
                {method.provider.toLowerCase() !== method.name.toLowerCase() ? (
                  <span className="font-sans text-sm font-normal text-muted-foreground"> · {method.provider}</span>
                ) : null}
              </dd>
            </div>
            {method.account_name ? (
              <div>
                <dt className="text-xs tracking-[0.16em] text-muted-red uppercase">Account name</dt>
                <dd className="mt-0.5 font-medium text-foreground">{method.account_name}</dd>
              </div>
            ) : null}
            {method.account_number ? (
              <div>
                <dt className="text-xs tracking-[0.16em] text-muted-red uppercase">Account number</dt>
                <dd className="mt-0.5 text-lg font-semibold tracking-wide text-foreground">{method.account_number}</dd>
              </div>
            ) : null}
          </dl>

          {method.instructions ? (
            <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed whitespace-pre-line text-foreground/80">
              {method.instructions}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface/60 p-5 text-sm text-muted-foreground">
          Online payment details are not posted yet. Please contact us for how to pay, then submit
          your payment details below.
        </p>
      )}

      {info.instructions ? (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{info.instructions}</p>
      ) : null}
      <p className="text-sm font-medium text-foreground">After payment, please submit your payment details below.</p>

      {method?.qr_url ? (
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {method.name} · {formatPeso(info.fee)}
              </DialogTitle>
              <DialogDescription>Scan this code with your banking or e-wallet app.</DialogDescription>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={method.qr_url}
              alt={`${method.name} payment QR code, enlarged`}
              className="aspect-square w-full rounded-xl border border-border bg-white object-contain p-3"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/**
 * Inputs for submitting a payment. Uncontrolled and named, so the parent can
 * read them with `new FormData(form)` or post them to a Server Action.
 * Only the method's id is sent; the server looks the method up itself.
 */
export function PaymentFields({
  info,
  methodId,
  today,
  errors = {},
}: {
  info: PaymentInfo;
  methodId: string;
  today: string;
  errors?: Record<string, string>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const method = info.methods.find((m) => m.id === methodId) ?? null;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setFileName("");
      setFileError("");
      return;
    }
    const problem = validateImageFile(file, MAX_PROOF_BYTES);
    if (problem) {
      e.target.value = "";
      setPreview(null);
      setFileName("");
      setFileError(problem);
      return;
    }
    setFileError("");
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  };

  const proofError = fileError || errors.proof;
  const methodError = errors.payment_method_id || errors.method;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="payment_method_id" value={method?.id ?? ""} />
      <Field id="pay-method" label="Payment method" required error={methodError}>
        {method ? (
          <Input
            readOnly
            value={method.provider.toLowerCase() === method.name.toLowerCase() ? method.name : `${method.name} / ${method.provider}`}
            className="bg-muted/60"
            {...fieldAria("pay-method", methodError)}
          />
        ) : (
          <Input name="method" placeholder="e.g. GCash, bank transfer" {...fieldAria("pay-method", methodError)} />
        )}
      </Field>
      <Field id="pay-ref" label="Reference / transaction number" required error={errors.reference_number}>
        <Input name="reference_number" autoComplete="off" placeholder="e.g. 1234 567 890123" {...fieldAria("pay-ref", errors.reference_number)} />
      </Field>
      <Field id="pay-amount" label="Amount paid (₱)" required error={errors.amount}>
        <Input name="amount" type="number" inputMode="decimal" min={1} step="0.01" defaultValue={info.fee || ""} {...fieldAria("pay-amount", errors.amount)} />
      </Field>
      <Field id="pay-date" label="Payment date" required error={errors.payment_date}>
        <Input name="payment_date" type="date" max={today} defaultValue={today} {...fieldAria("pay-date", errors.payment_date)} />
      </Field>

      <Field
        id="pay-proof"
        label="Proof of payment"
        required
        error={proofError}
        hint="Screenshot or photo of your receipt. JPG, PNG or WebP, up to 4 MB."
        className="sm:col-span-2"
      >
        <label
          htmlFor="pay-proof"
          className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-input bg-surface p-4 transition-colors hover:border-primary/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Preview of your proof of payment" className="size-16 rounded-lg border border-border object-cover" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <ImageUp className="size-6" strokeWidth={1.5} aria-hidden />
            </span>
          )}
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium text-foreground">{fileName || "Upload screenshot"}</span>
            <span className="text-muted-foreground">{fileName ? "Tap to replace" : "Tap to choose an image"}</span>
          </span>
          <input
            name="proof"
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={onFile}
            className="sr-only"
            {...fieldAria("pay-proof", proofError, "hint")}
          />
        </label>
      </Field>
    </div>
  );
}
