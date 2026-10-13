"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarX, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/shared/form-field";
import { fetchFittingSlots } from "@/lib/actions/public";
import { formatTime, formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FittingSlot } from "@/lib/types";

/**
 * Date + time picker for fittings. Slots come from the server (opening hours,
 * blocked days and existing appointments), and full slots are not offered.
 */
export function FittingSlotPicker({
  date,
  time,
  onChange,
  minDate,
  maxDate,
  error,
  idPrefix = "fitting",
}: {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  minDate: string;
  maxDate: string;
  error?: string;
  idPrefix?: string;
}) {
  const [slots, setSlots] = useState<FittingSlot[] | null>(null);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await fetchFittingSlots(date);
      if (!cancelled) setSlots(result);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const open = (slots ?? []).filter((s) => s.remaining > 0);
  const dateId = `${idPrefix}-date`;

  return (
    <div className="grid gap-5">
      <Field id={dateId} label="Fitting date" required className="max-w-xs">
        <Input
          type="date"
          min={minDate}
          max={maxDate}
          value={date}
          onChange={(e) => {
            setSlots(null);
            onChange({ date: e.target.value, time: "" });
          }}
          {...fieldAria(dateId)}
        />
      </Field>

      {date ? (
        <fieldset aria-busy={loading}>
          <legend className="mb-2 text-sm font-medium text-foreground">
            Available times
            <span className="font-normal text-muted-foreground"> · {formatWeekday(date)}</span>
          </legend>
          {loading || slots === null ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Checking available times…
            </p>
          ) : open.length === 0 ? (
            <p className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-surface/60 p-4 text-sm text-muted-foreground">
              <CalendarX className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              No fitting slots are open on this day. Please choose another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {open.map((slot) => (
                <button
                  key={slot.slot_time}
                  type="button"
                  aria-pressed={slot.slot_time === time}
                  onClick={() => onChange({ date, time: slot.slot_time })}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    slot.slot_time === time
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:border-primary/50",
                  )}
                >
                  {formatTime(slot.slot_time)}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
