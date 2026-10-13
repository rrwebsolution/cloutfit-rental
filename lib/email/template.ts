// Branded HTML email. Table layout + inline styles only, so it renders the
// same in Gmail, Outlook and mobile clients.

const COLORS = {
  background: "#F5EBDD",
  surface: "#FFF9F0",
  primary: "#9E1B32",
  primaryDark: "#701225",
  text: "#3A1D22",
  muted: "#7A5458",
  border: "#E4CFC3",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailImage = { url: string; alt: string };

export type EmailContent = {
  /** Short line shown in the inbox preview. */
  preview: string;
  heading: string;
  /** Photo shown under the heading (e.g. the booked outfit). Must be a public https URL. */
  image?: EmailImage | null;
  /** Plain-text paragraphs (escaped for you). */
  intro?: string[];
  /** Label/value pairs rendered as a summary table. */
  rows?: [label: string, value: string][];
  cta?: { label: string; url: string };
  outro?: string[];
  businessName: string;
  footer?: string;
};

export function renderEmail(c: EmailContent): string {
  const paragraphs = (lines: string[] | undefined) =>
    (lines ?? [])
      .map(
        (line) =>
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${COLORS.text};">${escapeHtml(line)}</p>`,
      )
      .join("");

  const rows = (c.rows ?? [])
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid ${COLORS.border};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};vertical-align:top;width:42%;">${escapeHtml(label)}</td>
          <td style="padding:11px 0;border-bottom:1px solid ${COLORS.border};font-size:15px;color:${COLORS.text};font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  // Fixed width + height attributes keep the layout stable while the photo
  // loads, and Outlook ignores CSS sizing without them.
  const image =
    c.image && /^https:\/\//.test(c.image.url)
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
          <tr><td align="center">
            <img src="${escapeHtml(c.image.url)}" alt="${escapeHtml(c.image.alt)}" width="210" height="280" style="display:block;width:210px;height:280px;object-fit:cover;border-radius:14px;border:1px solid ${COLORS.border};background:${COLORS.background};">
            <div style="margin-top:8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(c.image.alt)}</div>
          </td></tr>
        </table>`
      : "";

  const cta = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;">
        <tr><td style="border-radius:999px;background:${COLORS.primary};">
          <a href="${escapeHtml(c.cta.url)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:${COLORS.surface};text-decoration:none;border-radius:999px;">${escapeHtml(c.cta.label)}</a>
        </td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(c.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding:6px 0 22px;">
        <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.04em;color:${COLORS.primary};">${escapeHtml(c.businessName)}</div>
        <div style="margin-top:6px;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:${COLORS.muted};">Elegant &middot; Premium &middot; Modern</div>
      </td></tr>
      <tr><td style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:18px;padding:34px 30px;">
        <h1 style="margin:0 0 18px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;font-weight:600;color:${COLORS.primaryDark};">${escapeHtml(c.heading)}</h1>
        ${image}
        ${paragraphs(c.intro)}
        ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;border-top:1px solid ${COLORS.border};">${rows}</table>` : ""}
        ${cta}
        ${c.outro?.length ? `<div style="margin-top:20px;">${paragraphs(c.outro)}</div>` : ""}
      </td></tr>
      <tr><td align="center" style="padding:22px 16px 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">
        ${escapeHtml(c.footer ?? "")}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Plain-text version of an email built by `renderEmail`. Sending both parts
 * (text + HTML) is what normal mail clients do; HTML-only messages are more
 * likely to be filed as spam.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    // The hidden inbox-preview line would otherwise be duplicated at the top.
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]+>/g, "").trim()}: ${href}`)
    .replace(/<img\s[^>]*alt="([^"]*)"[^>]*>/gi, "")
    .replace(/<\/td>\s*<td[^>]*>/gi, ": ")
    .replace(/<\/(p|div|tr|h1|h2|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1].trim() !== ""))
    .join("\n")
    .trim();
}
