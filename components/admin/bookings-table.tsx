import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { BookingStatusBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { updateBookingStatus } from "@/lib/actions/bookings";
import { primaryFitting, type BookingListRow } from "@/lib/data/admin";
import { diffDays, formatDateShort, formatTime } from "@/lib/dates";
import { formatPeso } from "@/lib/format";

/** The standard booking table, with one context-aware quick action per row. */
export function BookingsTable({
  rows,
  today,
  emptyTitle = "No bookings found",
  emptyDescription = "Bookings will appear here as customers reserve outfits.",
}: {
  rows: BookingListRow[];
  today: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardList} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="surface-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-5">Reference</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Outfit</TableHead>
            <TableHead>Rental Date</TableHead>
            <TableHead>Return Date</TableHead>
            <TableHead>Fitting</TableHead>
            <TableHead>Res. Fee</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const fitting = primaryFitting(b.fittings);
            const overdue = b.status === "rented" && b.rental_end < today;
            return (
              <TableRow key={b.id}>
                <TableCell className="pl-5 font-medium">
                  <Link href={`/admin/bookings/${b.id}`} className="text-primary hover:underline">
                    {b.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/customers/${b.customer_id}`} className="font-medium hover:text-primary">
                    {b.customer_name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{b.customer_mobile}</span>
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  {b.items.map((i) => (
                    <span key={`${i.outfit_name}-${i.size}-${i.color}`} className="block">
                      {i.outfit_name}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {i.size}, {i.color}
                      </span>
                    </span>
                  ))}
                </TableCell>
                <TableCell>{formatDateShort(b.rental_start, true)}</TableCell>
                <TableCell>
                  {formatDateShort(b.rental_end, true)}
                  {overdue ? (
                    <ToneBadge tone="danger" className="mt-1 flex">
                      {diffDays(b.rental_end, today)}d overdue
                    </ToneBadge>
                  ) : null}
                </TableCell>
                <TableCell>
                  {fitting ? (
                    <>
                      {formatDateShort(fitting.appointment_date)}
                      <span className="block text-xs text-muted-foreground">
                        {formatTime(fitting.start_time)} · {fitting.status}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{formatPeso(b.reservation_fee)}</TableCell>
                <TableCell>
                  <PaymentStatusBadge status={b.fee_status} />
                </TableCell>
                <TableCell>
                  <BookingStatusBadge status={b.status} />
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1.5">
                    <QuickAction booking={b} />
                    <Link href={`/admin/bookings/${b.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      View
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function QuickAction({ booking }: { booking: BookingListRow }) {
  const id = booking.id;
  switch (booking.status) {
    case "reserved":
    case "for_fitting":
      return (
        <ActionButton action={updateBookingStatus.bind(null, id, "confirmed")} size="sm" variant="default">
          Confirm
        </ActionButton>
      );
    case "confirmed":
      return (
        <ActionButton
          action={updateBookingStatus.bind(null, id, "rented")}
          size="sm"
          variant="default"
          confirm={{
            title: `Mark ${booking.reference} as rented?`,
            description: "Do this when the customer has claimed the outfit.",
            confirmLabel: "Mark as Rented",
          }}
        >
          Mark Rented
        </ActionButton>
      );
    case "rented":
      return (
        <ActionButton
          action={updateBookingStatus.bind(null, id, "returned")}
          size="sm"
          variant="default"
          confirm={{
            title: `Mark ${booking.reference} as returned?`,
            description: "The outfit becomes available for other dates again.",
            confirmLabel: "Mark as Returned",
          }}
        >
          Mark Returned
        </ActionButton>
      );
    case "returned":
      return (
        <ActionButton action={updateBookingStatus.bind(null, id, "completed")} size="sm" variant="default">
          Complete
        </ActionButton>
      );
    default:
      return null;
  }
}
