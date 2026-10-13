import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_FITTING_STATUSES, BLOCKING_STATUSES } from "@/lib/constants";
import { eachDay, formatTime } from "@/lib/dates";
import type { Booking, BookingStatus, FittingAppointment, FittingStatus } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Make user input safe to embed in a PostgREST `or(...ilike...)` filter. */
export function searchTerm(q: string | undefined): string {
  return (q ?? "").replace(/[^\p{L}\p{N}\s@.+\-_]/gu, " ").trim().slice(0, 60);
}

/** Start of a shop-local day as a UTC timestamp, for created_at filters. */
export const dayStart = (date: string) => `${date}T00:00:00+08:00`;

export const BOOKING_LIST_SELECT = `
  id, reference, customer_id, customer_name, customer_mobile, rental_start, rental_end,
  status, reservation_fee, fee_status, total_rental, created_at,
  items:booking_items ( outfit_name, size, color ),
  fittings:fitting_appointments ( appointment_date, start_time, status )
`;

export type BookingListRow = Pick<
  Booking,
  | "id"
  | "reference"
  | "customer_id"
  | "customer_name"
  | "customer_mobile"
  | "rental_start"
  | "rental_end"
  | "status"
  | "reservation_fee"
  | "fee_status"
  | "total_rental"
  | "created_at"
> & {
  items: { outfit_name: string; size: string; color: string }[];
  fittings: Pick<FittingAppointment, "appointment_date" | "start_time" | "status">[];
};

/** The fitting to show for a booking: the active one, else the latest. */
export function primaryFitting<T extends { status: FittingStatus; appointment_date: string }>(
  fittings: T[],
): T | null {
  return (
    fittings.find((f) => ACTIVE_FITTING_STATUSES.includes(f.status)) ??
    [...fittings].sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))[0] ??
    null
  );
}

// ---- Calendar -------------------------------------------------------------------

export type CalendarEventType = "reservation" | "rental" | "fitting" | "return";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  date: string;
  title: string;
  detail: string;
  href: string;
};

export const CALENDAR_TYPES: { type: CalendarEventType; label: string; className: string; dot: string }[] = [
  {
    type: "reservation",
    label: "Reservations",
    className: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  {
    type: "rental",
    label: "Rental periods",
    className: "border-primary/20 bg-primary text-primary-foreground",
    dot: "bg-primary",
  },
  {
    type: "fitting",
    label: "Fittings",
    className: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  {
    type: "return",
    label: "Return dates",
    className: "border-primary-dark/30 bg-accent text-primary-dark",
    dot: "bg-primary-dark",
  },
];

/**
 * Everything happening between two dates:
 *  - reservation: each day of a booking that is not yet picked up
 *  - rental:      each day of a booking currently rented out
 *  - return:      the day an outfit is due back
 *  - fitting:     a fitting appointment
 */
export async function getCalendarEvents(
  supabase: Supabase,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const [{ data: bookings }, { data: fittings }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, reference, customer_name, rental_start, rental_end, status, items:booking_items ( outfit_name )")
      .in("status", BLOCKING_STATUSES)
      .lte("rental_start", to)
      .gte("rental_end", from),
    supabase
      .from("fitting_appointments")
      .select("id, booking_id, appointment_date, start_time, status, customer:customers ( full_name ), outfit:outfits ( name )")
      .in("status", ACTIVE_FITTING_STATUSES)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .order("start_time"),
  ]);

  const events: CalendarEvent[] = [];

  type BookingRow = {
    id: string;
    reference: string;
    customer_name: string;
    rental_start: string;
    rental_end: string;
    status: BookingStatus;
    items: { outfit_name: string }[];
  };
  for (const b of (bookings ?? []) as BookingRow[]) {
    const outfit = b.items.map((i) => i.outfit_name).join(", ") || "Outfit";
    const type: CalendarEventType = b.status === "rented" ? "rental" : "reservation";
    const start = b.rental_start < from ? from : b.rental_start;
    const end = b.rental_end > to ? to : b.rental_end;
    for (const date of eachDay(start, end)) {
      events.push({
        id: `${b.id}-${type}-${date}`,
        type,
        date,
        title: outfit,
        detail: `${b.reference} · ${b.customer_name}`,
        href: `/admin/bookings/${b.id}`,
      });
    }
    if (b.rental_end >= from && b.rental_end <= to) {
      events.push({
        id: `${b.id}-return`,
        type: "return",
        date: b.rental_end,
        title: `Return: ${outfit}`,
        detail: `${b.reference} · ${b.customer_name}`,
        href: `/admin/bookings/${b.id}`,
      });
    }
  }

  type FittingRow = {
    id: string;
    booking_id: string | null;
    appointment_date: string;
    start_time: string;
    customer: { full_name: string } | null;
    outfit: { name: string } | null;
  };
  for (const f of (fittings ?? []) as unknown as FittingRow[]) {
    events.push({
      id: `${f.id}-fitting`,
      type: "fitting",
      date: f.appointment_date,
      title: `Fitting: ${f.customer?.full_name ?? "Customer"}`,
      detail: `${formatTime(f.start_time)}${f.outfit ? ` · ${f.outfit.name}` : ""}`,
      href: f.booking_id ? `/admin/bookings/${f.booking_id}` : "/admin/fittings",
    });
  }

  return events;
}
