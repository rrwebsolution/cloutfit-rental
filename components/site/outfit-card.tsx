import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OutfitImage } from "@/components/shared/outfit-image";
import { AvailabilityBadge } from "@/components/shared/status-badge";
import { formatPeso } from "@/lib/format";
import type { AvailabilityStatus, PublicOutfit } from "@/lib/types";

export function OutfitCard({
  outfit,
  status,
  query = "",
  priority = false,
}: {
  outfit: PublicOutfit;
  /** Omit to hide the availability badge (e.g. on the cached landing page). */
  status?: AvailabilityStatus;
  /** Extra query string (e.g. selected dates) carried to the details page. */
  query?: string;
  priority?: boolean;
}) {
  const href = `/outfits/${outfit.slug}${query}`;
  const sizes = [...new Set(outfit.variants.map((v) => v.size))];

  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-soft transition-shadow duration-500 group-hover:shadow-lift">
        <OutfitImage
          src={outfit.images[0]?.url}
          alt={outfit.images[0]?.alt || outfit.name}
          priority={priority}
          className="aspect-[3/4]"
          imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {status ? <AvailabilityBadge status={status} className="absolute top-3 left-3 bg-surface/95 backdrop-blur" /> : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-4">
        <p className="text-[0.7rem] font-medium tracking-[0.22em] text-muted-red uppercase">
          {outfit.category?.name ?? "Collection"}
        </p>
        <h3 className="mt-1 font-heading text-lg leading-snug">
          <Link href={href} className="after:absolute after:inset-0 hover:text-primary">
            {outfit.name}
          </Link>
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {sizes.length > 0 ? `Sizes: ${sizes.join(" · ")}` : "Sizes on request"}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-foreground">
            <span className="text-lg font-semibold text-primary">{formatPeso(outfit.rental_price)}</span>
            <span className="text-xs text-muted-foreground"> / rental</span>
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            View Details
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
