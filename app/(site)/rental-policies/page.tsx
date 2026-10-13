import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";
import { formatPeso } from "@/lib/format";

export const metadata: Metadata = {
  title: "Rental Policies",
  description: "Reservation fee, fittings, returns and care — everything to know before you rent.",
};

export default async function RentalPoliciesPage() {
  const settings = await getSettings();
  const lines = settings.rental_policies
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <header>
        <p className="eyebrow">Good to know</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Rental policies</h1>
        <p className="mt-3 text-muted-foreground">
          Clear, simple terms so you can rent with confidence.
        </p>
      </header>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Reservation fee", formatPeso(settings.reservation_fee)],
          ["Maximum rental", `${settings.max_rental_days} days`],
          ["Book ahead", `Up to ${settings.booking_window_days} days`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card p-5">
            <dt className="text-xs tracking-[0.2em] text-muted-red uppercase">{label}</dt>
            <dd className="mt-1 font-heading text-2xl text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="surface-card mt-6 p-6 sm:p-8" aria-label="Policies">
        {lines.length > 0 ? (
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line} className="flex gap-3 leading-relaxed text-foreground/85">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{line.replace(/^[•\-*]\s*/, "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Our rental policies will be posted here soon.</p>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/catalogue" className={buttonVariants({ size: "xl" })}>
          Browse Collection
        </Link>
        <Link href="/contact" className={buttonVariants({ size: "xl", variant: "outline", className: "border-primary/40 text-primary" })}>
          Ask a Question
        </Link>
      </div>
    </div>
  );
}
