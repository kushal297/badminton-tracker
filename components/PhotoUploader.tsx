"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { savePlayerPhotoUrl } from "@/app/actions/players";

const BUCKET = "player-photos";
const TARGET = 256; // longest edge, in px

/**
 * Downscale an image File to a ~256px square-ish webp Blob on a canvas. We
 * cover-crop to a centred square so avatars stay round and consistent. Fails
 * loudly (throws) if the file can't be decoded or the canvas can't encode.
 */
async function downscaleToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file isn't a readable image.");
  });

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET;
  canvas.height = TARGET;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image. Try another browser.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET, TARGET);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Couldn't process that image. Try another one.");
  return blob;
}

export function PhotoUploader({
  playerId,
  currentUrl,
}: {
  playerId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const blob = await downscaleToWebp(file);
      const supabase = createSupabaseBrowserClient();
      const path = `${playerId}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const res = await savePlayerPhotoUrl(playerId, url);
      if (!res.ok) throw new Error(res.error);

      setPreview(url);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-court-soft text-2xl"
        aria-hidden
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          "📷"
        )}
      </span>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={working}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-court-soft disabled:opacity-60"
        >
          {working ? "Uploading…" : preview ? "Change photo" : "Add photo"}
        </button>
        {error ? <p className="mt-1.5 text-xs text-loss">{error}</p> : null}
      </div>
    </div>
  );
}
