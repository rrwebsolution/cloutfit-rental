import { eachDay } from "@/lib/dates";
import type { AvailabilityRange, AvailabilityStatus, PublicOutfit } from "@/lib/types";

// Pure helpers that turn the anonymised ranges returned by the database
// function `get_availability` into what the UI shows. These are for DISPLAY
// only — the binding check always happens in the database (create_booking).

type Variant = PublicOutfit["variants"][number];

const overlaps = (r: AvailabilityRange, from: string, to: string) =>
  r.date_from <= to && r.date_to >= from;

function isBlocked(outfitId: string, ranges: AvailabilityRange[], from: string, to: string) {
  return ranges.some(
    (r) =>
      r.kind === "blocked" &&
      (r.outfit_id === null || r.outfit_id === outfitId) &&
      overlaps(r, from, to),
  );
}

/** Status of one variant across a whole date range. */
export function variantStatus(
  outfitId: string,
  variant: Variant,
  ranges: AvailabilityRange[],
  from: string,
  to: string,
): AvailabilityStatus {
  if (isBlocked(outfitId, ranges, from, to)) return "unavailable";
  const taken = ranges.filter(
    (r) => r.kind !== "blocked" && r.variant_id === variant.id && overlaps(r, from, to),
  );
  if (taken.length < variant.quantity) return "available";
  return taken.some((r) => r.kind === "rented") ? "rented" : "reserved";
}

/** Status of an outfit: available if any of the given variants is free. */
export function outfitStatus(
  outfit: Pick<PublicOutfit, "id" | "status">,
  variants: Variant[],
  ranges: AvailabilityRange[],
  from: string,
  to: string,
): AvailabilityStatus {
  if (outfit.status !== "active" || variants.length === 0) return "unavailable";
  const statuses = variants.map((v) => variantStatus(outfit.id, v, ranges, from, to));
  if (statuses.includes("available")) return "available";
  if (statuses.includes("rented")) return "rented";
  if (statuses.includes("reserved")) return "reserved";
  return "unavailable";
}

/** Per-day status map for a calendar. */
export function dayStatuses(
  outfit: Pick<PublicOutfit, "id" | "status">,
  variants: Variant[],
  ranges: AvailabilityRange[],
  from: string,
  to: string,
): Record<string, AvailabilityStatus> {
  const out: Record<string, AvailabilityStatus> = {};
  for (const day of eachDay(from, to)) {
    out[day] = outfitStatus(outfit, variants, ranges, day, day);
  }
  return out;
}
