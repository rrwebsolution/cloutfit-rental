"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const FILTER_KEYS = ["q", "category", "size", "color", "min", "max", "availability", "from", "to", "sort"];

/**
 * Catalogue search + filters. State lives in the URL so results are
 * shareable, back-button friendly and rendered on the server.
 */
export function CatalogueFilters({
  categories,
  sizes,
  colors,
  today,
  maxDate,
}: {
  categories: Option[];
  sizes: string[];
  colors: string[];
  today: string;
  maxDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const get = (key: string) => searchParams.get(key) ?? "";
  const activeCount = FILTER_KEYS.filter((k) => k !== "q" && k !== "sort" && get(k)).length;

  const apply = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = String(data.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    // A return date without a rental date is meaningless; treat as one day.
    if (params.get("to") && !params.get("from")) params.set("from", params.get("to")!);
    if (params.get("from") && !params.get("to")) params.set("to", params.get("from")!);
    if ((params.get("to") ?? "") < (params.get("from") ?? "")) params.set("to", params.get("from")!);
    const qs = params.toString();
    const href = qs ? `/catalogue?${qs}` : "/catalogue";
    startNavigationProgress(href);
    startTransition(() => router.push(href, { scroll: false }));
  };

  const autoApply = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (e.currentTarget.form) apply(e.currentTarget.form);
  };

  return (
    <form
      // Remount when the URL changes so inputs always mirror the active filters.
      key={searchParams.toString()}
      role="search"
      aria-label="Filter outfits"
      className="surface-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            type="search"
            defaultValue={get("q")}
            placeholder="Search outfits…"
            aria-label="Search outfits"
            className="pl-9"
          />
        </div>
        <Button type="submit" size="md" disabled={pending} className="px-5">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Search
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="catalogue-filter-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          <span className="sr-only sm:not-sr-only">Filters</span>
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.65rem] text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div
        id="catalogue-filter-panel"
        className={cn(
          "mt-4 grid-cols-2 gap-3 md:grid-cols-4 lg:grid lg:grid-cols-8",
          open ? "grid" : "hidden",
        )}
      >
        <FilterSelect name="category" label="Category" defaultValue={get("category")} onChange={autoApply}>
          <NativeSelectOption value="">All categories</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c.value} value={c.value}>
              {c.label}
            </NativeSelectOption>
          ))}
        </FilterSelect>
        <FilterSelect name="size" label="Size" defaultValue={get("size")} onChange={autoApply}>
          <NativeSelectOption value="">Any size</NativeSelectOption>
          {sizes.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s}
            </NativeSelectOption>
          ))}
        </FilterSelect>
        <FilterSelect name="color" label="Color" defaultValue={get("color")} onChange={autoApply}>
          <NativeSelectOption value="">Any color</NativeSelectOption>
          {colors.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </FilterSelect>
        <FilterSelect name="availability" label="Availability" defaultValue={get("availability")} onChange={autoApply}>
          <NativeSelectOption value="">Any status</NativeSelectOption>
          <NativeSelectOption value="available">Available</NativeSelectOption>
          <NativeSelectOption value="reserved">Reserved</NativeSelectOption>
          <NativeSelectOption value="rented">Rented</NativeSelectOption>
          <NativeSelectOption value="unavailable">Unavailable</NativeSelectOption>
        </FilterSelect>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            Rental date
          </Label>
          <Input id="filter-from" name="from" type="date" min={today} max={maxDate} defaultValue={get("from")} onChange={autoApply} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            Return date
          </Label>
          <Input id="filter-to" name="to" type="date" min={get("from") || today} max={maxDate} defaultValue={get("to")} onChange={autoApply} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-min" className="text-xs text-muted-foreground">
            Price (₱)
          </Label>
          <div className="flex items-center gap-1.5">
            <Input id="filter-min" name="min" type="number" inputMode="numeric" min={0} placeholder="Min" defaultValue={get("min")} aria-label="Minimum price" />
            <Input name="max" type="number" inputMode="numeric" min={0} placeholder="Max" defaultValue={get("max")} aria-label="Maximum price" />
          </div>
        </div>
        <FilterSelect name="sort" label="Sort by" defaultValue={get("sort")} onChange={autoApply}>
          <NativeSelectOption value="">Newest</NativeSelectOption>
          <NativeSelectOption value="price-asc">Price: low to high</NativeSelectOption>
          <NativeSelectOption value="price-desc">Price: high to low</NativeSelectOption>
          <NativeSelectOption value="name">Name</NativeSelectOption>
        </FilterSelect>
      </div>

      {activeCount > 0 || get("q") ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => startTransition(() => router.push("/catalogue", { scroll: false }))}
          >
            <X aria-hidden /> Clear all filters
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function FilterSelect({
  name,
  label,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { name: string; label: string }) {
  const id = `filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect id={id} name={name} className="w-full" {...props}>
        {children}
      </NativeSelect>
    </div>
  );
}
