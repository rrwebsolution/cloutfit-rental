"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import { saveOutfit } from "@/lib/actions/catalogue";
import { slugify } from "@/lib/format";

type VariantRow = { key: string; id?: string; size: string; color: string; quantity: number; is_active: boolean };

export type OutfitFormValues = {
  name: string;
  slug: string;
  category_id: string;
  description: string;
  rental_price: string;
  status: "active" | "unavailable";
  is_featured: boolean;
  internal_notes: string;
  variants: Omit<VariantRow, "key">[];
};

const withKey = (v: Omit<VariantRow, "key">): VariantRow => ({ ...v, key: crypto.randomUUID() });

/** Create/edit an outfit: details, price, category, and its size/color variants. */
export function OutfitForm({
  outfitId,
  initial,
  categories,
  disabled = false,
}: {
  outfitId: string | null;
  initial: OutfitFormValues;
  categories: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  // Initial rows get deterministic keys (identical on server and client);
  // rows added later in the browser get random ones via withKey().
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    initial.variants.map((v, i) => ({ ...v, key: v.id ?? `initial-${i}` })),
  );
  // Keep the slug in sync with the name until the user edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(Boolean(outfitId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof OutfitFormValues>(key: K, value: OutfitFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setVariant = (key: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveOutfit(outfitId, {
        ...values,
        variants: variants.map(({ id, size, color, quantity, is_active }) => ({ id, size, color, quantity, is_active })),
      });
      if (result.ok) {
        setErrors({});
        setMessage("");
        toast.success(result.message);
        if (!outfitId && result.data) {
          startNavigationProgress();
          router.push(`/admin/outfits/${result.data.id}`);
        } else router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        toast.error(result.message);
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <fieldset disabled={disabled || pending} className="grid gap-6">
        <section className="surface-card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h2 className="font-heading text-xl sm:col-span-2">Details</h2>
          <Field id="outfit-name" label="Outfit name" required error={errors.name}>
            <Input
              value={values.name}
              onChange={(e) => {
                const name = e.target.value;
                setValues((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name) }));
              }}
              {...fieldAria("outfit-name", errors.name)}
            />
          </Field>
          <Field id="outfit-slug" label="URL slug" required error={errors.slug} hint={`/outfits/${values.slug || "…"}`}>
            <Input
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
              {...fieldAria("outfit-slug", errors.slug, "hint")}
            />
          </Field>
          <Field id="outfit-category" label="Category" required error={errors.category_id}>
            <NativeSelect
              className="w-full"
              value={values.category_id}
              onChange={(e) => set("category_id", e.target.value)}
              {...fieldAria("outfit-category", errors.category_id)}
            >
              <NativeSelectOption value="">Choose a category</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="outfit-price" label="Rental price (₱)" required error={errors.rental_price} hint="Flat price per rental.">
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={values.rental_price}
              onChange={(e) => set("rental_price", e.target.value)}
              {...fieldAria("outfit-price", errors.rental_price, "hint")}
            />
          </Field>
          <Field id="outfit-description" label="Description" error={errors.description} className="sm:col-span-2">
            <Textarea
              rows={5}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Fabric, silhouette, fit, occasion…"
              {...fieldAria("outfit-description", errors.description)}
            />
          </Field>
          <Field id="outfit-status" label="Catalogue status" error={errors.status}>
            <NativeSelect
              className="w-full"
              value={values.status}
              onChange={(e) => set("status", e.target.value as OutfitFormValues["status"])}
              {...fieldAria("outfit-status", errors.status)}
            >
              <NativeSelectOption value="active">Active — can be booked</NativeSelectOption>
              <NativeSelectOption value="unavailable">Unavailable — shown, cannot be booked</NativeSelectOption>
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-3 self-end rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <Switch checked={values.is_featured} onCheckedChange={(checked) => set("is_featured", checked)} />
            <span>
              <span className="font-medium text-foreground">Featured</span>
              <span className="block text-xs text-muted-foreground">Show in the landing page collection.</span>
            </span>
          </label>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl">Sizes &amp; colors</h2>
              <p className="text-sm text-muted-foreground">
                One row per size/color you own. Quantity is how many identical pieces can be out on the same dates.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setVariants((rows) => [...rows, withKey({ size: "", color: rows.at(-1)?.color ?? "", quantity: 1, is_active: true })])}
            >
              <Plus aria-hidden /> Add variant
            </Button>
          </div>
          {errors.variants ? (
            <p role="alert" className="mt-3 text-xs font-medium text-destructive">
              {errors.variants}
            </p>
          ) : null}

          <ul className="mt-4 grid gap-3">
            {variants.map((v, i) => {
              const sizeError = errors[`variants.${i}.size`];
              const colorError = errors[`variants.${i}.color`];
              const qtyError = errors[`variants.${i}.quantity`];
              return (
                <li key={v.key} className="grid grid-cols-2 items-start gap-3 rounded-xl border border-border bg-background/50 p-3 sm:grid-cols-[1fr_1fr_6rem_auto_auto]">
                  <Field id={`variant-size-${v.key}`} label="Size" required error={sizeError}>
                    <Input value={v.size} placeholder="S, M, 38…" onChange={(e) => setVariant(v.key, { size: e.target.value })} {...fieldAria(`variant-size-${v.key}`, sizeError)} />
                  </Field>
                  <Field id={`variant-color-${v.key}`} label="Color" required error={colorError}>
                    <Input value={v.color} placeholder="Black" onChange={(e) => setVariant(v.key, { color: e.target.value })} {...fieldAria(`variant-color-${v.key}`, colorError)} />
                  </Field>
                  <Field id={`variant-qty-${v.key}`} label="Quantity" required error={qtyError}>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={v.quantity}
                      onChange={(e) => setVariant(v.key, { quantity: Number(e.target.value) })}
                      {...fieldAria(`variant-qty-${v.key}`, qtyError)}
                    />
                  </Field>
                  <label className="flex h-10 items-center gap-2 self-end text-sm">
                    <Switch checked={v.is_active} onCheckedChange={(checked) => setVariant(v.key, { is_active: checked })} />
                    Active
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="self-end text-destructive"
                    aria-label={`Remove variant ${v.size} ${v.color}`.trim()}
                    disabled={variants.length === 1}
                    onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Removing a variant that has booking history hides it instead of deleting it, so past bookings stay intact.
          </p>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <Field id="outfit-notes" label="Internal notes" error={errors.internal_notes} hint="Staff only — never shown on the website.">
            <Textarea
              rows={3}
              value={values.internal_notes}
              onChange={(e) => set("internal_notes", e.target.value)}
              placeholder="Condition, storage location, alterations, purchase cost…"
              {...fieldAria("outfit-notes", errors.internal_notes, "hint")}
            />
          </Field>
        </section>
      </fieldset>

      <FormError message={message} />

      <div>
        <Button type="submit" size="xl" disabled={disabled || pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {pending ? "Saving..." : outfitId ? "Save Changes" : "Create Outfit"}
        </Button>
      </div>
    </form>
  );
}
