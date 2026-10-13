"use server";

import { updateTag } from "next/cache";
import { dbError, fail, isUuid, ok, parse, staffAction } from "@/lib/actions/helpers";
import { blockedDateSchema, categorySchema, outfitSchema } from "@/lib/validation";
import { CACHE_TAGS, OUTFIT_IMAGE_BUCKET } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

// Catalogue management. Every write ends with `updateTag("catalogue")` so the
// cached public pages show the change immediately.

const PERMISSION = "catalogue.manage" as const;

// ---- Categories ---------------------------------------------------------------

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const parsed = parse(categorySchema, input);
    if (parsed.error) return parsed.error;

    const query = id
      ? supabase.from("categories").update(parsed.data).eq("id", id)
      : supabase.from("categories").insert(parsed.data);
    const { error } = await query;
    if (error) {
      return error.code === "23505"
        ? fail("Please check the highlighted fields.", { slug: "Another category already uses this slug." })
        : fail(dbError(error));
    }
    updateTag(CACHE_TAGS.catalogue);
    return ok(id ? "Category updated." : "Category added.");
  });
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      return fail(
        error.code === "23503"
          ? "This category still has outfits. Move or archive them first, or hide the category instead."
          : dbError(error),
      );
    }
    updateTag(CACHE_TAGS.catalogue);
    return ok("Category deleted.");
  });
}

// ---- Outfits --------------------------------------------------------------------

export async function saveOutfit(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const parsed = parse(outfitSchema, input);
    if (parsed.error) return parsed.error;
    const { variants, ...outfit } = parsed.data;

    const seen = new Set<string>();
    for (const [i, v] of variants.entries()) {
      const key = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;
      if (seen.has(key)) {
        return fail("Please check the highlighted fields.", {
          [`variants.${i}.size`]: "This size and color is listed twice.",
        });
      }
      seen.add(key);
    }

    let outfitId = id;
    if (outfitId) {
      const { error } = await supabase.from("outfits").update(outfit).eq("id", outfitId);
      if (error) {
        return error.code === "23505"
          ? fail("Please check the highlighted fields.", { slug: "Another outfit already uses this slug." })
          : fail(dbError(error));
      }
    } else {
      const { data, error } = await supabase.from("outfits").insert(outfit).select("id").single();
      if (error || !data) {
        return error?.code === "23505"
          ? fail("Please check the highlighted fields.", { slug: "Another outfit already uses this slug." })
          : fail(dbError(error ?? {}));
      }
      outfitId = data.id as string;
    }

    // Variants: update the ones kept, insert new ones, and retire removed ones.
    const { data: existing } = await supabase.from("outfit_variants").select("id").eq("outfit_id", outfitId);
    const keptIds = new Set(variants.map((v) => v.id).filter(Boolean));
    const removed = (existing ?? []).map((v) => v.id as string).filter((vid) => !keptIds.has(vid));

    for (const v of variants) {
      const row = { size: v.size, color: v.color, quantity: v.quantity, is_active: v.is_active };
      const { error } = v.id
        ? await supabase.from("outfit_variants").update(row).eq("id", v.id).eq("outfit_id", outfitId)
        : await supabase.from("outfit_variants").insert({ ...row, outfit_id: outfitId });
      if (error) return fail(`${v.size} / ${v.color}: ${dbError(error)}`);
    }
    for (const variantId of removed) {
      const { error } = await supabase.from("outfit_variants").delete().eq("id", variantId);
      // A variant with booking history cannot be deleted: hide it instead.
      if (error) await supabase.from("outfit_variants").update({ is_active: false }).eq("id", variantId);
    }

    updateTag(CACHE_TAGS.catalogue);
    return ok(id ? "Outfit saved." : "Outfit created. You can now add photos.", { id: outfitId! });
  });
}

/** Archive (soft-delete) or restore. Outfits are never hard-deleted. */
export async function setOutfitArchived(id: string, archived: boolean): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const { error } = await supabase
      .from("outfits")
      .update(
        archived
          ? { status: "archived", archived_at: new Date().toISOString(), is_featured: false }
          : { status: "active", archived_at: null },
      )
      .eq("id", id);
    if (error) return fail(dbError(error));
    updateTag(CACHE_TAGS.catalogue);
    return ok(archived ? "Outfit archived. Its booking history is kept." : "Outfit restored.");
  });
}

