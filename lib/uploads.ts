// Image upload rules, shared by the browser (early feedback) and the server
// (authoritative). The storage buckets enforce the same limits a third time.

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",");
export const MAX_OUTFIT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;
export const MAX_QR_BYTES = 2 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionFor(mime: string): string {
  return EXTENSION[mime] ?? "bin";
}

/** Cheap client/server check on the declared type and size. */
export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Only JPG, PNG or WebP images are allowed.";
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxBytes) {
    return `The image must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`;
  }
  return null;
}

/**
 * Detect the real image type from the file's magic bytes. The browser-supplied
 * MIME type is attacker-controlled, so the server checks the content itself.
 */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_MIME_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
