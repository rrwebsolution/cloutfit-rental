import type { Metadata } from "next";
import { BookingsTable } from "@/components/admin/bookings-table";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LIST_SELECT, searchTerm, type BookingListRow } from "@/lib/data/admin";
import { ADMIN_PAGE_SIZE, BOOKING_STATUSES, BOOKING_STATUS_LABEL } from "@/lib/constants";
import { shopToday } from "@/lib/dates";
import type { BookingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Bookings" };

// "Reservations" = bookings that are still ahead of pickup.
const RESERVATION_STATUSES: BookingStatus[] = [
  "pending",
  "awaiting_payment",
  "payment_submitted",
  "reserved",
  "for_fitting",
  "confirmed",
];

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const reservations = params.view === "reservations";
  const page = Math.max(1, Number(params.page) || 1);
  const q = searchTerm(params.q);
  const statuses = reservations ? RESERVATION_STATUSES : BOOKING_STATUSES;

  let query = supabase
    .from("bookings")
    .select(BOOKING_LIST_SELECT, { count: "exact" })
    .order(reservations ? "rental_start" : "created_at", { ascending: reservations })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);

  if (params.status && statuses.includes(params.status as BookingStatus)) {
    query = query.eq("status", params.status);
  } else if (reservations) {
    query = query.in("status", RESERVATION_STATUSES);
  }
  if (q) {
    query = query.or(
      `reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,customer_mobile.ilike.%${q}%`,
    );
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as BookingListRow[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        title={reservations ? "Reservations" : "Bookings"}
        description={
          reservations
            ? "Upcoming reservations that have not been picked up yet, soonest first."
            : "Every booking, newest first."
        }
      />
      <Toolbar
        searchPlaceholder="Search reference, name, email, mobile…"
        keep={["view"]}
        filters={[
          {
            name: "status",
            label: "Booking status",
            all: "All statuses",
            options: statuses.map((s) => ({ value: s, label: BOOKING_STATUS_LABEL[s] })),
          },
        ]}
      />
      <BookingsTable
        rows={rows}
        today={shopToday()}
        emptyDescription={
          q || params.status ? "No bookings match your search or filter." : "Bookings will appear here as customers reserve outfits."
        }
      />
      <div className="mt-5">
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))}
          total={total}
          label="bookings"
          hrefFor={(p) => withParams("/admin/bookings", params, { page: p })}
        />
      </div>
    </>
  );
}
