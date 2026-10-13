import { z } from "zod";
import { isISODate } from "@/lib/dates";

// Shared by client forms (instant feedback) and Server Actions (the check
// that actually counts). Nothing from the browser is trusted without these.

const isoDate = z.string().refine(isISODate, "Enter a valid date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time.");
const uuid = z.string().uuid("Invalid selection.");

const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "Name is too long.");
const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(160);
const mobile = z
  .string()
  .trim()
  .regex(/^(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, "Enter a valid PH mobile number, e.g. 0917 123 4567.");

export const customerSchema = z.object({
  full_name: fullName,
  email,
  mobile,
  address: z.string().trim().min(5, "Enter your address.").max(300),
  notes: z.string().trim().max(1000, "Notes are too long.").default(""),
});

export const bookingSchema = customerSchema
  .extend({
    variant_id: uuid,
    rental_start: isoDate,
    rental_end: isoDate,
    fitting_date: isoDate.or(z.literal("")).default(""),
    fitting_time: time.or(z.literal("")).default(""),
  })
  .refine((v) => v.rental_end >= v.rental_start, {
    path: ["rental_end"],
    message: "Return date must be on or after the rental date.",
  })
  .refine((v) => Boolean(v.fitting_date) === Boolean(v.fitting_time), {
    path: ["fitting_time"],
    message: "Choose both a fitting date and time, or skip the fitting.",
  });

export const fittingRequestSchema = z.object({
  full_name: fullName,
  email,
  mobile,
  booking_reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CLT-\d{4}-\d{4,}$/, "Reference looks like CLT-2026-0001.")
    .or(z.literal(""))
    .default(""),
  outfit_id: uuid.or(z.literal("")).default(""),
  fitting_date: isoDate,
  fitting_time: time,
  notes: z.string().trim().max(1000).default(""),
});

export const paymentSchema = z.object({
  reference: z.string().trim().toUpperCase(),
  token: uuid,
  // The id of a configured payment method. The server looks the method up
  // itself; nothing about it (name, account) is taken from the browser.
  payment_method_id: uuid.or(z.literal("")).default(""),
  // Only used when the shop has not configured any payment method yet.
  method: z.string().trim().max(60).default(""),
  reference_number: z
    .string()
    .trim()
    .min(4, "Enter the payment reference number.")
    .max(60, "Reference number is too long."),
  amount: z.coerce
    .number({ message: "Enter the amount paid." })
    .positive("Enter the amount paid.")
    .max(1_000_000),
  payment_date: isoDate,
});

export const trackSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^CLT-\d{4}-\d{4,}$/, "Reference looks like CLT-2026-0001."),
  contact: z.string().trim().min(5, "Enter the email or mobile number used for the booking.").max(160),
});

export const contactSchema = z.object({
  full_name: fullName,
  email,
  message: z.string().trim().min(10, "Tell us a little more.").max(2000),
});

// ---- Admin ------------------------------------------------------------------

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only.")
  .max(80);

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  slug,
  description: z.string().trim().max(300).default(""),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export const variantSchema = z.object({
  id: uuid.optional(),
  size: z.string().trim().min(1, "Size is required.").max(30),
  color: z.string().trim().min(1, "Color is required.").max(40),
  quantity: z.coerce.number().int().min(0).max(99),
  is_active: z.boolean().default(true),
});

export const outfitSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(140),
  slug,
  category_id: uuid,
  description: z.string().trim().max(4000).default(""),
  rental_price: z.coerce.number({ message: "Enter a price." }).min(0).max(1_000_000),
  status: z.enum(["active", "unavailable"]),
  is_featured: z.boolean().default(false),
  internal_notes: z.string().trim().max(2000).default(""),
  variants: z.array(variantSchema).min(1, "Add at least one size/color."),
});

export const blockedDateSchema = z
  .object({
    date_from: isoDate,
    date_to: isoDate,
    scope: z.enum(["all", "rental", "fitting"]),
    outfit_id: uuid.or(z.literal("")).default(""),
    reason: z.string().trim().max(200).default(""),
  })
  .refine((v) => v.date_to >= v.date_from, {
    path: ["date_to"],
    message: "End date must be on or after the start date.",
  });

