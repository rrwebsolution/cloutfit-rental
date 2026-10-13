"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { addBlockedDate } from "@/lib/actions/catalogue";

export function BlockedDateForm({ outfits, today }: { outfits: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [scope, setScope] = useState("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    startTransition(async () => {
      const result = await addBlockedDate(data);
      if (result.ok) {
        toast.success(result.message);
        setErrors({});
        setMessage("");
        form.current?.reset();
        setScope("all");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.fieldErrors ? "" : result.message);
      }
    });
  };

  return (
    <form ref={form} onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" noValidate>
      <Field id="block-from" label="From" required error={errors.date_from}>
        <Input name="date_from" type="date" min={today} defaultValue={today} {...fieldAria("block-from", errors.date_from)} />
      </Field>
      <Field id="block-to" label="To" required error={errors.date_to}>
        <Input name="date_to" type="date" min={today} defaultValue={today} {...fieldAria("block-to", errors.date_to)} />
      </Field>
      <Field id="block-scope" label="Blocks" required error={errors.scope}>
        <NativeSelect name="scope" className="w-full" value={scope} onChange={(e) => setScope(e.target.value)} {...fieldAria("block-scope", errors.scope)}>
          <NativeSelectOption value="all">Rentals &amp; fittings</NativeSelectOption>
          <NativeSelectOption value="rental">Rentals only</NativeSelectOption>
          <NativeSelectOption value="fitting">Fittings only</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field id="block-outfit" label="Applies to" error={errors.outfit_id}>
        <NativeSelect name="outfit_id" className="w-full" disabled={scope === "fitting"} {...fieldAria("block-outfit", errors.outfit_id)}>
          <NativeSelectOption value="">Whole shop</NativeSelectOption>
          {outfits.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field id="block-reason" label="Reason" error={errors.reason} className="sm:col-span-2 lg:col-span-1">
        <Input name="reason" maxLength={200} placeholder="Holiday, cleaning, repair…" {...fieldAria("block-reason", errors.reason)} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="md" disabled={pending} className="w-full">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Ban aria-hidden />}
          {pending ? "Blocking..." : "Block Dates"}
        </Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-6">
        <FormError message={message} />
      </div>
    </form>
  );
}
