import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { CACHE_TAGS, PAYMENT_QR_BUCKET } from "@/lib/constants";
import type { PaymentMethod, PublicPaymentMethod } from "@/lib/types";

/** Public URL of a QR image in the (public-read) payment-qr-codes bucket. */
export function qrImageUrl(path: string | null): string | null {
  if (!path || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${PAYMENT_QR_BUCKET}/${path}`;
}

/**
 * Active payment methods for the booking flow, default first. Cached and
 * shared by all visitors; saving a method in Admin → Settings invalidates it.
 * Read with the anonymous client, so RLS only ever returns active methods.
 */
export async function getPaymentMethods(): Promise<PublicPaymentMethod[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, provider, account_name, account_number, qr_image_path, instructions, is_default")
    .order("is_default", { ascending: false })
    .order("sort_order")
    .order("name");
  if (error || !data) return [];

  return (data as Omit<PaymentMethod, "is_active" | "sort_order" | "archived_at">[]).map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    account_name: m.account_name,
    account_number: m.account_number,
    instructions: m.instructions,
    is_default: m.is_default,
    qr_url: qrImageUrl(m.qr_image_path),
  }));
}
