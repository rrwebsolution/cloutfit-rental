import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/data/admin";
import { ADMIN_PAGE_SIZE, BLOCKING_STATUSES } from "@/lib/constants";
import { formatDateShort, shopToday } from "@/lib/dates";
import type { BookingStatus, Customer } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

type Row = Customer & { bookings: { status: BookingStatus; rental_start: string }[] };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const q = searchTerm(params.q);

  let query = supabase
    .from("customers")
    .select("*, bookings ( status, rental_start )", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,mobile.ilike.%${q}%`);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const today = shopToday();

  return (
    <>
      <PageHeader title="Customer Records" description="Everyone who has reserved an outfit or requested a fitting." />
      <Toolbar searchPlaceholder="Search name, email or mobile…" />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={q ? "No customer matches your search." : "Customer records are created automatically with their first booking."}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Full name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-center">Total rentals</TableHead>
                <TableHead className="text-center">Upcoming</TableHead>
                <TableHead>Customer since</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const rentals = c.bookings.filter((b) => ["rented", "returned", "completed"].includes(b.status)).length;
                const upcoming = c.bookings.filter(
                  (b) => BLOCKING_STATUSES.includes(b.status) && b.status !== "rented" && b.rental_start >= today,
                ).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link href={`/admin/customers/${c.id}`} className="hover:text-primary">
                        {c.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.mobile}</TableCell>
                    <TableCell className="max-w-52 truncate">{c.address || "—"}</TableCell>
                    <TableCell className="text-center">{rentals}</TableCell>
                    <TableCell className="text-center">{upcoming}</TableCell>
                    <TableCell>{formatDateShort(c.created_at.slice(0, 10), true)}</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Link href={`/admin/customers/${c.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))}
          total={total}
          label="customers"
          hrefFor={(p) => withParams("/admin/customers", params, { page: p })}
        />
      </div>
    </>
  );
}
