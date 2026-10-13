import "server-only";
import { connection } from "next/server";
import { shopToday } from "@/lib/dates";

/**
 * Today's date in the shop's timezone, for Server Components.
 *
 * Reading the clock is only allowed at request time. `connection()` marks the
 * component as request-time, so this is safe even when Next.js prerenders a
 * page ahead of a navigation (where `searchParams` and cached data are already
 * available and nothing else would have deferred the render).
 */
export async function getShopToday(): Promise<string> {
  await connection();
  return shopToday();
}
