"use client";

import { cn } from "@/lib/utils";
import type { PublicOutfit } from "@/lib/types";

type Variant = PublicOutfit["variants"][number];

/** Size + colour chips. Colours shown are the ones stocked in the chosen size. */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: Variant[];
  selectedId: string | null;
  onSelect: (variant: Variant) => void;
}) {
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const sizes = [...new Set(variants.map((v) => v.size))];
  const colors = [...new Set(variants.filter((v) => !selected || v.size === selected.size).map((v) => v.color))];

  const pickSize = (size: string) => {
    const next =
      variants.find((v) => v.size === size && v.color === selected?.color) ??
      variants.find((v) => v.size === size);
    if (next) onSelect(next);
  };
  const pickColor = (color: string) => {
    const next =
      variants.find((v) => v.color === color && v.size === selected?.size) ??
      variants.find((v) => v.color === color);
    if (next) onSelect(next);
  };

  return (
    <div className="grid gap-5">
      <ChipGroup label="Size" options={sizes} value={selected?.size ?? null} onPick={pickSize} />
      <ChipGroup label="Color" options={colors} value={selected?.color ?? null} onPick={pickColor} />
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: string[];
  value: string | null;
  onPick: (option: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">
        {label}
        {value ? <span className="font-normal text-muted-foreground"> · {value}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onPick(option)}
            className={cn(
              "min-h-10 min-w-11 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              option === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:border-primary/50",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
