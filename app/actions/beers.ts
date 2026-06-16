"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllData } from "@/lib/data";
import { computeBeers } from "@/lib/stats/beers";
import { todayISO } from "@/lib/format";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The beer board (like the rest of the app) is derived from raw rows on every
 * read, so any write to absences / clears / the rate touches every beer view.
 * Sessions are revalidated by layout because absence pills live on session pages.
 */
function revalidateBeerViews() {
  for (const path of ["/", "/beers", "/stats", "/insights"]) {
    revalidatePath(path, "layout");
  }
  revalidatePath("/sessions", "layout");
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong. Try again.";
}

/**
 * Log a manual, date-based no-show. No-shows are authoritative (v3): one row per
 * no-show, identified by player + calendar day. A unique-violation (23505) means
 * that player is already marked for that day, which we treat as idempotent.
 */
export async function addNoShow(
  playerId: string,
  noshowOn: string,
  note?: string,
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(noshowOn)) {
    return { ok: false, error: "Pick a valid date." };
  }
  if (noshowOn > todayISO()) {
    return { ok: false, error: "Can't log a no-show in the future." };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const inserted = await supabase
      .from("absences")
      .insert({ player_id: playerId, noshow_on: noshowOn, note: note || null });
    if (inserted.error && inserted.error.code !== "23505") throw inserted.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateBeerViews();
  return { ok: true };
}

/** Remove a logged no-show by its row id. */
export async function removeNoShow(id: string): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const deleted = await supabase.from("absences").delete().eq("id", id);
    if (deleted.error) throw deleted.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateBeerViews();
  return { ok: true };
}

/**
 * Pay off everything a player currently owes. We recompute their owed amount
 * from scratch and append a single clear row for that amount, so lifetime
 * "earned" is never reduced — the board still remembers every no-show.
 */
export async function clearBeers(playerId: string): Promise<ActionResult> {
  try {
    const { players, absences, beerClears, beersPerNoShow } = await getAllData();
    const beers = computeBeers(players, absences, beerClears, beersPerNoShow);
    const owed = beers.perPlayer[playerId]?.owed ?? 0;
    if (owed <= 0) return { ok: true };

    const supabase = await createSupabaseServerClient();
    const inserted = await supabase.from("beer_clears").insert({ player_id: playerId, beers: owed });
    if (inserted.error) throw inserted.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateBeerViews();
  return { ok: true };
}

/** Change how many beers a single no-show costs. Single-row config (id is always true). */
export async function setBeerRate(rate: number): Promise<ActionResult> {
  if (!Number.isInteger(rate) || rate < 1 || rate > 99) {
    return { ok: false, error: "Rate must be a whole number between 1 and 99." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    // Upsert (not update) so a missing settings row is created rather than the
    // change silently affecting zero rows.
    const updated = await supabase
      .from("app_settings")
      .upsert({ id: true, beers_per_no_show: rate }, { onConflict: "id" });
    if (updated.error) throw updated.error;
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateBeerViews();
  return { ok: true };
}
