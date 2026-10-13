import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CalendarGrid } from "@/components/admin/calendar-grid";
import { PageHeader, Panel, PanelEmpty } from "@/components/admin/page-header";
import { flattenParams } from "@/components/shared/pagination";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CALENDAR_TYPES, getCalendarEvents, type CalendarEventType } from "@/lib/data/admin";
import { addMonths, endOfMonth, formatDate, formatMonth, formatWeekday, isISODate, isMonth, shopToday } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const ALL_TYPES = CALENDAR_TYPES.map((t) => t.type);

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const today = shopToday();

  const day = isISODate(params.day) ? params.day : null;
  const month = isMonth(params.month) ? params.month : (day ?? today).slice(0, 7);
  const selectedDay = day && day.startsWith(month) ? day : month === today.slice(0, 7) ? today : `${month}-01`;
  const requested = (params.types ?? "").split(",").filter((t): t is CalendarEventType => ALL_TYPES.includes(t as CalendarEventType));
  const types = requested.length > 0 ? requested : ALL_TYPES;

  const all = await getCalendarEvents(supabase, `${month}-01`, endOfMonth(`${month}-01`));
  const events = all.filter((e) => types.includes(e.type));
  const agenda = events
    .filter((e) => e.date === selectedDay)
    .sort((a, b) => ALL_TYPES.indexOf(a.type) - ALL_TYPES.indexOf(b.type) || a.detail.localeCompare(b.detail));

  const href = (overrides: { month?: string; day?: string | null; types?: CalendarEventType[] }) => {
    const next = new URLSearchParams();
    const m = overrides.month ?? month;
    const d = overrides.day === undefined ? (overrides.month ? null : day) : overrides.day;
    const t = overrides.types ?? types;
    if (m !== today.slice(0, 7) || d) next.set("month", m);
    if (d) next.set("day", d);
    if (t.length < ALL_TYPES.length) next.set("types", t.join(","));
    const qs = next.toString();
    return qs ? `/admin/calendar?${qs}` : "/admin/calendar";
  };

  const toggle = (type: CalendarEventType) => {
    const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
    return href({ types: next.length === 0 ? ALL_TYPES : ALL_TYPES.filter((t) => next.includes(t)) });
  };

  return (
    <>
      <PageHeader title="Calendar" description="Reservations, rental periods, fittings and return dates in one view.">
        <Link href={href({ month: addMonths(month, -1) })} aria-label="Previous month" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
          <ChevronLeft />
        </Link>
        <p className="min-w-40 text-center font-heading text-xl text-primary-dark" aria-live="polite">
          {formatMonth(month)}
        </p>
        <Link href={href({ month: addMonths(month, 1) })} aria-label="Next month" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
          <ChevronRight />
        </Link>
        <Link href="/admin/calendar" className={buttonVariants({ variant: "outline", size: "md" })}>
          Today
        </Link>
      </PageHeader>

      {/* Event-type filter */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by event type">
        {CALENDAR_TYPES.map((t) => {
          const on = types.includes(t.type);
          return (
            <Link
              key={t.type}
              href={toggle(t.type)}
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                on ? "border-primary/30 bg-card text-foreground" : "border-border bg-transparent text-muted-foreground line-through",
              )}
            >
              <span className={cn("size-2.5 rounded-full", t.dot, !on && "opacity-30")} aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <CalendarGrid month={month} events={events} today={today} selectedDay={selectedDay} dayHref={(d) => href({ day: d })} />

        <Panel title={`${formatWeekday(selectedDay)}, ${formatDate(selectedDay)}`} className="xl:self-start">
          {agenda.length === 0 ? (
            <PanelEmpty>Nothing scheduled for this day.</PanelEmpty>
          ) : (
            <ul className="space-y-2.5">
              {agenda.map((e) => {
                const type = CALENDAR_TYPES.find((t) => t.type === e.type)!;
                return (
                  <li key={e.id}>
                    <Link href={e.href} className="flex gap-3 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:border-primary/40">
                      <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", type.dot)} aria-hidden />
                      <span className="min-w-0 text-sm">
                        <span className="block text-[0.68rem] tracking-[0.14em] text-muted-red uppercase">{type.label}</span>
                        <span className="block truncate font-medium text-foreground">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
