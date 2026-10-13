export type UserRole = "admin" | "staff";
export type OutfitStatus = "active" | "unavailable" | "archived";
export type BookingStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_submitted"
  | "reserved"
  | "for_fitting"
  | "confirmed"
  | "rented"
  | "returned"
  | "completed"
  | "cancelled";
export type PaymentStatus = "pending" | "submitted" | "verified" | "rejected" | "refunded";
export type PaymentType =
  | "reservation_fee"
  | "rental"
  | "partial_payment"
  | "final_payment"
  | "deposit"
  | "other";

/** Where a booking stands overall, calculated from its payment transactions. */
export type PaymentState =
  | "unpaid"
  | "pending_verification"
  | "partially_paid"
  | "paid"
  | "overpaid"
  | "rejected"
  | "refunded";

/** One row of the `booking_payment_summary` view. Money is in pesos. */
export type PaymentSummary = {
  booking_id: string;
  total_rental: number;
  reservation_fee: number;
  /** True when the reservation fee counts toward the rental total. */
  fee_deductible: boolean;
  total_due: number;
  fee_paid: number;
  other_paid: number;
  total_paid: number;
  balance: number;
  overpayment: number;
  pending_count: number;
  last_payment_at: string | null;
  payment_state: PaymentState;
};

/** What `collect_payment` returns: everything a receipt needs. */
export type PaymentReceipt = {
  payment_id: string;
  duplicate: boolean;
  booking_reference: string;
  customer_name: string;
  amount: number;
  cash_received: number | null;
  change: number | null;
  method: string;
  payment_type: PaymentType;
  payment_date: string;
  reference_number: string;
  total_due: number;
  total_paid: number;
  balance: number;
  overpayment: number;
  payment_state: PaymentState;
};
export type FittingStatus = "pending" | "confirmed" | "rescheduled" | "completed" | "cancelled";
export type BlockedScope = "all" | "rental" | "fitting";

/** What a customer sees for an outfit on a given day or date range. */
export type AvailabilityStatus = "available" | "reserved" | "rented" | "unavailable";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  address: string;
  notes: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export type OutfitImage = {
  id: string;
  outfit_id: string;
  storage_path: string;
  url: string;
  alt: string;
  is_primary: boolean;
  sort_order: number;
};

export type OutfitVariant = {
  id: string;
  outfit_id: string;
  size: string;
  color: string;
  quantity: number;
  is_active: boolean;
};

/** Outfit as exposed to the public site (no internal notes). */
export type PublicOutfit = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  rental_price: number;
  status: OutfitStatus;
  is_featured: boolean;
  created_at: string;
  category: Pick<Category, "id" | "name" | "slug"> | null;
  images: Pick<OutfitImage, "id" | "url" | "alt" | "is_primary" | "sort_order">[];
  variants: Pick<OutfitVariant, "id" | "size" | "color" | "quantity">[];
};

export type AvailabilityRange = {
  outfit_id: string | null;
  variant_id: string | null;
  date_from: string;
  date_to: string;
  kind: "reserved" | "rented" | "blocked";
};

export type FittingSlot = { slot_time: string; remaining: number };

export type Booking = {
  id: string;
  reference: string;
  access_token: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_mobile: string;
  customer_address: string;
  rental_start: string;
  rental_end: string;
  status: BookingStatus;
  reservation_fee: number;
  fee_status: PaymentStatus;
  fee_deductible: boolean;
  total_rental: number;
  notes: string;
  internal_notes: string;
  cancel_reason: string;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingItem = {
  id: string;
  booking_id: string;
  outfit_id: string;
  variant_id: string;
  outfit_name: string;
  size: string;
  color: string;
  rental_price: number;
};

export type FittingAppointment = {
  id: string;
  booking_id: string | null;
  customer_id: string;
  outfit_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: FittingStatus;
  notes: string;
  admin_notes: string;
  created_at: string;
};

export type Payment = {
  id: string;
  booking_id: string;
  customer_id: string;
  amount: number;
  payment_type: PaymentType;
  payment_method_id: string | null;
  /** Method name as it was when the payment was made (kept for history). */
  method: string;
  verification_notes: string;
  /** Cash handed over, and the change given back (cash payments only). */
  cash_received: number | null;
  change_amount: number | null;
  reference_number: string;
  proof_path: string | null;
  payment_date: string;
  status: PaymentStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string;
  notes: string;
  created_at: string;
};

/** A way to pay (QR Ph, GCash, Maya, a bank…), managed in Admin → Settings. */
export type PaymentMethod = {
  id: string;
  name: string;
  provider: string;
  account_name: string;
  account_number: string;
  qr_image_path: string | null;
  instructions: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  archived_at: string | null;
};

/** What the customer sees of an active payment method. */
export type PublicPaymentMethod = Pick<
  PaymentMethod,
  "id" | "name" | "provider" | "account_name" | "account_number" | "instructions" | "is_default"
> & { qr_url: string | null };

export type BlockedDate = {
  id: string;
  date_from: string;
  date_to: string;
  scope: BlockedScope;
  outfit_id: string | null;
  reason: string;
  created_at: string;
};

export type StatusHistoryEntry = {
  id: string;
  booking_id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  changed_by: string | null;
  note: string;
  created_at: string;
};

export type EmailStatusRow = {
  id: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  created_at: string;
};

/** Result shape shared by every Server Action. */
export type ActionResult<T = undefined> = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};
