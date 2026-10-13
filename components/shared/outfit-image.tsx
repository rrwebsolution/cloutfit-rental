import { Shirt } from "lucide-react";
import { FadeImage } from "@/components/shared/fade-image";
import { cn } from "@/lib/utils";

/**
 * Outfit photo with an on-brand placeholder when no image has been uploaded.
 * The parent sets the size/aspect ratio; this fills it.
 */
export function OutfitImage({
  src,
  alt,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  priority = false,
  className,
  imageClassName,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      {src ? (
        <FadeImage src={src} alt={alt} sizes={sizes} priority={priority} className={imageClassName} />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_35%,#fff9f0_0%,#efe0cf_70%)] text-muted-red/70"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-border bg-surface/70">
            <Shirt className="size-6" strokeWidth={1.25} aria-hidden />
          </span>
          <span className="font-heading text-xs tracking-[0.3em] uppercase">Cloutfit</span>
        </div>
      )}
    </div>
  );
}
