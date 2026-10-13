import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { OutfitDetailSkeleton } from "@/components/site/skeletons";
import { AvailabilityBadge } from "@/components/shared/status-badge";
import { OutfitBookingPanel } from "@/components/site/outfit-booking-panel";
import { OutfitCard } from "@/components/site/outfit-card";
import { OutfitGallery } from "@/components/site/outfit-gallery";
import { outfitStatus } from "@/lib/availability";
import { getAvailability, getOutfitBySlug, getOutfits } from "@/lib/data/catalogue";
import { getSettings } from "@/lib/settings";
import { addDays, addMonths, endOfMonth, isISODate } from "@/lib/dates";
import { getShopToday } from "@/lib/today";
import { formatPeso } from "@/lib/format";

type Props = PageProps<"/outfits/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return { title: "Outfit not found" };
  return {
    title: outfit.name,
    description:
      outfit.description.slice(0, 155) ||
      `Rent the ${outfit.name} from ${formatPeso(outfit.rental_price)}. Check availability and reserve online.`,
    openGraph: { images: outfit.images[0] ? [outfit.images[0].url] : [] },
  };
}

export default function OutfitPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<OutfitDetailSkeleton />}>
      <OutfitContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OutfitContent({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [outfit, settings, all] = await Promise.all([getOutfitBySlug(slug), getSettings(), getOutfits()]);
  if (!outfit) notFound();

  const today = await getShopToday();
  const maxDate = addDays(today, settings.booking_window_days);
  // Load the current month plus the next two; later months load on demand.
  const loadedTo = endOfMonth(`${addMonths(today.slice(0, 7), 2)}-01`);
  const ranges = await getAvailability(today, loadedTo, outfit.id);

  const from = isISODate(sp.from) && sp.from >= today ? sp.from : null;
  const to = from && isISODate(sp.to) && sp.to >= from ? sp.to : null;
  const todayStatus = outfitStatus(outfit, outfit.variants, ranges, today, today);
  const colors = [...new Set(outfit.variants.map((v) => v.color))];
  const sizes = [...new Set(outfit.variants.map((v) => v.size))];
  const related = all
    .filter((o) => o.id !== outfit.id && o.category_id === outfit.category_id && o.status === "active")
    .slice(0, 4);
  const policies = settings.rental_policies.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="container-page py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/catalogue" className="hover:text-primary">
          Catalogue
        </Link>
        {outfit.category ? (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/catalogue?category=${outfit.category.slug}`} className="hover:text-primary">
              {outfit.category.name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground" aria-current="page">
          {outfit.name}
        </span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <OutfitGallery images={outfit.images} name={outfit.name} />
        </div>

        <div>
          <p className="eyebrow">{outfit.category?.name ?? "Collection"}</p>
          <h1 className="mt-3 font-heading text-4xl leading-tight sm:text-5xl">{outfit.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p>
              <span className="font-heading text-3xl text-primary">{formatPeso(outfit.rental_price)}</span>
              <span className="text-sm text-muted-foreground"> / rental · up to {settings.max_rental_days} days</span>
            </p>
            <AvailabilityBadge status={todayStatus} />
          </div>

          {outfit.description ? (
            <p className="mt-6 leading-relaxed whitespace-pre-line text-foreground/85">{outfit.description}</p>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-5 text-sm">
            <div>
              <dt className="text-xs tracking-[0.18em] text-muted-red uppercase">Sizes</dt>
              <dd className="mt-1 font-medium">{sizes.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.18em] text-muted-red uppercase">Colors</dt>
              <dd className="mt-1 font-medium">{colors.join(", ") || "—"}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <OutfitBookingPanel
              outfit={outfit}
              initialRanges={ranges}
              today={today}
              loadedTo={loadedTo}
              maxDate={maxDate}
              maxRentalDays={settings.max_rental_days}
              initialRange={{ from, to }}
            />
          </div>

          <section className="mt-8 rounded-2xl border border-border bg-surface/70 p-5" aria-labelledby="policies-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="policies-heading" className="font-heading text-lg">
                Rental policies
              </h2>
              <p className="text-sm font-medium text-primary">
                {formatPeso(settings.reservation_fee)} Reservation Fee
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
              {policies.slice(0, 3).map((line) => (
                <li key={line}>{line.replace(/^[•\-*]\s*/, "")}</li>
              ))}
            </ul>
            <Link href="/rental-policies" className="link-underline mt-4 inline-block text-sm font-medium">
              Read all rental policies
            </Link>
          </section>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-20" aria-labelledby="related-heading">
          <p className="eyebrow">You may also like</p>
          <h2 id="related-heading" className="section-title mt-3">
            More from {outfit.category?.name ?? "the collection"}
          </h2>
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((o) => (
              <OutfitCard key={o.id} outfit={o} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

