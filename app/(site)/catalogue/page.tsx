import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CatalogueFiltersSkeleton, CatalogueGridSkeleton } from "@/components/site/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { CatalogueFilters } from "@/components/site/catalogue-filters";
import { OutfitCard } from "@/components/site/outfit-card";
import { outfitStatus } from "@/lib/availability";
import { compareSizes, getAvailability, getCategories, getOutfits } from "@/lib/data/catalogue";
import { getSettings } from "@/lib/settings";
import { addDays, formatDateRange, isISODate } from "@/lib/dates";
import { getShopToday } from "@/lib/today";
import { PAGE_SIZE } from "@/lib/constants";
import type { AvailabilityStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Browse outfits for rent. Filter by category, size, colour, price and your rental dates.",
};

type SearchParams = PageProps<"/catalogue">["searchParams"];

export default async function CataloguePage({ searchParams }: PageProps<"/catalogue">) {
  // Cached catalogue data → the heading and filter options prerender instantly.
  const [outfits, categories] = await Promise.all([getOutfits(), getCategories()]);
  const sizes = [...new Set(outfits.flatMap((o) => o.variants.map((v) => v.size)))].sort((a, b) =>
    compareSizes(a, b),
  );
  const colors = [...new Set(outfits.flatMap((o) => o.variants.map((v) => v.color)))].sort();

  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">The Collection</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Catalogue</h1>
        <p className="mt-3 text-muted-foreground">
          Choose your rental dates to see exactly what is available for your event.
        </p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<CatalogueFiltersSkeleton />}>
          <Filters
            categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
            sizes={sizes}
            colors={colors}
          />
        </Suspense>
      </div>

      <Suspense fallback={<CatalogueGridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Filters(props: { categories: { value: string; label: string }[]; sizes: string[]; colors: string[] }) {
  await connection(); // "today" must come from the request, not the build.
  const settings = await getSettings();
  const today = await getShopToday();
  return <CatalogueFilters {...props} today={today} maxDate={addDays(today, settings.booking_window_days)} />;
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const params = flattenParams(await searchParams);
  const outfits = await getOutfits();
  const today = await getShopToday();

  const from = isISODate(params.from) && params.from >= today ? params.from : today;
  const to = isISODate(params.to) && params.to >= from ? params.to : from;
  const hasDates = isISODate(params.from);
  const ranges = await getAvailability(from, to);

  const q = (params.q ?? "").trim().toLowerCase();
  const min = Number(params.min);
  const max = Number(params.max);

  const matches = outfits
    .filter((o) => {
      if (q) {
        const haystack = `${o.name} ${o.description} ${o.category?.name ?? ""} ${o.variants
          .map((v) => `${v.color} ${v.size}`)
          .join(" ")}`.toLowerCase();
        if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
      }
      if (params.category && o.category?.slug !== params.category) return false;
      if (params.min && Number.isFinite(min) && o.rental_price < min) return false;
      if (params.max && Number.isFinite(max) && o.rental_price > max) return false;
      return true;
    })
    .map((o) => {
      // Availability is judged on the variants matching the size/colour filter.
      const variants = o.variants.filter(
        (v) => (!params.size || v.size === params.size) && (!params.color || v.color === params.color),
      );
      return { outfit: o, variants, status: outfitStatus(o, variants, ranges, from, to) };
    })
    .filter(({ variants, status }) => {
      if ((params.size || params.color) && variants.length === 0) return false;
      if (params.availability && status !== (params.availability as AvailabilityStatus)) return false;
      return true;
    });

  if (params.sort === "price-asc") matches.sort((a, b) => a.outfit.rental_price - b.outfit.rental_price);
  else if (params.sort === "price-desc") matches.sort((a, b) => b.outfit.rental_price - a.outfit.rental_price);
  else if (params.sort === "name") matches.sort((a, b) => a.outfit.name.localeCompare(b.outfit.name));

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dateQuery = hasDates ? `?from=${from}&to=${to}` : "";

  return (
    <section className="mt-8" aria-label="Outfits">
      <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
        {matches.length} {matches.length === 1 ? "outfit" : "outfits"} · availability for{" "}
        <span className="font-medium text-foreground">{hasDates ? formatDateRange(from, to) : "today"}</span>
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={outfits.length === 0 ? "The collection is being prepared" : "No outfits match your filters"}
          description={
            outfits.length === 0
              ? "New pieces are on their way. Please check back soon."
              : "Try different dates, or remove a filter to see more of the collection."
          }
        >
          {outfits.length > 0 ? (
            <Link href="/catalogue" className={buttonVariants({ variant: "outline", size: "md" })}>
              Clear filters
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map(({ outfit, status }, i) => (
              <OutfitCard key={outfit.id} outfit={outfit} status={status} query={dateQuery} priority={i < 4} />
            ))}
          </div>
          <div className="mt-12">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={matches.length}
              label="outfits"
              hrefFor={(p) => withParams("/catalogue", params, { page: p })}
            />
          </div>
        </>
      )}
    </section>
  );
}

