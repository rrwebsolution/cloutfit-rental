import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { can, type Permission } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

export type Staff = Pick<Profile, "id" | "email" | "full_name" | "role">;

/**
 * The signed-in, ACTIVE staff member, or null. Verified against the Supabase
 * Auth server (not just the cookie) and deduplicated per request.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  // Read the request first so admin pages are always rendered per request,
  // never prerendered — even when Supabase is not configured yet.
  await connection();
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
  };
});

/** For pages: redirect to the login screen unless an active staff member. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

/** For pages gated by a permission (e.g. Users, Settings). */
export async function requirePermission(permission: Permission): Promise<Staff> {
  const staff = await requireStaff();
  if (!can(staff.role, permission)) redirect("/admin/dashboard?denied=1");
  return staff;
}

export class AuthError extends Error {}

/** For Server Actions: throws instead of redirecting. */
export async function assertStaff(permission?: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new AuthError("Your session has expired. Please sign in again.");
  if (permission && !can(staff.role, permission)) {
    throw new AuthError("You do not have permission to do that.");
  }
  return staff;
}
