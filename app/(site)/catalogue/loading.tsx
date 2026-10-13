import { CatalogueFiltersSkeleton, CatalogueGridSkeleton } from "@/components/site/skeletons";

export default function Loading() {
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
        <CatalogueFiltersSkeleton />
      </div>
      <CatalogueGridSkeleton />
    </div>
  );
}
