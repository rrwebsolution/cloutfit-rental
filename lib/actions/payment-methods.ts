"use server";

import { updateTag } from "next/cache";
import { dbError, fail, isUuid, ok, parse, staffAction } from "@/lib/actions/helpers";
import { paymentMethodSchema } from "@/lib/validation";
import { CACHE_TAGS, PAYMENT_QR_BUCKET } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

// Payment methods decide where customers send money, so every action here
// requires the admin-only "settings.manage" permission (and the database
// enforces the same rule through Row Level Security).

const PERMISSION = "settings.manage" as const;

type Supabase = Parameters<Parameters<typeof staffAction>[1]>[0]["supabase"];

/** Only one method may be the default: clear the flag before setting it. */
async function clearDefault(supabase: Supabase, exceptId?: string) {
  let query = supabase.from("payment_methods").update({ is_default: false }).eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

export async function savePaymentMethod(id: string | null, input: unknown): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    const parsed = parse(paymentMethodSchema, input);
    if (parsed.error) return parsed.error;
    const values = parsed.data;

    let previousQr: string | null = null;
    if (id) {
      if (!isUuid(id)) return fail("Invalid request.");
      const { data: existing } = await supabase
        .from("payment_methods")
        .select("qr_image_path")
        .eq("id", id)
        .maybeSingle();
      if (!existing) return fail("That payment method no longer exists.");
      previousQr = existing.qr_image_path as string | null;
    }

    // The server, not the browser, decides when a method becomes the default
    // automatically: an active method does when no other default exists.
    if (values.is_active && !values.is_default) {
      let existing = supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("is_default", true);
      if (id) existing = existing.neq("id", id);
      const { count } = await existing;
      if ((count ?? 0) === 0) values.is_default = true;
    }
    if (values.is_default) await clearDefault(supabase, id ?? undefined);

    const row = { ...values, archived_at: null };
    const { error } = id
      ? await supabase.from("payment_methods").update(row).eq("id", id)
      : await supabase.from("payment_methods").insert(row);
    if (error) return fail(dbError(error));

    // The QR was replaced or removed: delete the old image from storage.
    if (previousQr && previousQr !== values.qr_image_path) {
      await supabase.storage.from(PAYMENT_QR_BUCKET).remove([previousQr]);
    }

    updateTag(CACHE_TAGS.settings);
    return ok(id ? "Payment method updated." : "Payment method added.");
  });
}

export async function setPaymentMethodActive(id: string, active: boolean): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    if (!isUuid(id)) return fail("Invalid request.");
    const { error } = await supabase
      .from("payment_methods")
      // A disabled method cannot stay the default.
      .update(active ? { is_active: true, archived_at: null } : { is_active: false, is_default: false })
      .eq("id", id);
    if (error) return fail(dbError(error));
    updateTag(CACHE_TAGS.settings);
    return ok(active ? "Payment method enabled." : "Payment method disabled. Customers no longer see it.");
  });
}

export async function setDefaultPaymentMethod(id: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    if (!isUuid(id)) return fail("Invalid request.");
    await clearDefault(supabase, id);
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_default: true, is_active: true, archived_at: null })
      .eq("id", id);
    if (error) return fail(dbError(error));
    updateTag(CACHE_TAGS.settings);
    return ok("Default payment method updated.");
  });
}

/**
 * Delete a method that was never used. One that already has payments is
 * archived instead, so past payments keep pointing at a real record.
 */
export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  return staffAction(PERMISSION, async ({ supabase }) => {
    if (!isUuid(id)) return fail("Invalid request.");
    const { data: method } = await supabase
      .from("payment_methods")
      .select("qr_image_path")
      .eq("id", id)
      .maybeSingle();
    if (!method) return fail("That payment method no longer exists.");

    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) {
      if (error.code !== "23503") return fail(dbError(error));
      const archived = await supabase
        .from("payment_methods")
        .update({ is_active: false, is_default: false, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (archived.error) return fail(dbError(archived.error));
      updateTag(CACHE_TAGS.settings);
      return ok("This method has payment history, so it was archived instead of deleted.");
    }

    if (method.qr_image_path) {
      await supabase.storage.from(PAYMENT_QR_BUCKET).remove([method.qr_image_path as string]);
    }
    updateTag(CACHE_TAGS.settings);
    return ok("Payment method deleted.");
  });
}
