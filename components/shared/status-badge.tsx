import { cn } from "@/lib/utils";
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_TONE,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  FITTING_STATUS_LABEL,
  FITTING_STATUS_TONE,
  OUTFIT_STATUS_LABEL,
  OUTFIT_STATUS_TONE,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type Tone,
} from "@/lib/constants";
import type {
  AvailabilityStatus,
  BookingStatus,
  FittingStatus,
  OutfitStatus,
  PaymentState,
  PaymentStatus,
} from "@/lib/types";

// Tones stay inside the beige/burgundy family; green and amber are muted so
// they read as status, not as a second brand colour.
const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  muted: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary text-primary-foreground",
  info: "border-primary/25 bg-accent text-primary-dark",
  warning: "border-warning/30 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <ToneBadge tone={BOOKING_STATUS_TONE[status]}>{BOOKING_STATUS_LABEL[status]}</ToneBadge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <ToneBadge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</ToneBadge>;
}

/** Overall payment standing of a booking (Unpaid, Partially Paid, Paid…). */
export function PaymentStateBadge({ state }: { state: PaymentState }) {
  return <ToneBadge tone={PAYMENT_STATE_TONE[state]}>{PAYMENT_STATE_LABEL[state]}</ToneBadge>;
}

export function FittingStatusBadge({ status }: { status: FittingStatus }) {
  return <ToneBadge tone={FITTING_STATUS_TONE[status]}>{FITTING_STATUS_LABEL[status]}</ToneBadge>;
}

export function OutfitStatusBadge({ status }: { status: OutfitStatus }) {
  return <ToneBadge tone={OUTFIT_STATUS_TONE[status]}>{OUTFIT_STATUS_LABEL[status]}</ToneBadge>;
}

export function AvailabilityBadge({
  status,
  className,
}: {
  status: AvailabilityStatus;
  className?: string;
}) {
  return (
    <ToneBadge tone={AVAILABILITY_TONE[status]} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {AVAILABILITY_LABEL[status]}
    </ToneBadge>
  );
}
