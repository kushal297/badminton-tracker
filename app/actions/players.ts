"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { playerNameSchema } from "@/lib/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateNames() {
  for (const path of ["/", "/players", "/stats", "/insights", "/beers", "/sessions"]) {
    revalidatePath(path, "layout");
  }
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong. Try again.";
}

export async function addPlayer(name: string): Promise<ActionResult> {
  const parsed = playerNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a name" };
  try {
    const supabase = await createSupabaseServerClient();
    const res = await supabase.from("players").insert({ name: parsed.data });
    if (res.error) {
      if (res.error.code === "23505") return { ok: false, error: "That name is already taken" };
      throw res.error;
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidateNames();
  return { ok: true };
}

export async function renamePlayer(id: string, name: string): Promise<ActionResult> {
  const parsed = playerNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a name" };
  try {
    const supabase = await createSupabaseServerClient();
    const res = await supabase.from("players").update({ name: parsed.data }).eq("id", id);
    if (res.error) {
      if (res.error.code === "23505") return { ok: false, error: "That name is already taken" };
      throw res.error;
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidateNames();
  return { ok: true };
}

export async function setPlayerActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const res = await supabase.from("players").update({ is_active: isActive }).eq("id", id);
    if (res.error) throw res.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidateNames();
  return { ok: true };
}

/**
 * Persist a player's avatar photo URL after the browser uploads the image to
 * Storage. Avatars surface on the home, players, stats and insights views, so
 * those are revalidated by layout.
 */
export async function savePlayerPhotoUrl(playerId: string, url: string): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const res = await supabase.from("players").update({ photo_url: url }).eq("id", playerId);
    if (res.error) throw res.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidateNames();
  return { ok: true };
}
