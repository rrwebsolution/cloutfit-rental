"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * `next/image` that fills its parent, shows a soft shimmer while the file
 * downloads, then fades in. The parent fixes the size/aspect ratio, so the
 * layout never shifts when the photo arrives.
 */
export function FadeImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  // Above-the-fold (priority) photos skip the fade so they paint immediately.
  const [loaded, setLoaded] = useState(priority);
  return (
    <>
      {!loaded ? <span aria-hidden className="image-shimmer absolute inset-0" /> : null}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        // A broken image should not leave the shimmer running forever.
        onError={() => setLoaded(true)}
        // Cached images can finish before React attaches onLoad.
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        className={cn(
          "object-cover transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </>
  );
}
