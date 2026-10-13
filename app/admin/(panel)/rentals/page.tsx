import type { Metadata } from "next";
import { BookingsTable } from "@/components/admin/bookings-table";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LIST_SELECT, type BookingListRow } from "@/lib/data/admin";
import { shopToday } from "@/lib/dates";

export const metadata: Metadata = { title: "Active Rentals" };

export default async function RentalsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(BOOKING_LIST_SELECT)
    .eq("status", "rented")
    .order("rental_end");
  const rows = (data ?? []) as unknown as BookingListRow[];
  const today = shopToday();
  const overdue = rows.filter((r) => r.rental_end < today).length;

  return (
    <>
      <PageHeader
        title="Active Rentals"
        description={`${rows.length} ${rows.length === 1 ? "outfit is" : "outfits are"} out with customers${
          overdue > 0 ? ` · ${overdue} overdue` : ""
        }. Sorted by return date.`}
      />
      <BookingsTable
        rows={rows}
        today={today}
        emptyTitle="No active rentals"
        emptyDescription="Bookings appear here once they are marked as rented."
      />
    </>
  );
}
