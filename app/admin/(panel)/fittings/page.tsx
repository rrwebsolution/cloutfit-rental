import type { Metadata } from "next";
import Link from "next/link";
import { Ruler } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FittingActions } from "@/components/admin/fitting-actions";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { FittingStatusBadge } from "@/components/shared/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { ACTIVE_FITTING_STATUSES, ADMIN_PAGE_SIZE, FITTING_STATUSES, FITTING_STATUS_LABEL } from "@/lib/constants";
import { addDays, formatDateShort, formatTime, formatWeekday, isISODate, shopToday } from "@/lib/dates";
import type { FittingAppointment, FittingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Fitting Appointments" };

type Row = FittingAppointment & {
  customer: { id: string; full_name: string; mobile: string } | null;
  outfit: { name: string } | null;
  booking: { id: string; reference: string } | null;
};

export default async function FittingsPage({ searchParams }: PageProps<"/admin/fittings">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const [supabase, settings] = await Promise.all([createClient(), getSettings()]);
  const today = shopToday();
  const page = Math.max(1, Number(params.page) || 1);
  const status = FITTING_STATUSES.includes(params.status as FittingStatus) ? (params.status as FittingStatus) : null;
  const date = isISODate(params.date) ? params.date : null;
  // Default view: what still needs attention, soonest first.
  const upcomingOnly = !status && !date;

  let query = supabase
    .from("fitting_appointments")
    .select(
      "*, customer:customers ( id, full_name, mobile ), outfit:outfits ( name ), booking:bookings ( id, reference )",
      { count: "exact" },
    )
    .order("appointment_date", { ascending: upcomingOnly || Boolean(date) })
    .order("start_time")
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (date) query = query.eq("appointment_date", date);
  if (upcomingOnly) query = query.in("status", ACTIVE_FITTING_STATUSES).gte("appointment_date", today);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        title="Fitting Appointments"
        description={
          upcomingOnly
            ? "Upcoming fittings that need attention. Use the filters to see past or cancelled ones."
            : "Filtered fitting appointments."
        }
      />
      <Toolbar
        filters={[
          {
            name: "status",
            label: "Appointment status",
            all: "Upcoming (active)",
            options: FITTING_STATUSES.map((s) => ({ value: s, label: FITTING_STATUS_LABEL[s] })),
          },
        ]}
        dateFilter={{ name: "date", label: "Appointment date" }}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No fitting appointments"
          description={upcomingOnly ? "New fitting requests from customers will appear here." : "Nothing matches these filters."}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Date &amp; time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Outfit</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="pl-5">
                    <span className="font-medium">{formatDateShort(f.appointment_date, true)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatWeekday(f.appointment_date)} · {formatTime(f.start_time)}
                      {f.appointment_date === today ? " · Today" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {f.customer ? (
                      <>
                        <Link href={`/admin/customers/${f.customer.id}`} className="font-medium hover:text-primary">
                          {f.customer.full_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{f.customer.mobile}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{f.outfit?.name ?? <span className="text-muted-foreground">Not specified</span>}</TableCell>
                  <TableCell>
                    {f.booking ? (
                      <Link href={`/admin/bookings/${f.booking.id}`} className="text-primary hover:underline">
                        {f.booking.reference}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Walk-in / none</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-56 text-xs whitespace-normal text-muted-foreground">
                    {f.notes || "—"}
                    {f.admin_notes ? <span className="block text-foreground">Staff: {f.admin_notes}</span> : null}
                  </TableCell>
                  <TableCell>
                    <FittingStatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <FittingActions
                      fittingId={f.id}
                      status={f.status}
                      today={today}
                      maxDate={addDays(today, settings.booking_window_days)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))}
          total={total}
          label="appointments"
          hrefFor={(p) => withParams("/admin/fittings", params, { page: p })}
        />
      </div>
    </>
  );
}
