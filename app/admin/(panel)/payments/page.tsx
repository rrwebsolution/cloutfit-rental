import type { Metadata } from "next";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-button";
import { CollectPaymentDialog } from "@/components/admin/collect-payment-dialog";
import { pesoExact } from "@/components/admin/payment-summary";
import { ProofButton } from "@/components/admin/booking-dialogs";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { PaymentStateBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { rejectPayment, verifyPayment } from "@/lib/actions/bookings";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/data/admin";
import { getPaymentMethods } from "@/lib/data/payment-methods";
import { PAYMENT_SUMMARY_COLUMNS, toPaymentSummary } from "@/lib/payments";
import { cn } from "@/lib/utils";
import {
  ADMIN_PAGE_SIZE,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
} from "@/lib/constants";
import { formatDateShort, formatDateTime, shopToday } from "@/lib/dates";
import { formatPeso, paymentMethodLabel } from "@/lib/format";
import type { BookingStatus, Payment, PaymentState, PaymentStatus, PaymentSummary, PaymentType } from "@/lib/types";

export const metadata: Metadata = { title: "Payments" };

type Row = Payment & {
  booking: { id: string; reference: string; reservation_fee: number } | null;
  customer: { id: string; full_name: string } | null;
  verifier: { full_name: string } | null;
};

type Params = Record<string, string | undefined>;

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  // "Reservation Fees" in the sidebar and the Transactions tab both list
  // individual payment transactions; the default view is one row per booking.
  const transactions = params.view === "transactions" || Boolean(params.type);
  return transactions ? <TransactionsView params={params} /> : <BalancesView params={params} />;
}

