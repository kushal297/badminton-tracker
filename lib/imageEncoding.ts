export type Encoding = { ext: "webp" | "jpg"; contentType: "image/webp" | "image/jpeg" };

/** Maps the type of an encoded canvas blob to the file extension and Content-Type to upload it as. */
export function pickEncoding(blobType: string): Encoding {
  return blobType === "image/webp"
    ? { ext: "webp", contentType: "image/webp" }
    : { ext: "jpg", contentType: "image/jpeg" };
}

/** True when the WebP attempt produced no usable WebP blob (null, or Safari's silent PNG), so JPEG should be tried. */
export function needsJpegFallback(blob: { type: string } | null): boolean {
  return !blob || blob.type !== "image/webp";
}
