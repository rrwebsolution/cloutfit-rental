import type { Metadata } from "next";
import { BookingsTable } from "@/components/admin/bookings-table";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LIST_SELECT, type BookingListRow } from "@/lib/data/admin";
import { addDays, shopToday } from "@/lib/dates";

export const metadata: Metadata = { title: "Returns" };

export default async function ReturnsPage() {
  await requireStaff();
  const supabase = await createClient();
  const today = shopToday();

  const [{ data: due }, { data: returned }] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_LIST_SELECT)
      .eq("status", "rented")
      .lte("rental_end", addDays(today, 7))
      .order("rental_end"),
    supabase
      .from("bookings")
      .select(BOOKING_LIST_SELECT)
      .eq("status", "returned")
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);
  const dueRows = (due ?? []) as unknown as BookingListRow[];
  const returnedRows = (returned ?? []) as unknown as BookingListRow[];
  const overdue = dueRows.filter((r) => r.rental_end < today).length;

  return (
    <>
      <PageHeader
        title="Returns"
        description={`Outfits due back within 7 days${overdue > 0 ? ` · ${overdue} overdue` : ""}.`}
      />
      <h2 className="mb-3 font-heading text-xl">Due &amp; overdue</h2>
      <BookingsTable
        rows={dueRows}
        today={today}
        emptyTitle="Nothing due back this week"
        emptyDescription="Rented outfits appear here as their return date approaches."
      />

      <h2 className="mt-10 mb-3 font-heading text-xl">Returned — ready to complete</h2>
      <BookingsTable
        rows={returnedRows}
        today={today}
        emptyTitle="No returned outfits waiting"
        emptyDescription="After inspecting a returned outfit, mark its booking as completed."
      />
    </>
  );
}
