"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/types";

/** Internal-notes editor. `action` is a bound Server Action taking the text. */
export function NotesForm({
  action,
  initial,
  label = "Internal notes",
  placeholder = "Visible to staff only…",
}: {
  action: (notes: string) => Promise<ActionResult>;
  initial: string;
  label?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await action(value);
      if (result.ok) {
        setSaved(value);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });

  return (
    <div className="grid gap-2">
      <Textarea
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        rows={4}
      />
      <Button type="button" variant="outline" size="md" className="w-fit" disabled={pending || value === saved} onClick={save}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        {pending ? "Saving..." : "Save notes"}
      </Button>
    </div>
  );
}
