"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { saveCategory } from "@/lib/actions/catalogue";
import { slugify } from "@/lib/format";
import type { Category } from "@/lib/types";

const EMPTY = { name: "", slug: "", description: "", sort_order: 0, is_active: true };

/** Add (no `category`) or edit a category. */
export function CategoryDialog({ category }: { category?: Category }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(category ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const prefix = category?.id ?? "new";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveCategory(category?.id ?? null, {
        name: values.name,
        slug: values.slug,
        description: values.description,
        sort_order: values.sort_order,
        is_active: values.is_active,
      });
      if (result.ok) {
        toast.success(result.message);
        setErrors({});
        setMessage("");
        setOpen(false);
        if (!category) setValues(EMPTY);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.fieldErrors ? "" : result.message);
      }
    });
  };

  return (
    <>
      {category ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil aria-hidden /> Edit
        </Button>
      ) : (
        <Button type="button" size="md" onClick={() => setOpen(true)}>
          <Plus aria-hidden /> Add Category
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
              <DialogDescription>Categories group outfits in the catalogue and on the landing page.</DialogDescription>
            </DialogHeader>
            <Field id={`cat-name-${prefix}`} label="Name" required error={errors.name}>
              <Input
                value={values.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setValues((v) => ({ ...v, name, slug: category ? v.slug : slugify(name) }));
                }}
                {...fieldAria(`cat-name-${prefix}`, errors.name)}
              />
            </Field>
            <Field id={`cat-slug-${prefix}`} label="URL slug" required error={errors.slug}>
              <Input
                value={values.slug}
                onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value.toLowerCase() }))}
                {...fieldAria(`cat-slug-${prefix}`, errors.slug)}
              />
            </Field>
            <Field id={`cat-desc-${prefix}`} label="Description" error={errors.description}>
              <Textarea
                rows={2}
                maxLength={300}
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                {...fieldAria(`cat-desc-${prefix}`, errors.description)}
              />
            </Field>
            <div className="grid grid-cols-2 items-end gap-4">
              <Field id={`cat-order-${prefix}`} label="Display order" error={errors.sort_order}>
                <Input
                  type="number"
                  min={0}
                  value={values.sort_order}
                  onChange={(e) => setValues((v) => ({ ...v, sort_order: Number(e.target.value) }))}
                  {...fieldAria(`cat-order-${prefix}`, errors.sort_order)}
                />
              </Field>
              <label className="flex h-10 items-center gap-2 text-sm">
                <Switch checked={values.is_active} onCheckedChange={(checked) => setValues((v) => ({ ...v, is_active: checked }))} />
                Visible on site
              </label>
            </div>
            <FormError message={message} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {pending ? "Saving..." : category ? "Save Changes" : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
