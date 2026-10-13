const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 100 → "₱100", 1499.5 → "₱1,499.50" */
export function formatPeso(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return peso.format(Number.isFinite(n) ? n : 0);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Digits only, so "0917 123 4567" and "+63 917-123-4567" compare equal. */
export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

/** Label stored on a payment and shown in lists, e.g. "QR Ph (GCash)". */
export function paymentMethodLabel(method: { name: string; provider: string }): string {
  return method.name.toLowerCase() === method.provider.toLowerCase()
    ? method.name
    : `${method.name} (${method.provider})`;
}
