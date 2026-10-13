"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAYS_SHORT } from "@/lib/constants";
import { formatDate, formatMonth, monthGrid } from "@/lib/dates";
import type { AvailabilityStatus } from "@/lib/types";

export type DateRange = { from: string | null; to: string | null };

const STATUS_CLASS: Record<AvailabilityStatus, string> = {
  available: "bg-surface text-foreground hover:border-primary hover:bg-accent",
  reserved: "bg-warning/15 text-warning line-through decoration-warning/50",
  rented: "bg-primary/85 text-primary-foreground",
  unavailable: "bg-muted text-muted-foreground/60",
};

/**
 * Month calendar that paints each day by availability. With `onSelect` it
 * becomes a range picker: first tap = rental date, second tap = return date.
 * Unavailable days cannot be chosen, and a range cannot span one.
 */
export function AvailabilityCalendar({
  month,
  onMonthChange,
  statuses,
  today,
  minMonth,
  maxMonth,
  range,
  onSelect,
  loading = false,
}: {
  /** "YYYY-MM" */
  month: string;
  onMonthChange: (month: string) => void;
  statuses: Record<string, AvailabilityStatus>;
  today: string;
  minMonth: string;
  maxMonth: string;
  range?: DateRange;
  onSelect?: (date: string) => void;
  loading?: boolean;
}) {
  const weeks = monthGrid(month);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    onMonthChange(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Previous month"
          disabled={month <= minMonth}
          onClick={() => shift(-1)}
        >
          <ChevronLeft />
        </Button>
        <p className="font-heading text-lg text-primary-dark" aria-live="polite">
          {formatMonth(month)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Next month"
          disabled={month >= maxMonth}
          onClick={() => shift(1)}
        >
          <ChevronRight />
        </Button>
      </div>

      <div
        className={cn("grid grid-cols-7 gap-1 transition-opacity", loading && "opacity-50")}
        aria-busy={loading}
      >
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="pb-1 text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {d.slice(0, 2)}
          </div>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`pad-${i}`} aria-hidden />;
          const past = date < today;
          const status: AvailabilityStatus = past ? "unavailable" : (statuses[date] ?? "available");
          const selectable = Boolean(onSelect) && !past && status === "available";
          const isStart = range?.from === date;
          const isEnd = range?.to === date;
          const inRange = Boolean(range?.from && range?.to && date > range.from && date < range.to);
          const label = `${formatDate(date)} — ${past ? "past" : status}`;

          const className = cn(
            "flex aspect-square w-full items-center justify-center rounded-lg border border-transparent text-sm transition-colors",
            STATUS_CLASS[status],
            past && "bg-transparent text-muted-foreground/40 no-underline",
            date === today && "ring-1 ring-primary/40",
            inRange && "border-primary/20 bg-accent text-primary-dark",
            (isStart || isEnd) && "border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary",
          );

          return selectable ? (
            <button
              key={date}
              type="button"
              aria-label={label}
              aria-pressed={isStart || isEnd}
              onClick={() => onSelect?.(date)}
              className={cn(className, "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <div key={date} aria-label={label} className={className}>
              {Number(date.slice(8))}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendItem className="border border-border bg-surface" label="Available" />
        <LegendItem className="bg-warning/25" label="Reserved" />
        <LegendItem className="bg-primary/85" label="Rented" />
        <LegendItem className="bg-muted" label="Unavailable" />
      </ul>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} aria-hidden />
      {label}
    </li>
  );
}
