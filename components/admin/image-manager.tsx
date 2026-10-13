"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { addOutfitImages, deleteOutfitImage, setPrimaryImage } from "@/lib/actions/catalogue";
import { createClient } from "@/lib/supabase/client";
import { OUTFIT_IMAGE_BUCKET } from "@/lib/constants";
import { extensionFor, IMAGE_ACCEPT, MAX_OUTFIT_IMAGE_BYTES, validateImageFile } from "@/lib/uploads";
import type { OutfitImage } from "@/lib/types";

/**
 * Outfit photo manager. Files go straight from the browser to Supabase
 * Storage using the signed-in staff session (the bucket only accepts writes
 * from staff, and enforces type and size), then get registered on the outfit.
 */
export function ImageManager({
  outfitId,
  images,
  disabled = false,
}: {
  outfitId: string;
  images: OutfitImage[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [, startTransition] = useTransition();

  const upload = async (files: File[]) => {
    const valid: File[] = [];
    for (const file of files) {
      const problem = validateImageFile(file, MAX_OUTFIT_IMAGE_BYTES);
      if (problem) toast.error(`${file.name}: ${problem}`);
      else valid.push(file);
    }
    if (valid.length === 0) return;

    const supabase = createClient();
    const paths: string[] = [];
    setProgress({ done: 0, total: valid.length });

    for (const [i, file] of valid.entries()) {
      // Server-safe path: outfit folder + random name. The original filename is not used.
      const path = `${outfitId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      const { error } = await supabase.storage
        .from(OUTFIT_IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (error) toast.error(`${file.name}: ${error.message}`);
      else paths.push(path);
      setProgress({ done: i + 1, total: valid.length });
    }

    if (paths.length > 0) {
      const result = await addOutfitImages(outfitId, paths);
      if (result.ok) toast.success(result.message);
      else {
        toast.error(result.message);
        await supabase.storage.from(OUTFIT_IMAGE_BUCKET).remove(paths);
      }
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    startTransition(() => router.refresh());
  };

  const busy = progress !== null;

  return (
    <section className="surface-card p-5 sm:p-6" aria-labelledby="photos-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="photos-heading" className="font-heading text-xl">
            Photos
          </h2>
          <p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB each. The primary photo is used on catalogue cards.</p>
        </div>
        <Button type="button" variant="outline" size="md" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          {busy ? `Uploading ${progress.done}/${progress.total}…` : "Upload photos"}
        </Button>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          aria-label="Upload outfit photos"
          onChange={(e) => upload(Array.from(e.target.files ?? []).slice(0, 12))}
        />
      </div>

      {busy ? (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      ) : null}

      {images.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
          No photos yet. Upload a few — outfits with photos get far more bookings.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-border bg-background/50">
              <div className="relative aspect-[3/4]">
                <Image src={image.url} alt={image.alt || "Outfit photo"} fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                {image.is_primary ? (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-medium text-primary-foreground">
                    <Star className="size-3 fill-current" aria-hidden /> Primary
                  </span>
                ) : null}
              </div>
              {!disabled ? (
                <div className="flex gap-1.5 p-2">
                  {!image.is_primary ? (
                    <ActionButton action={setPrimaryImage.bind(null, image.id)} size="sm" className="flex-1">
                      <Star aria-hidden /> Set primary
                    </ActionButton>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <ActionButton
                    action={deleteOutfitImage.bind(null, image.id)}
                    size="sm"
                    variant="destructive"
                    confirm={{
                      title: "Delete this photo?",
                      description: "It is removed from the website and from storage. This cannot be undone.",
                      confirmLabel: "Delete Photo",
                      destructive: true,
                    }}
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Delete photo</span>
                  </ActionButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
