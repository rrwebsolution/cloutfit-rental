"use client";

import Image from "next/image";
import { useState } from "react";
import { OutfitImage } from "@/components/shared/outfit-image";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; alt: string };

export function OutfitGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      <OutfitImage
        key={current?.id ?? "placeholder"}
        src={current?.url}
        alt={current?.alt || name}
        priority
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="aspect-[3/4] w-full flex-1 animate-in rounded-3xl border border-border shadow-soft duration-500 fade-in"
      />
      {images.length > 1 ? (
        <ul className="flex gap-2.5 overflow-x-auto pb-1 sm:w-20 sm:flex-col sm:overflow-y-auto sm:pb-0" aria-label="Outfit photos">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  "relative block aspect-[3/4] w-16 overflow-hidden rounded-xl border-2 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-full",
                  i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
