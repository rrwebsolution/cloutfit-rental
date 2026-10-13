import Link from "next/link";
import { cn } from "@/lib/utils";
import { WEEKDAYS_SHORT } from "@/lib/constants";
import { CALENDAR_TYPES, type CalendarEvent, type CalendarEventType } from "@/lib/data/admin";
import { formatDate, monthGrid } from "@/lib/dates";

const TYPE = Object.fromEntries(CALENDAR_TYPES.map((t) => [t.type, t])) as Record<
  CalendarEventType,
  (typeof CALENDAR_TYPES)[number]
>;

/**
 * Month grid of events. `compact` shows coloured dots (dashboard); the full
 * version shows up to three labelled chips per day. Each day links to its
 * agenda via `dayHref`.
 */
export function CalendarGrid({
  month,
  events,
  today,
  selectedDay,
  dayHref,
  compact = false,
}: {
  month: string;
  events: CalendarEvent[];
  today: string;
  selectedDay?: string;
  dayHref: (date: string) => string;
  compact?: boolean;
}) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDay.get(event.date) ?? [];
    list.push(event);
    byDay.set(event.date, list);
  }

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border bg-border gap-px">
      {WEEKDAYS_SHORT.map((d) => (
        <div key={d} className="bg-muted/60 py-2 text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          {compact ? d.slice(0, 1) : d}
        </div>
      ))}
      {monthGrid(month)
        .flat()
        .map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="bg-background/60" aria-hidden />;
          const dayEvents = byDay.get(date) ?? [];
          const types = [...new Set(dayEvents.map((e) => e.type))];
          return (
            <Link
              key={date}
              href={dayHref(date)}
              scroll={false}
              aria-label={`${formatDate(date)}: ${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`}
              aria-current={date === selectedDay ? "date" : undefined}
              className={cn(
                "flex flex-col bg-card p-1.5 transition-colors hover:bg-accent/60",
                compact ? "min-h-11 items-center" : "min-h-24 sm:min-h-28",
                date === selectedDay && "bg-accent ring-2 ring-primary ring-inset",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  date === today ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
                )}
              >
                {Number(date.slice(8))}
              </span>
              {compact ? (
                <span className="mt-1 flex gap-0.5">
                  {types.map((t) => (
                    <span key={t} className={cn("size-1.5 rounded-full", TYPE[t].dot)} />
                  ))}
                </span>
              ) : (
                <span className="mt-1 flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        "hidden truncate rounded border px-1 py-0.5 text-[0.68rem] leading-tight sm:block",
                        TYPE[e.type].className,
                      )}
                    >
                      {e.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="hidden px-1 text-[0.68rem] text-muted-foreground sm:block">+{dayEvents.length - 3} more</span>
                  ) : null}
                  {/* Phones: dots instead of chips */}
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {types.map((t) => (
                      <span key={t} className={cn("size-1.5 rounded-full", TYPE[t].dot)} />
                    ))}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
    </div>
  );
}

export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {CALENDAR_TYPES.map((t) => (
        <li key={t.type} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", t.dot)} aria-hidden />
          {t.label}
        </li>
      ))}
    </ul>
  );
}