function ViewTabs({ active }: { active: "balances" | "transactions" }) {
  const tabs = [
    { id: "balances", label: "By booking", href: "/admin/payments" },
    { id: "transactions", label: "Transactions", href: "/admin/payments?view=transactions" },
  ] as const;
  return (
    <nav aria-label="Payment views" className="mb-5 inline-flex rounded-full border border-border bg-card p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab.id === active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-primary",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type BalanceRow = PaymentSummary & { reference: string; customer_id: string; customer_name: string; booking_status: BookingStatus };

/** One row per booking: what is owed, what is paid, and what is left. */
async function BalancesView({ params }: { params: Params }) {
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const q = searchTerm(params.q);
  const state = PAYMENT_STATES.includes(params.state as PaymentState) ? (params.state as PaymentState) : null;

  let query = supabase
    .from("booking_payment_summary")
    .select(`${PAYMENT_SUMMARY_COLUMNS}, reference, customer_id, customer_name, booking_status`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  if (state) query = query.eq("payment_state", state);
  // Booking reference, customer name, or any payment reference number.
  if (q) query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,payment_refs.ilike.%${q}%`);

  const [{ data, count }, { data: open }, methods, today] = await Promise.all([
    query,
    // Header totals: bookings that are still live.
    supabase
      .from("booking_payment_summary")
      .select("balance, total_paid, pending_count, payment_state")
      .not("booking_status", "in", "(cancelled)")
      .limit(5000),
    getPaymentMethods(),
    Promise.resolve(shopToday()),
  ]);
  const rows = ((data ?? []) as unknown as (Parameters<typeof toPaymentSummary>[0] & BalanceRow)[]).map((r) => ({
    ...toPaymentSummary(r),
    reference: r.reference,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    booking_status: r.booking_status,
  }));
  const total = count ?? 0;
  const live = (open ?? []) as { balance: number; total_paid: number; pending_count: number; payment_state: PaymentState }[];
  const outstanding = live.reduce((sum, r) => sum + Math.round(Number(r.balance) * 100), 0) / 100;
  const collected = live.reduce((sum, r) => sum + Math.round(Number(r.total_paid) * 100), 0) / 100;
  const pending = live.filter((r) => r.pending_count > 0).length;
  const methodOptions = methods.map((m) => ({ id: m.id, label: paymentMethodLabel(m) }));

  return (
    <>
      <PageHeader title="Payments" description="What each booking owes, has paid, and still has left to pay. Only verified payments count." />
      <ViewTabs active="balances" />

      <dl className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Outstanding balance", pesoExact(outstanding)],
          ["Total paid", pesoExact(collected)],
          ["Pending verification", `${pending} booking${pending === 1 ? "" : "s"}`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-5 py-4">
            <dt className="text-xs tracking-[0.14em] text-muted-red uppercase">{label}</dt>
            <dd className="mt-1 font-heading text-2xl text-primary-dark">{value}</dd>
          </div>
        ))}
      </dl>

      <Toolbar
        searchPlaceholder="Search customer, booking or payment reference…"
        filters={[
          {
            name: "state",
            label: "Payment status",
            all: "All payment statuses",
            options: PAYMENT_STATES.map((st) => ({ value: st, label: PAYMENT_STATE_LABEL[st] })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No bookings found"
          description={state || q ? "Nothing matches your search or filter." : "Bookings and their balances will appear here."}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total amount</TableHead>
                <TableHead className="text-right">Total paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Payment status</TableHead>
                <TableHead>Last payment</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.booking_id}>
                  <TableCell className="pl-5 font-medium">
                    <Link href={`/admin/bookings/${r.booking_id}`} className="text-primary hover:underline">
                      {r.reference}
                    </Link>
                    {r.booking_status === "cancelled" ? <span className="block text-xs text-muted-foreground">Cancelled</span> : null}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/customers/${r.customer_id}`} className="hover:text-primary">
                      {r.customer_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pesoExact(r.total_due)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pesoExact(r.total_paid)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.overpayment > 0 ? (
                      <span className="text-warning">+{pesoExact(r.overpayment)} over</span>
                    ) : (
                      <span className={r.balance > 0 ? "text-primary" : "text-success"}>{pesoExact(r.balance)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PaymentStateBadge state={r.payment_state} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_payment_at ? formatDateTime(r.last_payment_at) : "—"}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1.5">
                      {r.booking_status !== "cancelled" && (r.balance > 0 || r.fee_paid < r.reservation_fee) ? (
                        <CollectPaymentDialog
                          bookingId={r.booking_id}
                          reference={r.reference}
                          customerName={r.customer_name}
                          summary={r}
                          feeOutstanding={r.reservation_fee > 0 && r.fee_paid < r.reservation_fee}
                          methods={methodOptions}
                          today={today}
                          size="sm"
                        />
                      ) : null}
                      <Link href={`/admin/bookings/${r.booking_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        View
                      </Link>
                    </div>
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
          label="bookings"
          hrefFor={(n) => withParams("/admin/payments", params, { page: n })}
        />
      </div>
    </>
  );
}

/** Individual payment transactions (also the "Reservation Fees" view). */
async function TransactionsView({ params }: { params: Params }) {
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const feesOnly = params.type === "reservation_fee";
  const type = PAYMENT_TYPES.includes(params.type as PaymentType) ? (params.type as PaymentType) : null;
  const status = PAYMENT_STATUSES.includes(params.status as PaymentStatus) ? (params.status as PaymentStatus) : null;
  const q = searchTerm(params.q);

  let query = supabase
    .from("payments")
    .select(
      "*, booking:bookings ( id, reference, reservation_fee ), customer:customers ( id, full_name ), verifier:profiles ( full_name )",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  if (type) query = query.eq("payment_type", type);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`reference_number.ilike.%${q}%,method.ilike.%${q}%`);

  // Totals for the header, across the same type filter.
  let totals = supabase.from("payments").select("amount, status").limit(5000);
  if (type) totals = totals.eq("payment_type", type);

  const [{ data, count }, { data: totalRows }] = await Promise.all([query, totals]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const sum = (s: PaymentStatus) =>
    ((totalRows ?? []) as { amount: number; status: PaymentStatus }[])
      .filter((r) => r.status === s)
      .reduce((acc, r) => acc + Number(r.amount), 0);
  const awaiting = ((totalRows ?? []) as { status: PaymentStatus }[]).filter((r) => r.status === "submitted").length;

  return (
    <>
      <PageHeader
        title={feesOnly ? "Reservation Fees" : "Payments"}
        description={
          feesOnly ? "Reservation fees submitted by customers." : "All payments: reservation fees, rental payments and deposits."
        }
      />

      {feesOnly ? null : <ViewTabs active="transactions" />}

      <dl className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Verified", formatPeso(sum("verified"))],
          ["Awaiting verification", `${awaiting} · ${formatPeso(sum("submitted"))}`],
          ["Rejected", formatPeso(sum("rejected"))],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-5 py-4">
            <dt className="text-xs tracking-[0.14em] text-muted-red uppercase">{label}</dt>
            <dd className="mt-1 font-heading text-2xl text-primary-dark">{value}</dd>
          </div>
        ))}
      </dl>

      <Toolbar
        searchPlaceholder="Search reference number or method…"
        keep={feesOnly ? ["type"] : ["view"]}
        filters={[
          {
            name: "status",
            label: "Payment status",
            all: "All statuses",
            options: PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] })),
          },
          ...(feesOnly
            ? []
            : [
                {
                  name: "type",
                  label: "Payment type",
                  all: "All types",
                  options: PAYMENT_TYPES.map((t) => ({ value: t, label: PAYMENT_TYPE_LABEL[t] })),
                },
              ]),
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No payments found"
          description={status || q ? "Nothing matches your search or filter." : "Payments submitted by customers will appear here."}
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reservation fee</TableHead>
                <TableHead>Amount paid</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method / Ref.</TableHead>
                <TableHead>Payment date</TableHead>
                <TableHead>Date submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified by</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5 font-medium">
                    {p.booking ? (
                      <Link href={`/admin/bookings/${p.booking.id}`} className="text-primary hover:underline">
                        {p.booking.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {p.customer ? (
                      <Link href={`/admin/customers/${p.customer.id}`} className="hover:text-primary">
                        {p.customer.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{p.booking ? formatPeso(p.booking.reservation_fee) : "—"}</TableCell>
                  <TableCell className="font-medium">
                    {formatPeso(p.amount)}
                    {p.payment_type === "reservation_fee" && p.booking && Number(p.amount) < Number(p.booking.reservation_fee) ? (
                      <ToneBadge tone="danger" className="mt-1 flex">
                        Less than fee
                      </ToneBadge>
                    ) : null}
                  </TableCell>
                  <TableCell>{PAYMENT_TYPE_LABEL[p.payment_type]}</TableCell>
                  <TableCell>
                    {p.method}
                    <span className="block text-xs text-muted-foreground">{p.reference_number || "—"}</span>
                  </TableCell>
                  <TableCell>{formatDateShort(p.payment_date, true)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                    {p.rejection_reason ? (
                      <span className="mt-1 block max-w-44 text-xs whitespace-normal text-destructive">{p.rejection_reason}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.verified_at ? (
                      <>
                        {p.verifier?.full_name || "Staff"}
                        <span className="block text-muted-foreground">{formatDateTime(p.verified_at)}</span>
                        {p.verification_notes ? <span className="block max-w-44 whitespace-normal">{p.verification_notes}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1.5">
                      {p.proof_path ? <ProofButton paymentId={p.id} /> : null}
                      {p.status === "submitted" || p.status === "pending" ? (
                        <>
                          <ActionButton
                            action={verifyPayment.bind(null, p.id)}
                            size="sm"
                            variant="default"
                            reason={{ label: "Verification notes (optional)", placeholder: "e.g. Matched against the GCash statement." }}
                            confirm={{
                              title: "Verify this payment?",
                              description:
                                "Only verify after you have confirmed the money was received. The reservation is then secured and the customer is emailed.",
                              confirmLabel: "Verify Payment",
                            }}
                          >
                            Verify
                          </ActionButton>
                          <ActionButton
                            action={rejectPayment.bind(null, p.id)}
                            size="sm"
                            variant="destructive"
                            reason={{ label: "Reason (shared with the customer)", required: true }}
                            confirm={{
                              title: "Reject this payment?",
                              description: "The customer is emailed and asked to submit their payment again.",
                              confirmLabel: "Reject Payment",
                              destructive: true,
                            }}
                          >
                            Reject
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
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
          label="payments"
          hrefFor={(p) => withParams("/admin/payments", params, { page: p })}
        />
      </div>
    </>
  );
}
