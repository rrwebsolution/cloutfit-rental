"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Ruler } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AvailabilityCalendar, type DateRange } from "@/components/shared/availability-calendar";
import { useAvailability } from "@/components/site/use-availability";
import { VariantPicker } from "@/components/site/variant-picker";
import { diffDays, formatDateRange, formatDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AvailabilityRange, PublicOutfit } from "@/lib/types";

/**
 * Size/colour picker + availability calendar on the outfit page. Choosing a
 * free date range enables "Reserve This Outfit". The calendar is a guide; the
 * server re-checks availability when the booking is actually created.
 */
export function OutfitBookingPanel({
  outfit,
  initialRanges,
  today,
  loadedTo,
  maxDate,
  maxRentalDays,
  initialRange,
}: {
  outfit: PublicOutfit;
  initialRanges: AvailabilityRange[];
  today: string;
  loadedTo: string;
  maxDate: string;
  maxRentalDays: number;
  initialRange: DateRange;
}) {
  const [variantId, setVariantId] = useState<string | null>(outfit.variants[0]?.id ?? null);
  const [range, setRange] = useState<DateRange>(initialRange);
  const variant = outfit.variants.find((v) => v.id === variantId) ?? null;
  const variants = useMemo(() => (variant ? [variant] : outfit.variants), [variant, outfit.variants]);

  const { month, setMonth, statuses, loading, isRangeFree } = useAvailability({
    outfit,
    variants,
    initialRanges,
    loadedFrom: today,
    loadedTo,
    initialMonth: (initialRange.from ?? today).slice(0, 7),
  });

  const bookable = outfit.status === "active" && outfit.variants.length > 0;
  const rangeValid = Boolean(range.from && range.to && isRangeFree(range.from, range.to));

  const select = (date: string) => {
    if (!range.from || range.to || date < range.from) {
      setRange({ from: date, to: null });
      return;
    }
    if (diffDays(range.from, date) + 1 > maxRentalDays) {
      toast.error(`Rentals are limited to ${maxRentalDays} days.`);
      return;
    }
    if (!isRangeFree(range.from, date)) {
      toast.error("Those dates include a day that is already booked.");
      setRange({ from: date, to: null });
      return;
    }
    setRange({ from: range.from, to: date });
  };

  const reserveHref =
    variant && range.from && range.to
      ? `/booking?outfit=${outfit.slug}&variant=${variant.id}&from=${range.from}&to=${range.to}`
      : variant
        ? `/booking?outfit=${outfit.slug}&variant=${variant.id}`
        : `/booking?outfit=${outfit.slug}`;

  return (
    <div className="grid gap-6">
      {outfit.variants.length > 0 ? (
        <VariantPicker
          variants={outfit.variants}
          selectedId={variantId}
          onSelect={(v) => {
            setVariantId(v.id);
            setRange({ from: null, to: null });
          }}
        />
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-sans text-sm font-medium text-foreground">
            <CalendarDays className="mr-1.5 inline size-4 text-primary" aria-hidden />
            Availability calendar
          </h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {range.from && range.to
              ? formatDateRange(range.from, range.to)
              : range.from
                ? `${formatDateShort(range.from)} → choose return date`
                : "Tap your rental date"}
          </p>
        </div>
        <AvailabilityCalendar
          month={month}
          onMonthChange={setMonth}
          statuses={statuses}
          today={today}
          minMonth={today.slice(0, 7)}
          maxMonth={maxDate.slice(0, 7)}
          range={range}
          onSelect={bookable ? select : undefined}
          loading={loading}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {bookable ? (
          <Link
            href={reserveHref}
            className={cn(buttonVariants({ size: "xl" }), "flex-1")}
            aria-describedby={rangeValid ? undefined : "reserve-hint"}
          >
            Reserve This Outfit
          </Link>
        ) : (
          <span className={cn(buttonVariants({ size: "xl" }), "pointer-events-none flex-1 opacity-50")} aria-disabled>
            Currently Unavailable
          </span>
        )}
        <Link
          href={`/fitting?outfit=${outfit.slug}`}
          className={cn(buttonVariants({ size: "xl", variant: "outline" }), "flex-1 border-primary/40 text-primary")}
        >
          <Ruler aria-hidden /> Schedule Fitting
        </Link>
      </div>
      {bookable && !rangeValid ? (
        <p id="reserve-hint" className="-mt-2 text-xs text-muted-foreground">
          Tip: pick your rental and return dates on the calendar first — or choose them in the next step.
        </p>
      ) : null}
    </div>
  );
}
