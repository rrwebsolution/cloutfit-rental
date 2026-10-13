"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, fail, isUuid, ok, parse, staffAction } from "@/lib/actions/helpers";
import { settingsSchema, userSchema } from "@/lib/validation";
import { CACHE_TAGS } from "@/lib/constants";
import type { ActionResult, UserRole } from "@/lib/types";

// ---- Settings (admin only) ------------------------------------------------------------

const PRIVATE_KEYS = new Set(["notification_email"]);

export async function saveSettings(input: unknown): Promise<ActionResult> {
  return staffAction("settings.manage", async ({ supabase, staff }) => {
    const parsed = parse(settingsSchema, input);
    if (parsed.error) return parsed.error;

    const rows = Object.entries(parsed.data).map(([key, value]) => ({
      key,
      value,
      is_public: !PRIVATE_KEYS.has(key),
      updated_by: staff.id,
    }));
    const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
    if (error) return fail(dbError(error));

    updateTag(CACHE_TAGS.settings);
    return ok("Settings saved.");
  });
}

// ---- Users (admin only) ----------------------------------------------------------------

export async function createUser(input: unknown): Promise<ActionResult> {
  return staffAction("users.manage", async () => {
    const parsed = parse(userSchema, input);
    if (parsed.error) return parsed.error;
    const { email, password, full_name, role } = parsed.data;

    // Creating auth users needs the service role; the caller was verified as
    // an active admin just above.
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error || !data.user) {
      const taken = /already|registered|exists/i.test(error?.message ?? "");
      return taken
        ? fail("Please check the highlighted fields.", { email: "An account with this email already exists." })
        : fail(error?.message ?? "Could not create the account.");
    }

    // The signup trigger created an inactive staff profile; activate it.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: data.user.id, email, full_name, role, is_active: true }, { onConflict: "id" });
    if (profileError) return fail(dbError(profileError));

    return ok(`${full_name} can now sign in.`);
  });
}

export async function updateUser(
  userId: string,
  patch: { role?: UserRole; is_active?: boolean },
): Promise<ActionResult> {
  return staffAction("users.manage", async ({ supabase, staff }) => {
    if (!isUuid(userId)) return fail("Invalid request.");
    if (userId === staff.id) return fail("You cannot change your own role or access.");

    const update: Record<string, unknown> = {};
    if (patch.role !== undefined) {
      if (patch.role !== "admin" && patch.role !== "staff") return fail("Invalid role.");
      update.role = patch.role;
    }
    if (patch.is_active !== undefined) update.is_active = Boolean(patch.is_active);
    if (Object.keys(update).length === 0) return fail("Nothing to update.");

    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) return fail(dbError(error));
    return ok("User updated.");
  });
}
