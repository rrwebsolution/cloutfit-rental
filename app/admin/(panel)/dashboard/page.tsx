import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClockOff,
  BadgeCheck,
  Banknote,
  CalendarCheck,
  CalendarClock,
  HandCoins,
  PackageCheck,
  Ruler,
  Scale,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { CalendarGrid, CalendarLegend } from "@/components/admin/calendar-grid";
import { PageHeader, Panel, PanelEmpty, StatCard } from "@/components/admin/page-header";
import {
  BookingStatusBadge,
  FittingStatusBadge,
  PaymentStatusBadge,
  ToneBadge,
} from "@/components/shared/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { outfitStatus } from "@/lib/availability";
import { dayStart, getCalendarEvents } from "@/lib/data/admin";
import { ACTIVE_FITTING_STATUSES, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import {
  addDays,
  diffDays,
  endOfMonth,
  formatDate,
  formatDateRange,
  formatDateShort,
  formatDateTime,
  formatMonth,
  formatTime,
  shopToday,
} from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import { flattenParams } from "@/components/shared/pagination";
import type {
  AvailabilityRange,
  AvailabilityStatus,
  BookingStatus,
  FittingStatus,
  OutfitStatus,
  PaymentState,
  PaymentStatus,
  PaymentType,
} from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const UPCOMING: BookingStatus[] = ["pending", "awaiting_payment", "payment_submitted", "reserved", "for_fitting", "confirmed"];

type BookingLite = {
  id: string;
  reference: string;
  customer_name: string;
  rental_start: string;
  rental_end: string;
  status: BookingStatus;
  created_at: string;
  items: { outfit_name: string }[];
};
const BOOKING_LITE = "id, reference, customer_name, rental_start, rental_end, status, created_at, items:booking_items ( outfit_name )";

export default async function DashboardPage({ searchParams }: PageProps<"/admin/dashboard">) {
  const staff = await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const today = shopToday();
  const month = today.slice(0, 7);
  const count = { count: "exact" as const, head: true };

  const [
    todaysReservations,
    todaysFittings,
    upcomingRentals,
    activeRentals,
    overdueReturns,
    pendingPayments,
    totalCustomers,
    { data: fees },
    { data: balances },
    { data: paidToday },
    { data: recentBookings },
    { data: upcomingFittings },
    { data: recentPayments },
    { data: rentedNow },
    { data: outfits },
    { data: ranges },
    events,
  ] = await Promise.all([
    supabase.from("bookings").select("id", count).gte("created_at", dayStart(today)).lt("created_at", dayStart(addDays(today, 1))),
    supabase.from("fitting_appointments").select("id", count).eq("appointment_date", today).in("status", ACTIVE_FITTING_STATUSES),
    supabase.from("bookings").select("id", count).in("status", UPCOMING).gte("rental_start", today).lte("rental_start", addDays(today, 7)),
    supabase.from("bookings").select("id", count).eq("status", "rented"),
    supabase.from("bookings").select("id", count).eq("status", "rented").lt("rental_end", today),
    supabase.from("payments").select("id", count).eq("status", "submitted"),
    supabase.from("customers").select("id", count),
    supabase.from("payments").select("amount").eq("payment_type", "reservation_fee").eq("status", "verified").limit(10000),
    // Balances of bookings that are still live (cancelled ones owe nothing).
    supabase.from("booking_payment_summary").select("balance, payment_state").neq("booking_status", "cancelled").limit(10000),
    // Money actually received today: verified/collected today, any method.
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "verified")
      .in("payment_type", ["reservation_fee", "rental", "partial_payment", "final_payment"])
      .gte("verified_at", dayStart(today))
      .lt("verified_at", dayStart(addDays(today, 1)))
      .limit(10000),
    supabase.from("bookings").select(BOOKING_LITE).order("created_at", { ascending: false }).limit(6),
    supabase
      .from("fitting_appointments")
      .select("id, booking_id, appointment_date, start_time, status, customer:customers ( full_name ), outfit:outfits ( name )")
      .in("status", ACTIVE_FITTING_STATUSES)
      .gte("appointment_date", today)
      .order("appointment_date")
      .order("start_time")
      .limit(6),
    supabase
      .from("payments")
      .select("id, amount, payment_type, method, status, created_at, booking:bookings ( id, reference, customer_name )")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("bookings").select(BOOKING_LITE).eq("status", "rented").order("rental_end").limit(8),
    supabase
      .from("outfits")
      .select("id, name, status, variants:outfit_variants ( id, size, color, quantity, is_active )")
      .neq("status", "archived"),
    supabase.rpc("get_availability", { p_from: today, p_to: today }),
    getCalendarEvents(supabase, `${month}-01`, endOfMonth(today)),
  ]);

  // Sum in whole centavos so peso totals never pick up floating-point noise.
  const sumPesos = (rows: { amount?: number; balance?: number }[] | null, key: "amount" | "balance") =>
    (rows ?? []).reduce((sum, r) => sum + Math.round(Number(r[key]) * 100), 0) / 100;
  const feesCollected = sumPesos(fees as { amount: number }[] | null, "amount");
  const balanceRows = (balances ?? []) as { balance: number; payment_state: PaymentState }[];
  const outstanding = sumPesos(balanceRows, "balance");
  const paymentsToday = sumPesos(paidToday as { amount: number }[] | null, "amount");
  const fullyPaid = balanceRows.filter((r) => r.payment_state === "paid" || r.payment_state === "overpaid").length;
  const recent = (recentBookings ?? []) as unknown as BookingLite[];
  const rented = (rentedNow ?? []) as unknown as BookingLite[];
  const fittings = (upcomingFittings ?? []) as unknown as {
    id: string;
    booking_id: string | null;
    appointment_date: string;
    start_time: string;
    status: FittingStatus;
    customer: { full_name: string } | null;
    outfit: { name: string } | null;
  }[];
  const payments = (recentPayments ?? []) as unknown as {
    id: string;
    amount: number;
    payment_type: PaymentType;
    method: string;
    status: PaymentStatus;
    created_at: string;
    booking: { id: string; reference: string; customer_name: string } | null;
  }[];

  // Availability overview: where every outfit stands today.
  const tally: Record<AvailabilityStatus, number> = { available: 0, reserved: 0, rented: 0, unavailable: 0 };
  for (const o of (outfits ?? []) as unknown as {
    id: string;
    status: OutfitStatus;
    variants: { id: string; size: string; color: string; quantity: number; is_active: boolean }[];
  }[]) {
    tally[outfitStatus(o, o.variants.filter((v) => v.is_active), (ranges ?? []) as AvailabilityRange[], today, today)]++;
  }
  const totalOutfits = Object.values(tally).reduce((a, b) => a + b, 0);
  const overdue = overdueReturns.count ?? 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${staff.full_name.split(" ")[0] || "there"}`}
        description={`${formatDate(today)} · Here is what is happening at the shop.`}
      />

      {params.denied ? (
        <p role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          That page is limited to administrators.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Reservations" value={todaysReservations.count ?? 0} icon={CalendarCheck} href="/admin/bookings" hint="New bookings today" />
        <StatCard label="Today's Fittings" value={todaysFittings.count ?? 0} icon={Ruler} href={`/admin/fittings?date=${today}`} />
        <StatCard label="Upcoming Rentals" value={upcomingRentals.count ?? 0} icon={CalendarClock} href="/admin/bookings?view=reservations" hint="Pickups in the next 7 days" />
        <StatCard label="Active Rentals" value={activeRentals.count ?? 0} icon={PackageCheck} href="/admin/rentals" />
        <StatCard label="Overdue Returns" value={overdue} icon={AlarmClockOff} href="/admin/returns" tone={overdue > 0 ? "alert" : "default"} />
        <StatCard label="Pending Verification" value={pendingPayments.count ?? 0} icon={Banknote} href="/admin/payments?view=transactions&status=submitted" hint="QR / online payments to review" />
        <StatCard label="Reservation Fees Collected" value={formatPeso(feesCollected)} icon={HandCoins} href="/admin/payments?type=reservation_fee" />
        <StatCard label="Total Customers" value={totalCustomers.count ?? 0} icon={Users} href="/admin/customers" />
        <StatCard label="Outstanding Balance" value={formatPeso(outstanding)} icon={Scale} href="/admin/payments?state=partially_paid" hint="Still owed across active bookings" />
        <StatCard label="Payments Today" value={formatPeso(paymentsToday)} icon={Wallet} href="/admin/payments?view=transactions" hint="Verified or collected today" />
        <StatCard label="Fully Paid Bookings" value={fullyPaid} icon={BadgeCheck} href="/admin/payments?state=paid" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Recent bookings" action={{ href: "/admin/bookings", label: "View all" }} className="xl:col-span-2">
          {recent.length === 0 ? (
            <PanelEmpty>No bookings yet. They will appear here as customers reserve.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 text-sm">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                      {b.reference}
                    </Link>
                    <span className="text-foreground"> · {b.customer_name}</span>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.items.map((i) => i.outfit_name).join(", ")} · {formatDateRange(b.rental_start, b.rental_end)}
                    </p>
                  </div>
                  <BookingStatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Availability overview" action={{ href: "/admin/availability", label: "Manage" }}>
          {totalOutfits === 0 ? (
            <PanelEmpty>Add outfits to see availability.</PanelEmpty>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Today: ${tally.available} available, ${tally.reserved} reserved, ${tally.rented} rented, ${tally.unavailable} unavailable`}>
                <span className="bg-success/70" style={{ width: `${(tally.available / totalOutfits) * 100}%` }} />
                <span className="bg-warning/60" style={{ width: `${(tally.reserved / totalOutfits) * 100}%` }} />
                <span className="bg-primary" style={{ width: `${(tally.rented / totalOutfits) * 100}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {(
                  [
                    ["Available", tally.available, "bg-success/70"],
                    ["Reserved", tally.reserved, "bg-warning/60"],
                    ["Rented", tally.rented, "bg-primary"],
                    ["Unavailable", tally.unavailable, "bg-muted-foreground/40"],
                  ] as const
                ).map(([label, value, dot]) => (
                  <div key={label} className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-heading text-2xl text-primary-dark">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">{totalOutfits} outfits in the catalogue · status for today</p>
            </>
          )}
        </Panel>

        <Panel title="Upcoming fittings" action={{ href: "/admin/fittings", label: "View all" }}>
          {fittings.length === 0 ? (
            <PanelEmpty>No upcoming fittings.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {fittings.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">
                      {f.appointment_date === today ? "Today" : formatDateShort(f.appointment_date)} · {formatTime(f.start_time)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.customer?.full_name ?? "Customer"}
                      {f.outfit ? ` · ${f.outfit.name}` : ""}
                    </p>
                  </div>
                  <FittingStatusBadge status={f.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent payments" action={{ href: "/admin/payments", label: "View all" }}>
          {payments.length === 0 ? (
            <PanelEmpty>No payments yet.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">
                      {formatPeso(p.amount)} · {PAYMENT_TYPE_LABEL[p.payment_type]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.booking ? (
                        <Link href={`/admin/bookings/${p.booking.id}`} className="text-primary hover:underline">
                          {p.booking.reference}
                        </Link>
                      ) : null}
                      {p.booking ? ` · ${p.booking.customer_name} · ` : ""}
                      {formatDateTime(p.created_at)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Active rentals & upcoming returns" action={{ href: "/admin/returns", label: "Returns" }}>
          {rented.length === 0 ? (
            <PanelEmpty>No outfits are out right now.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {rented.map((b) => {
                const days = diffDays(today, b.rental_end);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-sm">
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.reference}
                      </Link>
                      <span className="text-foreground"> · {b.customer_name}</span>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.items.map((i) => i.outfit_name).join(", ")} · due {formatDateShort(b.rental_end)}
                      </p>
                    </div>
                    <ToneBadge tone={days < 0 ? "danger" : days <= 1 ? "warning" : "neutral"}>
                      {days < 0 ? `${-days}d overdue` : days === 0 ? "Due today" : `In ${days}d`}
                    </ToneBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={`Booking calendar · ${formatMonth(month)}`} action={{ href: "/admin/calendar", label: "Open calendar" }} className="xl:col-span-3">
          <div className="mx-auto max-w-2xl">
            <CalendarGrid month={month} events={events} today={today} dayHref={(d) => `/admin/calendar?month=${month}&day=${d}`} compact />
            <div className="mt-4">
              <CalendarLegend />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
