import type {
  AvailabilityStatus,
  PaymentState,
  BookingStatus,
  FittingStatus,
  OutfitStatus,
  PaymentStatus,
  PaymentType,
} from "@/lib/types";

export type Tone = "neutral" | "info" | "warning" | "success" | "primary" | "danger" | "muted";

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "awaiting_payment",
  "payment_submitted",
  "reserved",
  "for_fitting",
  "confirmed",
  "rented",
  "returned",
  "completed",
  "cancelled",
];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  payment_submitted: "Payment Submitted",
  reserved: "Reserved",
  for_fitting: "For Fitting",
  confirmed: "Confirmed",
  rented: "Rented",
  returned: "Returned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, Tone> = {
  pending: "neutral",
  awaiting_payment: "warning",
  payment_submitted: "info",
  reserved: "primary",
  for_fitting: "info",
  confirmed: "success",
  rented: "primary",
  returned: "muted",
  completed: "success",
  cancelled: "danger",
};

export const BOOKING_STATUS_HELP: Record<BookingStatus, string> = {
  pending: "We received your request and will review it shortly.",
  awaiting_payment: "Pay the reservation fee to secure your outfit and dates.",
  payment_submitted: "We are verifying your reservation fee.",
  reserved: "Your outfit and dates are secured.",
  for_fitting: "Your fitting appointment is the next step.",
  confirmed: "Everything is set. See you on your rental date!",
  rented: "The outfit is with you. Enjoy your event!",
  returned: "The outfit has been returned. Thank you!",
  completed: "This booking is complete. Thank you for choosing us.",
  cancelled: "This booking was cancelled.",
};

/** Statuses in which a booking still holds its outfit (mirrors the database). */
export const BLOCKING_STATUSES: BookingStatus[] = [
  "pending",
  "awaiting_payment",
  "payment_submitted",
  "reserved",
  "for_fitting",
  "confirmed",
  "rented",
];

/** A customer may cancel on their own until the outfit is handed over. */
export const CUSTOMER_CANCELLABLE: BookingStatus[] = [
  "pending",
  "awaiting_payment",
  "payment_submitted",
  "reserved",
  "for_fitting",
  "confirmed",
];

export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "submitted", "verified", "rejected", "refunded"];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  pending: "warning",
  submitted: "info",
  verified: "success",
  rejected: "danger",
  refunded: "muted",
};

export const PAYMENT_STATES: PaymentState[] = [
  "unpaid",
  "pending_verification",
  "partially_paid",
  "paid",
  "overpaid",
  "rejected",
  "refunded",
];

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  unpaid: "Unpaid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overpaid: "Overpaid",
  rejected: "Rejected",
  refunded: "Refunded",
};

export const PAYMENT_STATE_TONE: Record<PaymentState, Tone> = {
  unpaid: "neutral",
  pending_verification: "info",
  partially_paid: "warning",
  paid: "success",
  overpaid: "primary",
  rejected: "danger",
  refunded: "muted",
};

export const PAYMENT_TYPES: PaymentType[] = [
  "reservation_fee",
  "partial_payment",
  "final_payment",
  "rental",
  "deposit",
  "other",
];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  reservation_fee: "Reservation Fee",
  rental: "Rental Payment",
  partial_payment: "Partial Payment",
  final_payment: "Final Payment",
  deposit: "Security Deposit",
  other: "Other",
};

export const FITTING_STATUSES: FittingStatus[] = [
  "pending",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
];

export const ACTIVE_FITTING_STATUSES: FittingStatus[] = ["pending", "confirmed", "rescheduled"];

export const FITTING_STATUS_LABEL: Record<FittingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FITTING_STATUS_TONE: Record<FittingStatus, Tone> = {
  pending: "warning",
  confirmed: "success",
  rescheduled: "info",
  completed: "muted",
  cancelled: "danger",
};

export const OUTFIT_STATUS_LABEL: Record<OutfitStatus, string> = {
  active: "Active",
  unavailable: "Unavailable",
  archived: "Archived",
};

export const OUTFIT_STATUS_TONE: Record<OutfitStatus, Tone> = {
  active: "success",
  unavailable: "warning",
  archived: "muted",
};

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  unavailable: "Unavailable",
};

export const AVAILABILITY_TONE: Record<AvailabilityStatus, Tone> = {
  available: "success",
  reserved: "warning",
  rented: "primary",
  unavailable: "muted",
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const PUBLIC_NAV = [
  { href: "/", label: "Home" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/fitting", label: "Book a Fitting" },
  { href: "/track-booking", label: "Track Booking" },
  { href: "/contact", label: "Contact" },
] as const;

export const PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 15;

export const OUTFIT_IMAGE_BUCKET = "outfit-images";
export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const PAYMENT_QR_BUCKET = "payment-qr-codes";

export const CACHE_TAGS = { catalogue: "catalogue", settings: "settings" } as const;
