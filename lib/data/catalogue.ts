import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS } from "@/lib/constants";
import type { AvailabilityRange, Category, FittingSlot, PublicOutfit } from "@/lib/types";

// Public catalogue reads. Outfit data changes rarely, so it is cached and
// invalidated by tag whenever staff edit the catalogue. Availability and
// fitting slots are NEVER cached — they must reflect bookings in real time.

const OUTFIT_COLUMNS = `
  id, category_id, name, slug, description, rental_price, status, is_featured, created_at,
  category:categories ( id, name, slug ),
  images:outfit_images ( id, url, alt, is_primary, sort_order ),
  variants:outfit_variants ( id, size, color, quantity )
`;

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL"];

/** XS < S < M < L < XL, then numeric sizes (38 < 40), then anything else A–Z. */
export function compareSizes(a: string, b: string): number {
  const rank = (size: string) => {
    const i = SIZE_ORDER.indexOf(size.trim().toUpperCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.catalogue);

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, sort_order, is_active")
    .order("sort_order")
    .order("name");
  return (data ?? []) as Category[];
}

/** Every non-archived outfit with its category, images and active variants. */
export async function getOutfits(): Promise<PublicOutfit[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.catalogue);

  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as unknown as PublicOutfit[]).map((o) => ({
    ...o,
    rental_price: Number(o.rental_price),
    images: [...(o.images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    ),
    variants: [...(o.variants ?? [])].sort(
      (a, b) => compareSizes(a.size, b.size) || a.color.localeCompare(b.color),
    ),
  }));
}

export async function getOutfitBySlug(slug: string): Promise<PublicOutfit | null> {
  const outfits = await getOutfits();
  return outfits.find((o) => o.slug === slug) ?? null;
}

/** Live, anonymised bookings/blocks between two dates (uncached). */
export async function getAvailability(
  from: string,
  to: string,
  outfitId?: string,
): Promise<AvailabilityRange[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_availability", {
    p_from: from,
    p_to: to,
    p_outfit_id: outfitId ?? null,
  });
  if (error) {
    console.error("get_availability failed:", error.message);
    return [];
  }
  return (data ?? []) as AvailabilityRange[];
}

/** Live fitting slots for a day (uncached). */
export async function getFittingSlots(date: string): Promise<FittingSlot[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_fitting_slots", { p_date: date });
  if (error) {
    console.error("get_fitting_slots failed:", error.message);
    return [];
  }
  return ((data ?? []) as FittingSlot[]).map((s) => ({
    slot_time: s.slot_time.slice(0, 5),
    remaining: s.remaining,
  }));
}
