// All rental and fitting dates are calendar dates ("YYYY-MM-DD") in the shop's
// timezone. They are handled as strings + UTC math so nothing shifts by a day
// between the server, the database and the customer's browser.

export const SHOP_TIMEZONE = "Asia/Manila";

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return format(parse(value)) === value;
}

/** Today's date in the shop's timezone. Request-time only (reads the clock). */
export function shopToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: string): number {
  return parse(date).getUTCDay();
}

export function endOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return format(new Date(Date.UTC(y, m, 0)));
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Calendar grid for a "YYYY-MM" month: weeks of 7 cells, null = padding. */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const last = endOfMonth(first);
  const cells: (string | null)[] = Array(weekday(first)).fill(null);
  cells.push(...eachDay(first, last));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const long = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const short = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
const shortYear = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "long", year: "numeric" });
const weekdayLong = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "long" });

/** "October 25, 2026" */
export function formatDate(date: string | null | undefined): string {
  return date && isISODate(date) ? long.format(parse(date)) : "—";
}

/** "Oct 25" */
export function formatDateShort(date: string | null | undefined, withYear = false): string {
  if (!date || !isISODate(date)) return "—";
  return (withYear ? shortYear : short).format(parse(date));
}

export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDateShort(from, true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDateShort(from, !sameYear)} – ${formatDateShort(to, true)}`;
}

/** "October 2026" for "2026-10" */
export function formatMonth(month: string): string {
  return monthYear.format(parse(`${month}-01`));
}

export function formatWeekday(date: string): string {
  return weekdayLong.format(parse(date));
}

/** "14:00" or "14:00:00" → "2:00 PM" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

const dateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: SHOP_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Timestamp (ISO) → "Oct 25, 2026, 2:00 PM" in shop time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTime.format(d);
}
