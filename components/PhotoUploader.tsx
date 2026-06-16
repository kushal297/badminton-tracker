"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { savePlayerPhotoUrl } from "@/app/actions/players";
import type { MiniPlayer } from "@/lib/players";

const BUCKET = "player-photos";
const TARGET = 256; // longest edge, in px

/**
 * Downscale an image File to a ~256px square webp Blob on a canvas (centre-cropped
 * so avatars stay round). Throws if the file can't be decoded or encoded.
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
  if (!ctx) throw new Error("Couldn't prepare the image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET, TARGET);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't process that image.");
  return blob;
}

/**
 * The player's avatar IS the upload control: tap it to set or change the photo.
 * A small camera badge signals it's editable. Fixed width — no "Add/Change photo"
 * text button, so it never reflows the surrounding row.
 */
export function PhotoUploader({ player, size = 48 }: { player: MiniPlayer; size?: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(player.photo_url);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const blob = await downscaleToWebp(file);
      const supabase = createSupabaseBrowserClient();
      const path = `${player.id}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const res = await savePlayerPhotoUrl(player.id, url);
      if (!res.ok) throw new Error(res.error);

      setPreview(url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      aria-label={preview ? `Change ${player.name}'s photo` : `Add a photo for ${player.name}`}
      title={error ?? (preview ? "Change photo" : "Add photo")}
      className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-court focus-visible:ring-offset-1"
    >
      <span className={busy ? "opacity-50" : ""}>
        <PlayerAvatar player={{ ...player, photo_url: preview }} size={size} />
      </span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-surface text-white ${
          error ? "bg-loss" : "bg-court"
        }`}
        style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
        aria-hidden
      >
        {busy ? (
          <span className="text-[10px] leading-none">…</span>
        ) : error ? (
          <span className="text-[11px] font-bold leading-none">!</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
            <path d="M9 4 7.8 6H4.5A1.5 1.5 0 0 0 3 7.5v10A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 19.5 6h-3.3L15 4H9Zm3 4.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Zm0 1.8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
          </svg>
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </button>
  );
}
