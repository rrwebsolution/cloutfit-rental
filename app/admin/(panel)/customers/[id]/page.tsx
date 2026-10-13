import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Mail, MapPin, Phone, Shirt, Wallet } from "lucide-react";
import { NotesForm } from "@/components/admin/notes-form";
import { PageHeader, Panel, PanelEmpty, StatCard } from "@/components/admin/page-header";
import { BookingStatusBadge, FittingStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { saveCustomerNotes } from "@/lib/actions/bookings";
import { isUuid } from "@/lib/actions/helpers";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_LIST_SELECT, type BookingListRow } from "@/lib/data/admin";
import { BLOCKING_STATUSES, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatDateRange, formatDateShort, formatTime, shopToday } from "@/lib/dates";
import { formatPeso } from "@/lib/format";
import type { Customer, FittingAppointment, Payment } from "@/lib/types";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: customerRow }, { data: bookings }, { data: fittings }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select(BOOKING_LIST_SELECT).eq("customer_id", id).order("rental_start", { ascending: false }),
    supabase
      .from("fitting_appointments")
      .select("*, outfit:outfits ( name )")
      .eq("customer_id", id)
      .order("appointment_date", { ascending: false }),
    supabase
      .from("payments")
      .select("*, booking:bookings ( id, reference )")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const customer = customerRow as Customer | null;
  if (!customer) notFound();

  const today = shopToday();
  const bookingRows = (bookings ?? []) as unknown as BookingListRow[];
  const fittingRows = (fittings ?? []) as (FittingAppointment & { outfit: { name: string } | null })[];
  const paymentRows = (payments ?? []) as (Payment & { booking: { id: string; reference: string } | null })[];
  const totalRentals = bookingRows.filter((b) => ["rented", "returned", "completed"].includes(b.status)).length;
  const upcoming = bookingRows.filter(
    (b) => BLOCKING_STATUSES.includes(b.status) && b.status !== "rented" && b.rental_start >= today,
  );
  const totalPaid = paymentRows.filter((p) => p.status === "verified").reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        title={customer.full_name}
        description={`Customer since ${formatDate(customer.created_at.slice(0, 10))}`}
        back={{ href: "/admin/customers", label: "All customers" }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total rentals" value={totalRentals} icon={Shirt} />
        <StatCard label="Upcoming rentals" value={upcoming.length} icon={CalendarCheck} />
        <StatCard label="Total paid (verified)" value={formatPeso(totalPaid)} icon={Wallet} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Booking history">
            {bookingRows.length === 0 ? (
              <PanelEmpty>No bookings yet.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {bookingRows.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.reference}
                      </Link>
                      <p className="text-foreground">{b.items.map((i) => `${i.outfit_name} (${i.size}, ${i.color})`).join(", ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDateRange(b.rental_start, b.rental_end)}</p>
                    </div>
                    <BookingStatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Payment history">
            {paymentRows.length === 0 ? (
              <PanelEmpty>No payments yet.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {paymentRows.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {formatPeso(p.amount)} · {PAYMENT_TYPE_LABEL[p.payment_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.method} · {formatDateShort(p.payment_date, true)}
                        {p.booking ? (
                          <>
                            {" · "}
                            <Link href={`/admin/bookings/${p.booking.id}`} className="text-primary hover:underline">
                              {p.booking.reference}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Contact">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-primary" aria-hidden />
                <a href={`tel:${customer.mobile}`} className="hover:text-primary">
                  {customer.mobile}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-primary" aria-hidden />
                <a href={`mailto:${customer.email}`} className="break-all hover:text-primary">
                  {customer.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {customer.address || "No address on file"}
              </li>
            </ul>
          </Panel>

          <Panel title="Notes">
            <NotesForm action={saveCustomerNotes.bind(null, customer.id)} initial={customer.notes} label="Customer notes" placeholder="Preferences, measurements, reminders…" />
          </Panel>

          <Panel title="Fitting history">
            {fittingRows.length === 0 ? (
              <PanelEmpty>No fittings yet.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {fittingRows.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <p className="font-medium text-foreground">
                        {formatDateShort(f.appointment_date, true)} · {formatTime(f.start_time)}
                      </p>
                      <p className="text-xs text-muted-foreground">{f.outfit?.name ?? "Outfit not specified"}</p>
                    </div>
                    <FittingStatusBadge status={f.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
