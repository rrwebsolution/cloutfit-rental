import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ACTIVE_FITTING_STATUSES } from "@/lib/constants";
import type {
  Booking,
  BookingItem,
  BookingStatus,
  FittingStatus,
  PaymentState,
  PaymentStatus,
  PaymentSummary,
  PaymentType,
} from "@/lib/types";

/** Exactly what a customer may see about their own booking — nothing internal. */
export type CustomerBookingView = {
  reference: string;
  access_token: string;
  status: BookingStatus;
  customer_name: string;
  customer_email: string;
  customer_mobile: string;
  customer_address: string;
  notes: string;
  rental_start: string;
  rental_end: string;
  reservation_fee: number;
  fee_status: PaymentStatus;
  total_rental: number;
  /** Totals from verified payments only. Null if the summary could not be read. */
  summary: Pick<PaymentSummary, "total_due" | "total_paid" | "balance" | "fee_deductible" | "payment_state"> | null;
  cancel_reason: string;
  created_at: string;
  items: {
    outfit_name: string;
    size: string;
    color: string;
    rental_price: number;
    slug: string | null;
    image_url: string | null;
  }[];
  fitting: {
    appointment_date: string;
    start_time: string;
    status: FittingStatus;
  } | null;
  payments: {
    id: string;
    amount: number;
    payment_type: PaymentType;
    method: string;
    reference_number: string;
    payment_date: string;
    status: PaymentStatus;
    rejection_reason: string;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raw booking row, only if the private access token matches. */
export async function findBookingByToken(reference: string, token: string): Promise<Booking | null> {
  if (!isSupabaseConfigured || !UUID.test(token)) return null;
  const { data } = await createAdminClient()
    .from("bookings")
    .select("*")
    .eq("reference", reference.trim().toUpperCase())
    .eq("access_token", token)
    .maybeSingle();
  return (data as Booking | null) ?? null;
}

export async function buildCustomerView(booking: Booking): Promise<CustomerBookingView> {
  const supabase = createAdminClient();
  const [{ data: items }, { data: fittings }, { data: payments }, { data: summaryRow }] = await Promise.all([
    supabase
      .from("booking_items")
      .select("*, outfit:outfits ( slug, status, images:outfit_images ( url, is_primary, sort_order ) )")
      .eq("booking_id", booking.id),
    supabase
      .from("fitting_appointments")
      .select("appointment_date, start_time, status")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, payment_type, method, reference_number, payment_date, status, rejection_reason")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("booking_payment_summary")
      .select("total_due, total_paid, balance, fee_deductible, payment_state")
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);

  type ItemRow = BookingItem & {
    outfit: {
      slug: string;
      status: string;
      images: { url: string; is_primary: boolean; sort_order: number }[];
    } | null;
  };
  type FittingRow = NonNullable<CustomerBookingView["fitting"]>;
  const fittingRows = (fittings ?? []) as FittingRow[];
  const fitting =
    fittingRows.find((f) => ACTIVE_FITTING_STATUSES.includes(f.status)) ?? fittingRows[0] ?? null;

  return {
    reference: booking.reference,
    access_token: booking.access_token,
    status: booking.status,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    customer_mobile: booking.customer_mobile,
    customer_address: booking.customer_address,
    notes: booking.notes,
    rental_start: booking.rental_start,
    rental_end: booking.rental_end,
    reservation_fee: Number(booking.reservation_fee),
    fee_status: booking.fee_status,
    total_rental: Number(booking.total_rental),
    summary: summaryRow
      ? {
          total_due: Number(summaryRow.total_due),
          total_paid: Number(summaryRow.total_paid),
          balance: Number(summaryRow.balance),
          fee_deductible: Boolean(summaryRow.fee_deductible),
          payment_state: summaryRow.payment_state as PaymentState,
        }
      : null,
    cancel_reason: booking.cancel_reason,
    created_at: booking.created_at,
    items: ((items ?? []) as ItemRow[]).map((i) => {
      const images = [...(i.outfit?.images ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
      );
      return {
        outfit_name: i.outfit_name,
        size: i.size,
        color: i.color,
        rental_price: Number(i.rental_price),
        slug: i.outfit && i.outfit.status !== "archived" ? i.outfit.slug : null,
        image_url: images[0]?.url ?? null,
      };
    }),
    fitting: fitting
      ? {
          appointment_date: fitting.appointment_date,
          start_time: fitting.start_time,
          status: fitting.status,
        }
      : null,
    payments: ((payments ?? []) as CustomerBookingView["payments"]).map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}
