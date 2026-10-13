import { Skeleton } from "@/components/ui/skeleton";

// Skeletons for the public site. Dimensions match the real components
// (same grid, same 3:4 image ratio), so nothing shifts when content arrives.

/** Mirrors <OutfitCard>: image, category, name, sizes, price and button. */
export function OutfitCardSkeleton() {
  return (
    <div>
      <div className="relative">
        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
        {/* availability badge */}
        <Skeleton className="absolute top-3 left-3 h-6 w-24 rounded-full bg-surface/80" />
      </div>
      <div className="px-1 pt-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2.5 h-5 w-4/5" />
        <Skeleton className="mt-2.5 h-3 w-28" />
        <div className="mt-4 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function CatalogueGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-8" role="status" aria-busy="true" aria-label="Loading outfits">
      <Skeleton className="mb-6 h-4 w-56" />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <OutfitCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Loading outfits…</span>
    </div>
  );
}

export function CatalogueFiltersSkeleton() {
  return (
    <div className="surface-card p-4 sm:p-5" aria-hidden>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="mt-4 hidden grid-cols-8 gap-3 lg:grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OutfitDetailSkeleton() {
  return (
    <div className="container-page py-8 md:py-12" role="status" aria-busy="true" aria-label="Loading outfit">
      <Skeleton className="mb-6 h-4 w-64 max-w-full" />
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-12 w-4/5" />
          <div className="mt-5 flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-12 rounded-full" />
            ))}
          </div>
          {/* availability calendar */}
          <Skeleton className="mt-6 h-[23rem] w-full rounded-2xl" />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 flex-1 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-full" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading outfit…</span>
    </div>
  );
}

/** Mirrors the booking wizard: stepper, step card, and the summary aside. */
export function BookingWizardSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" role="status" aria-busy="true" aria-label="Loading reservation form">
      <div>
        <div className="mb-8 flex items-center">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={i < 5 ? "flex flex-1 items-center" : "flex items-center"}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              {i < 5 ? <Skeleton className="mx-1.5 h-px flex-1 sm:mx-2.5" /> : null}
            </div>
          ))}
        </div>
        <div className="surface-card p-5 sm:p-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-64 max-w-full" />
          <div className="mt-6 grid gap-6 sm:grid-cols-[11rem_1fr]">
            <Skeleton className="aspect-[3/4] w-full max-w-44 rounded-2xl" />
            <div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-56 max-w-full" />
              <Skeleton className="mt-2 h-6 w-28" />
              <div className="mt-6 flex gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-12 rounded-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-between border-t border-border pt-6">
            <Skeleton className="h-12 w-24 rounded-full" />
            <Skeleton className="h-12 w-36 rounded-full" />
          </div>
        </div>
      </div>
      <div className="surface-card h-fit p-5">
        <Skeleton className="h-3 w-20" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="size-16 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mt-4 flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading reservation form…</span>
    </div>
  );
}

export function TrackFormSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-busy="true" aria-label="Loading form">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-2 h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-full" />
      <span className="sr-only">Loading form…</span>
    </div>
  );
}

export function BookingViewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading booking">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-11 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-8 grid gap-6">
        <div className="surface-card p-5 sm:p-7">
          <div className="flex justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-2 h-9 w-48" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-4 w-3/4" />
        </div>
        <div className="surface-card p-5 sm:p-7">
          <div className="flex gap-4">
            <Skeleton className="h-28 w-20 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="h-6 w-52 max-w-full" />
              <Skeleton className="mt-2 h-4 w-28" />
              <Skeleton className="mt-3 h-4 w-24" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-4 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading booking…</span>
    </div>
  );
}