export const rescheduleBookingSchema = z
  .object({
    booking_id: uuid,
    rental_start: isoDate,
    rental_end: isoDate,
  })
  .refine((v) => v.rental_end >= v.rental_start, {
    path: ["rental_end"],
    message: "Return date must be on or after the rental date.",
  });

export const rescheduleFittingSchema = z.object({
  fitting_id: uuid,
  fitting_date: isoDate,
  fitting_time: time,
});

const money = (message: string) =>
  z.coerce
    .number({ message })
    .positive(message)
    .max(1_000_000, "That amount is too large.")
    // Whole centavos only — no fractions of a centavo.
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most two decimal places.");

export const collectPaymentSchema = z
  .object({
    booking_id: uuid,
    // Generated once per dialog, so a double click cannot charge twice.
    request_id: uuid,
    payment_type: z.enum(["auto", "reservation_fee", "deposit", "other"]).default("auto"),
    is_cash: z.boolean(),
    payment_method_id: uuid.or(z.literal("")).default(""),
    method: z.string().trim().max(60).default(""),
    amount: money("Enter an amount greater than zero."),
    cash_received: z.coerce.number().min(0).max(1_000_000).optional(),
    reference_number: z.string().trim().max(60).default(""),
    payment_date: isoDate,
    notes: z.string().trim().max(500).default(""),
  })
  .refine((p) => !p.is_cash || (p.cash_received !== undefined && p.cash_received >= p.amount), {
    path: ["cash_received"],
    message: "Insufficient cash received.",
  })
  .refine((p) => p.is_cash || p.payment_method_id !== "" || p.method.length >= 2, {
    path: ["method"],
    message: "Choose a payment method.",
  });

export const paymentMethodSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name, e.g. QR Ph.").max(60),
    provider: z.string().trim().min(1, "Enter the provider, e.g. GCash or BPI.").max(60),
    account_name: z.string().trim().max(80).default(""),
    account_number: z.string().trim().max(40).default(""),
    instructions: z.string().trim().max(1000).default(""),
    sort_order: z.coerce.number().int().min(0).max(9999).default(0),
    is_active: z.boolean().default(true),
    is_default: z.boolean().default(false),
    // Storage path of a QR image already uploaded by the admin's browser.
    qr_image_path: z
      .string()
      .regex(/^[0-9a-f-]{36}\.(jpg|png|webp)$/i, "Invalid QR image.")
      .nullable()
      .default(null),
  })
  .refine((v) => v.is_active || !v.is_default, {
    path: ["is_default"],
    message: "A disabled method cannot be the default.",
  });

export const userSchema = z.object({
  full_name: fullName,
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(72),
  role: z.enum(["admin", "staff"]),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.");
const optionalUrl = z.string().trim().url("Enter a full URL starting with https://").or(z.literal(""));

export const settingsSchema = z
  .object({
    business_name: z.string().trim().min(1, "Required.").max(80),
    business_email: z.string().trim().toLowerCase().email("Enter a valid email.").or(z.literal("")),
    business_mobile: z.string().trim().max(40),
    business_address: z.string().trim().max(300),
    business_hours: z.string().trim().max(160),
    reservation_fee: z.coerce.number({ message: "Enter an amount." }).min(0).max(100_000),
    deduct_reservation_fee: z.boolean(),
    payment_instructions: z.string().trim().max(2000),
    rental_policies: z.string().trim().max(8000),
    fitting_days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Choose at least one day."),
    fitting_open_time: hhmm,
    fitting_close_time: hhmm,
    fitting_duration_minutes: z.coerce.number().int().min(10).max(240),
    fitting_max_simultaneous: z.coerce.number().int().min(1).max(20),
    max_rental_days: z.coerce.number().int().min(1).max(60),
    booking_window_days: z.coerce.number().int().min(7).max(730),
    social_facebook: optionalUrl,
    social_instagram: optionalUrl,
    social_tiktok: optionalUrl,
    notification_email: z.string().trim().toLowerCase().email("Enter a valid email.").or(z.literal("")),
  })
  .refine((v) => v.fitting_close_time > v.fitting_open_time, {
    path: ["fitting_close_time"],
    message: "Closing time must be after opening time.",
  });

/** Flatten a ZodError into `{ field: firstMessage }` for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
