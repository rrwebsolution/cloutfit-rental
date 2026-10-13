import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { htmlToText } from "@/lib/email/template";
import { createAdminClient } from "@/lib/supabase/admin";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  /** Short identifier stored in email_logs, e.g. "admin.new_reservation". */
  template: string;
  bookingId?: string | null;
  replyTo?: string;
};

const DEFAULT_FROM = "Cloutfit Rental <onboarding@resend.dev>";

async function log(
  args: SendArgs,
  status: "sent" | "failed" | "skipped",
  detail: { providerId?: string; error?: string },
) {
  try {
    await createAdminClient()
      .from("email_logs")
      .insert({
        booking_id: args.bookingId ?? null,
        recipient: args.to,
        subject: args.subject,
        template: args.template,
        status,
        provider_id: detail.providerId ?? null,
        error: detail.error ?? null,
      });
  } catch (error) {
    console.error("Could not write email log:", error);
  }
}

/** Gmail SMTP is used when both variables are set; otherwise Resend. */
function gmailCredentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows app passwords in groups of four with spaces; accept either form.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  return user && pass ? { user, pass } : null;
}

let gmailTransport: Transporter | null = null;

/**
 * Send through the shop's own Gmail account. Works without owning a domain
 * and can reach any recipient (Gmail allows roughly 500 emails a day).
 */
async function sendWithGmail(args: SendArgs, credentials: { user: string; pass: string }): Promise<string> {
  gmailTransport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: credentials,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const info = await gmailTransport.sendMail({
    // Gmail always sends as the signed-in account; only the display name is ours.
    from: { name: process.env.GMAIL_FROM_NAME?.trim() || "Cloutfit Rental", address: credentials.user },
    to: args.to,
    subject: args.subject,
    text: htmlToText(args.html),
    html: args.html,
    replyTo: args.replyTo,
  });
  return info.messageId;
}

async function sendWithResend(args: SendArgs, apiKey: string): Promise<string | undefined> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: [args.to],
      subject: args.subject,
      text: htmlToText(args.html),
      html: args.html,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) throw new Error(`${response.status}: ${body.message ?? "Resend error"}`);
  return body.id;
}

/**
 * Send one transactional email and record the attempt in `email_logs`.
 * Provider: Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set, otherwise
 * Resend. NEVER throws: a failed email must not undo a booking.
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  if (!args.to) {
    await log(args, "skipped", { error: "No recipient configured." });
    return false;
  }

  const gmail = gmailCredentials();
  const resendKey = process.env.RESEND_API_KEY;
  if (!gmail && !resendKey) {
    await log(args, "skipped", { error: "No email provider configured (set GMAIL_USER + GMAIL_APP_PASSWORD, or RESEND_API_KEY)." });
    return false;
  }

  try {
    const providerId = gmail ? await sendWithGmail(args, gmail) : await sendWithResend(args, resendKey!);
    await log(args, "sent", { providerId });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log(args, "failed", { error: `${gmail ? "Gmail" : "Resend"}: ${message}`.slice(0, 500) });
    return false;
  }
}
