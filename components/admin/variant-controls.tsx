"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateVariant } from "@/lib/actions/catalogue";

/** Inline quantity + active toggle for one variant row. */
export function VariantControls({
  variantId,
  quantity,
  isActive,
  label,
}: {
  variantId: string;
  quantity: number;
  isActive: boolean;
  label: string;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(String(quantity));
  const [active, setActive] = useState(isActive);
  const [pending, startTransition] = useTransition();

  const save = (patch: { quantity?: number; is_active?: boolean }, revert: () => void) =>
    startTransition(async () => {
      const result = await updateVariant(variantId, patch);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
        revert();
      }
    });

  const dirty = qty !== String(quantity);

  return (
    <div className="flex items-center justify-end gap-3">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          max={99}
          value={qty}
          aria-label={`Quantity for ${label}`}
          onChange={(e) => setQty(e.target.value)}
          className="h-8 w-16 text-center"
        />
        <Button
          type="button"
          size="icon"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || pending}
          aria-label={`Save quantity for ${label}`}
          onClick={() => save({ quantity: Number(qty) }, () => setQty(String(quantity)))}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={active}
          disabled={pending}
          aria-label={`${label} active`}
          onCheckedChange={(checked) => {
            setActive(checked);
            save({ is_active: checked }, () => setActive(!checked));
          }}
        />
        <span className="w-14 text-left text-muted-foreground">{active ? "Active" : "Hidden"}</span>
      </label>
    </div>
  );
}
