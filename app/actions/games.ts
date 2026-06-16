"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyAdminPin } from "@/lib/admin";
import { gameInputSchema, type GameInput } from "@/lib/schemas";
import type { Game } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateEverything() {
  // The whole app is derived from games, so any game change touches every view.
  for (const path of ["/", "/sessions", "/leaderboard", "/players", "/rivalries", "/achievements"]) {
    revalidatePath(path, "layout");
  }
}

/** Find the session row for a calendar day, creating it if needed. Returns the session id. */
async function getOrCreateSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  playedOn: string,
): Promise<string> {
  const existing = await supabase.from("sessions").select("id").eq("played_on", playedOn).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const created = await supabase.from("sessions").insert({ played_on: playedOn }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id;
}

async function nextSessionSeq(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sessionId: string,
): Promise<number> {
  const res = await supabase
    .from("games")
    .select("session_seq")
    .eq("session_id", sessionId)
    .order("session_seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error) throw res.error;
  return (res.data?.session_seq ?? 0) + 1;
}

function toRow(input: GameInput, sessionId: string, seq: number) {
  return {
    session_id: sessionId,
    session_seq: seq,
    team_a1: input.teamA[0],
    team_a2: input.teamA[1],
    team_b1: input.teamB[0],
    team_b2: input.teamB[1],
    sat_out: input.satOut,
    score_a: input.scoreA,
    score_b: input.scoreB,
    game_target: input.gameTarget,
  };
}

export async function saveGame(raw: GameInput): Promise<ActionResult> {
  const parsed = gameInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the game details" };
  }
  const input = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const sessionId = await getOrCreateSession(supabase, input.playedOn);
    const seq = await nextSessionSeq(supabase, sessionId);

    const inserted = await supabase.from("games").insert(toRow(input, sessionId, seq)).select("*").single();
    if (inserted.error) throw inserted.error;

    await supabase.from("game_events").insert({
      game_id: inserted.data.id,
      action: "create",
      editor_name: input.editorName ?? null,
      after_data: inserted.data,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  redirect(`/sessions/${input.playedOn}`);
}

export async function updateGame(gameId: string, raw: GameInput, pin: string): Promise<ActionResult> {
  if (!verifyAdminPin(pin)) return { ok: false, error: "Incorrect admin PIN." };
  const parsed = gameInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the game details" };
  }
  const input = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    const before = await supabase.from("games").select("*").eq("id", gameId).single();
    if (before.error) throw before.error;
    const previous = before.data as Game;

    // Resolve the session for the chosen date; only re-sequence if it moved days.
    const sessionId = await getOrCreateSession(supabase, input.playedOn);
    let seq = previous.session_seq;
    if (sessionId !== previous.session_id) {
      seq = await nextSessionSeq(supabase, sessionId);
    }

    const updated = await supabase
      .from("games")
      .update(toRow(input, sessionId, seq))
      .eq("id", gameId)
      .select("*")
      .single();
    if (updated.error) throw updated.error;

    await supabase.from("game_events").insert({
      game_id: gameId,
      action: "edit",
      editor_name: input.editorName ?? null,
      before_data: previous,
      after_data: updated.data,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  redirect(`/sessions/${input.playedOn}`);
}

export async function deleteGame(gameId: string, pin: string, editorName?: string): Promise<ActionResult> {
  if (!verifyAdminPin(pin)) return { ok: false, error: "Incorrect admin PIN." };
  try {
    const supabase = await createSupabaseServerClient();

    const before = await supabase.from("games").select("*").eq("id", gameId).single();
    if (before.error) throw before.error;

    const deleted = await supabase
      .from("games")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", gameId)
      .is("deleted_at", null);
    if (deleted.error) throw deleted.error;

    await supabase.from("game_events").insert({
      game_id: gameId,
      action: "delete",
      editor_name: editorName ?? null,
      before_data: before.data,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  return { ok: true };
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong saving that. Try again.";
}
