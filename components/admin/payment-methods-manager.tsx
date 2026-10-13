"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageUp, Loader2, Pencil, Plus, QrCode, Star, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/admin/action-button";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { ToneBadge } from "@/components/shared/status-badge";
import {
  deletePaymentMethod,
  savePaymentMethod,
  setDefaultPaymentMethod,
  setPaymentMethodActive,
} from "@/lib/actions/payment-methods";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_QR_BUCKET } from "@/lib/constants";
import { extensionFor, IMAGE_ACCEPT, MAX_QR_BYTES, validateImageFile } from "@/lib/uploads";
import type { PaymentMethod } from "@/lib/types";

export type ManagedPaymentMethod = PaymentMethod & { qr_url: string | null };

const PROVIDERS = ["QR Ph", "GCash", "Maya", "BPI", "BDO", "Metrobank", "UnionBank", "Other"];

/**
 * Admin → Settings → Payment Methods. Add, edit, enable/disable, set the
 * default, upload or replace the QR code, and delete (or archive) methods.
 */
export function PaymentMethodsManager({
  methods,
  canEdit,
}: {
  methods: ManagedPaymentMethod[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ManagedPaymentMethod | "new" | null>(null);
  const live = methods.filter((m) => !m.archived_at);
  const archived = methods.filter((m) => m.archived_at);
  const activeCount = live.filter((m) => m.is_active).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-sans text-sm font-semibold text-foreground">Payment methods &amp; QR codes</h3>
          <p className="text-sm text-muted-foreground">
            Customers choose from the active methods and scan its QR code to pay.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" size="md" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add Payment Method
          </Button>
        ) : null}
      </div>

      {activeCount === 0 ? (
        <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          No active payment method. Customers cannot see where to send the reservation fee until you add one.
        </p>
      ) : null}

      {live.length > 0 ? (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {live.map((m) => (
            <li key={m.id} className="flex gap-4 rounded-2xl border border-border bg-background/50 p-4">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white sm:size-28">
                {m.qr_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- QR codes are served as uploaded
                  <img src={m.qr_url} alt={`${m.name} QR code`} className="size-full object-contain p-1.5" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <QrCode className="size-7 text-muted-red" strokeWidth={1.25} aria-hidden />
                    No QR yet
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-heading text-lg text-primary-dark">{m.name}</p>
                  <ToneBadge tone={m.is_active ? "success" : "muted"}>{m.is_active ? "Active" : "Disabled"}</ToneBadge>
                  {m.is_default ? (
                    <ToneBadge tone="primary">
                      <Star className="size-3 fill-current" aria-hidden /> Default
                    </ToneBadge>
                  ) : null}
                </div>
                <dl className="mt-1.5 space-y-0.5 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Provider:</dt>
                    <dd className="truncate text-foreground">{m.provider}</dd>
                  </div>
                  {m.account_name ? (
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Account name:</dt>
                      <dd className="truncate text-foreground">{m.account_name}</dd>
                    </div>
                  ) : null}
                  {m.account_number ? (
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Account number:</dt>
                      <dd className="truncate text-foreground">{m.account_number}</dd>
                    </div>
                  ) : null}
                </dl>
                {canEdit ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(m)}>
                      <Pencil aria-hidden /> {m.qr_url ? "Edit / Replace QR" : "Edit / Upload QR"}
                    </Button>
                    {m.is_active && !m.is_default ? (
                      <ActionButton action={setDefaultPaymentMethod.bind(null, m.id)} size="sm">
                        Set Default
                      </ActionButton>
                    ) : null}
                    <ActionButton action={setPaymentMethodActive.bind(null, m.id, !m.is_active)} size="sm">
                      {m.is_active ? "Disable" : "Enable"}
                    </ActionButton>
                    <ActionButton
                      action={deletePaymentMethod.bind(null, m.id)}
                      size="sm"
                      variant="destructive"
                      confirm={{
                        title: `Delete ${m.name}?`,
                        description:
                          "Customers will no longer see it. If payments were already made with this method, it is archived instead so that history stays intact.",
                        confirmLabel: "Delete",
                        destructive: true,
                      }}
                    >
                      <Trash2 aria-hidden />
                      <span className="sr-only">Delete {m.name}</span>
                    </ActionButton>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {archived.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Archived (kept for payment history): {archived.map((m) => m.name).join(", ")}
        </p>
      ) : null}

      {editing ? (
        <MethodDialog
          key={editing === "new" ? "new" : editing.id}
          method={editing === "new" ? null : editing}

          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function MethodDialog({
  method,

  onClose,
}: {
  method: ManagedPaymentMethod | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({
    name: method?.name ?? "",
    provider: method?.provider ?? "",
    account_name: method?.account_name ?? "",
    account_number: method?.account_number ?? "",
    instructions: method?.instructions ?? "",
    sort_order: method?.sort_order ?? 0,
    is_active: method?.is_active ?? true,
    is_default: method?.is_default ?? false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    if (!chosen) return;
    const problem = validateImageFile(chosen, MAX_QR_BYTES);
    if (problem) {
      e.target.value = "";
      setErrors((prev) => ({ ...prev, qr_image_path: problem }));
      return;
    }
    setErrors((prev) => ({ ...prev, qr_image_path: "" }));
    setFile(chosen);
    setRemoveQr(false);
    setPreview(URL.createObjectURL(chosen));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // This dialog is rendered inside the settings page; keep its submit from
    // reaching any ancestor handler.
    e.stopPropagation();
    startTransition(async () => {
      const supabase = createClient();
      let qrPath = removeQr ? null : (method?.qr_image_path ?? null);
      let uploaded: string | null = null;

      if (file) {
        // Random server-safe name; the original filename is never used. The
        // bucket only accepts uploads from admins, and enforces type and size.
        uploaded = `${crypto.randomUUID()}.${extensionFor(file.type)}`;
        const { error } = await supabase.storage
          .from(PAYMENT_QR_BUCKET)
          .upload(uploaded, file, { contentType: file.type, cacheControl: "3600", upsert: false });
        if (error) {
          setMessage(`Could not upload the QR code: ${error.message}`);
          return;
        }
        qrPath = uploaded;
      }

      const result = await savePaymentMethod(method?.id ?? null, { ...values, qr_image_path: qrPath });
      if (result.ok) {
        toast.success(result.message);
        onClose();
        router.refresh();
      } else {
        // Do not leave an orphaned image behind when the save is rejected.
        if (uploaded) await supabase.storage.from(PAYMENT_QR_BUCKET).remove([uploaded]);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.fieldErrors ? "" : result.message);
      }
    });
  };

  const currentQr = preview ?? (removeQr ? null : (method?.qr_url ?? null));
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Dialog open onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{method ? `Edit ${method.name}` : "Add payment method"}</DialogTitle>
            <DialogDescription>
              Shown to customers on the reservation fee step. Any provider works — it does not have to be GCash.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pm-name" label="Payment method name" required error={errors.name} hint="e.g. QR Ph, GCash, BPI Savings">
              <Input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={60} {...fieldAria("pm-name", errors.name, "hint")} />
            </Field>
            <Field id="pm-provider" label="Provider" required error={errors.provider} hint="Pick one or type your own.">
              <Input
                list="pm-provider-options"
                value={values.provider}
                onChange={(e) => set("provider", e.target.value)}
                maxLength={60}
                {...fieldAria("pm-provider", errors.provider, "hint")}
              />
              <datalist id="pm-provider-options">
                {PROVIDERS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field id="pm-account-name" label="Account name" error={errors.account_name}>
              <Input value={values.account_name} onChange={(e) => set("account_name", e.target.value)} maxLength={80} {...fieldAria("pm-account-name", errors.account_name)} />
            </Field>
            <Field id="pm-account-number" label="Account / mobile number" error={errors.account_number}>
              <Input value={values.account_number} onChange={(e) => set("account_number", e.target.value)} maxLength={40} {...fieldAria("pm-account-number", errors.account_number)} />
            </Field>
          </div>

          <Field
            id="pm-qr"
            label="QR code image"
            error={errors.qr_image_path}
            hint="JPG, PNG or WebP, up to 2 MB. Use the QR image exported from your bank or e-wallet app."
          >
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-input bg-surface p-3">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                {currentQr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- QR preview
                  <img src={currentQr} alt="QR code preview" className="size-full object-contain p-1" />
                ) : (
                  <QrCode className="size-8 text-muted-red" strokeWidth={1.25} aria-hidden />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="md" onClick={() => fileInput.current?.click()}>
                  <ImageUp aria-hidden /> {currentQr ? "Replace QR" : "Upload QR"}
                </Button>
                {currentQr ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="text-destructive"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setRemoveQr(true);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={pickFile}
                className="sr-only"
                {...fieldAria("pm-qr", errors.qr_image_path, "hint")}
              />
            </div>
          </Field>

          <Field id="pm-instructions" label="Payment instructions" error={errors.instructions} hint="Shown under the QR code for this method.">
            <Textarea
              rows={3}
              maxLength={1000}
              value={values.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="e.g. Open your banking app, scan the QR, and pay the exact amount."
              {...fieldAria("pm-instructions", errors.instructions, "hint")}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="pm-order" label="Display order" error={errors.sort_order}>
              <Input type="number" min={0} value={values.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} {...fieldAria("pm-order", errors.sort_order)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch
                checked={values.is_active}
                onCheckedChange={(checked) => setValues((v) => ({ ...v, is_active: checked, is_default: checked ? v.is_default : false }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch
                checked={values.is_default}
                disabled={!values.is_active}
                onCheckedChange={(checked) => set("is_default", checked)}
              />
              Default
            </label>
          </div>
          {errors.is_default ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {errors.is_default}
            </p>
          ) : null}

          <FormError message={message} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? "Saving..." : method ? "Save Changes" : "Add Payment Method"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