export async function updateVariant(
  id: string,
  patch: { quantity?: number; is_active?: boolean },
): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const update: Record<string, unknown> = {};
    if (patch.quantity !== undefined) {
      const quantity = Math.trunc(Number(patch.quantity));
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 99) return fail("Quantity must be 0–99.");
      update.quantity = quantity;
    }
    if (patch.is_active !== undefined) update.is_active = Boolean(patch.is_active);
    if (Object.keys(update).length === 0) return fail("Nothing to update.");

    const { error } = await supabase.from("outfit_variants").update(update).eq("id", id);
    if (error) return fail(dbError(error));
    updateTag(CACHE_TAGS.catalogue);
    return ok("Variant updated.");
  });
}

// ---- Images ---------------------------------------------------------------------

/**
 * Register images the browser already uploaded to Supabase Storage (staff-only
 * by storage policy). Paths are checked so a row can only point inside this
 * outfit's own folder.
 */
export async function addOutfitImages(outfitId: string, paths: string[]): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    if (!isUuid(outfitId) || !Array.isArray(paths) || paths.length === 0 || paths.length > 12) {
      return fail("No images to add.");
    }
    const valid = new RegExp(`^${outfitId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i");
    if (!paths.every((p) => typeof p === "string" && valid.test(p))) return fail("Invalid image path.");

    const { data: current } = await supabase
      .from("outfit_images")
      .select("id, is_primary, sort_order")
      .eq("outfit_id", outfitId);
    const hasPrimary = (current ?? []).some((i) => i.is_primary);
    const start = Math.max(0, ...(current ?? []).map((i) => (i.sort_order as number) + 1));
    const { data: outfit } = await supabase.from("outfits").select("name").eq("id", outfitId).single();

    const rows = paths.map((path, i) => ({
      outfit_id: outfitId,
      storage_path: path,
      url: supabase.storage.from(OUTFIT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
      alt: outfit?.name ?? "",
      is_primary: !hasPrimary && i === 0,
      sort_order: start + i,
    }));
    const { error } = await supabase.from("outfit_images").insert(rows);
    if (error) return fail(dbError(error));

    updateTag(CACHE_TAGS.catalogue);
    return ok(`${rows.length} ${rows.length === 1 ? "photo" : "photos"} added.`);
  });
}

export async function setPrimaryImage(imageId: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const { data: image } = await supabase.from("outfit_images").select("outfit_id").eq("id", imageId).single();
    if (!image) return fail("Image not found.");
    // Clear first: a unique index allows only one primary image per outfit.
    await supabase.from("outfit_images").update({ is_primary: false }).eq("outfit_id", image.outfit_id);
    const { error } = await supabase.from("outfit_images").update({ is_primary: true }).eq("id", imageId);
    if (error) return fail(dbError(error));
    updateTag(CACHE_TAGS.catalogue);
    return ok("Primary photo updated.");
  });
}

export async function deleteOutfitImage(imageId: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const { data: image } = await supabase
      .from("outfit_images")
      .select("outfit_id, storage_path, is_primary")
      .eq("id", imageId)
      .single();
    if (!image) return fail("Image not found.");

    const { error } = await supabase.from("outfit_images").delete().eq("id", imageId);
    if (error) return fail(dbError(error));
    await supabase.storage.from(OUTFIT_IMAGE_BUCKET).remove([image.storage_path]);

    if (image.is_primary) {
      const { data: next } = await supabase
        .from("outfit_images")
        .select("id")
        .eq("outfit_id", image.outfit_id)
        .order("sort_order")
        .limit(1);
      if (next?.[0]) await supabase.from("outfit_images").update({ is_primary: true }).eq("id", next[0].id);
    }
    updateTag(CACHE_TAGS.catalogue);
    return ok("Photo removed.");
  });
}

// ---- Blocked dates (availability management) ----------------------------------------

export async function addBlockedDate(input: unknown): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase, staff }) => {
    const parsed = parse(blockedDateSchema, input);
    if (parsed.error) return parsed.error;
    const v = parsed.data;
    if (v.scope === "fitting" && v.outfit_id) {
      return fail("Please check the highlighted fields.", {
        outfit_id: "Fitting blocks apply to the whole shop. Clear the outfit or choose another type.",
      });
    }
    const { error } = await supabase.from("blocked_dates").insert({
      date_from: v.date_from,
      date_to: v.date_to,
      scope: v.scope,
      outfit_id: v.outfit_id || null,
      reason: v.reason,
      created_by: staff.id,
    });
    if (error) return fail(dbError(error));
    return ok("Dates blocked.");
  });
}

export async function deleteBlockedDate(id: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) return fail(dbError(error));
    return ok("Block removed.");
  });
}
