import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRentalReminder } from "@/lib/email/notify";
import { addDays, shopToday } from "@/lib/dates";

export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Fail closed: no secret, no cron.
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily job (see vercel.json): emails customers whose rental starts tomorrow.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const tomorrow = addDays(shopToday(), 1);
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("rental_start", tomorrow)
    .in("status", ["reserved", "for_fitting", "confirmed"])
    .is("reminder_sent_at", null)
    .limit(200);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  for (const { id } of data ?? []) {
    if (await sendRentalReminder(id as string)) {
      await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id);
      sent++;
    }
  }
  return Response.json({ ok: true, date: tomorrow, due: data?.length ?? 0, sent });
}
