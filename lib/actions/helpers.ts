import "server-only";
import type { z } from "zod";
import { AuthError, assertStaff, type Staff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation";
import type { Permission } from "@/lib/permissions";
import type { ActionResult } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Ctx = { staff: Staff; supabase: Supabase };

export const ok = <T = undefined>(message: string, data?: T): ActionResult<T> => ({
  ok: true,
  message,
  data,
});
export const fail = <T = undefined>(message: string, errors?: Record<string, string>): ActionResult<T> => ({
  ok: false,
  message,
  fieldErrors: errors,
});

const DB_MESSAGES: Record<string, string> = {
  UNAVAILABLE: "That outfit is already booked for one or more of those dates.",
  SLOT_UNAVAILABLE: "That fitting slot is already full. Please choose another time.",
  NOT_FOUND: "That record no longer exists.",
};

/** Translate a PostgREST/Postgres error into something a staff member can act on. */
export function dbError(error: { message?: string; code?: string; details?: string | null }): string {
  if (error.message && DB_MESSAGES[error.message]) return DB_MESSAGES[error.message];
  if (error.code === "23505") return "A record with those details already exists.";
  if (error.code === "23503") return "This record is used elsewhere and cannot be removed.";
  if (error.code === "42501") return "You do not have permission to do that.";
  console.error("Admin action database error:", error);
  return "Something went wrong. Please try again.";
}

/**
 * Wrapper for every admin Server Action: re-verifies the signed-in staff
 * member (and optional permission) on the server, then runs the action with a
 * Supabase client that carries their session — so RLS applies and the status
 * timeline records who made each change.
 */
export async function staffAction<T = undefined>(
  permission: Permission | undefined,
  run: (ctx: Ctx) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const staff = await assertStaff(permission);
    const supabase = await createClient();
    return await run({ staff, supabase });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Admin action failed:", error);
    return fail("Something went wrong. Please try again.");
  }
}

/** Parse input with a zod schema, returning either data or a ready ActionResult. */
export function parse<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { data: z.infer<S>; error?: undefined } | { data?: undefined; error: ActionResult<never> } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  return { error: fail("Please check the highlighted fields.", fieldErrors(result.error)) };
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
