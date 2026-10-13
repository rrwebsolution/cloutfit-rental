import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS } from "@/lib/constants";

/** Business configuration editable from Admin → Settings. */
export type Settings = {
  business_name: string;
  business_email: string;
  business_mobile: string;
  business_address: string;
  business_hours: string;
  reservation_fee: number;
  /** ON: the reservation fee counts toward the rental total. OFF: separate charge. */
  deduct_reservation_fee: boolean;
  payment_instructions: string;
  rental_policies: string;
  fitting_days: number[];
  fitting_open_time: string;
  fitting_close_time: string;
  fitting_duration_minutes: number;
  fitting_max_simultaneous: number;
  max_rental_days: number;
  booking_window_days: number;
  social_facebook: string;
  social_instagram: string;
  social_tiktok: string;
};

/** Private settings never sent to the public site. */
export type PrivateSettings = { notification_email: string };

export const DEFAULT_SETTINGS: Settings = {
  business_name: "Cloutfit Rental",
  business_email: "",
  business_mobile: "",
  business_address: "",
  business_hours: "",
  reservation_fee: 100,
  deduct_reservation_fee: true,
  payment_instructions: "",
  rental_policies: "",
  fitting_days: [1, 2, 3, 4, 5, 6],
  fitting_open_time: "10:00",
  fitting_close_time: "18:00",
  fitting_duration_minutes: 30,
  fitting_max_simultaneous: 1,
  max_rental_days: 7,
  booking_window_days: 180,
  social_facebook: "",
  social_instagram: "",
  social_tiktok: "",
};

type Row = { key: string; value: unknown };

/** Merge raw rows over the defaults, coercing each value to its expected type. */
export function settingsFromRows(rows: Row[]): Settings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const fallback = DEFAULT_SETTINGS[key as keyof Settings];
    if (typeof fallback === "boolean") {
      if (typeof value === "boolean") out[key] = value;
      else if (value === "true" || value === "false") out[key] = value === "true";
    } else if (typeof fallback === "number") {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) {
        out[key] =
          typeof fallback[0] === "number"
            ? value.map(Number).filter(Number.isFinite)
            : value.map(String).filter(Boolean);
      }
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out as Settings;
}

/**
 * Public settings, cached and shared by every visitor. Admin → Settings calls
 * `updateTag("settings")` on save, so edits show up immediately.
 */
export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);

  const supabase = createPublicClient();
  if (!supabase) return DEFAULT_SETTINGS;
  const { data, error } = await supabase.from("system_settings").select("key, value");
  if (error || !data) return DEFAULT_SETTINGS;
  return settingsFromRows(data as Row[]);
}
