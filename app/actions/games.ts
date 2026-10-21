"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyAdminPin } from "@/lib/admin";
import { auditRedirectPath } from "@/lib/auditNotice";
import { isNoRows, isUniqueViolation } from "@/lib/dbErrors";
import { withUniqueRetry } from "@/lib/seqRetry";
import { resolveSessionId } from "@/lib/sessionLookup";
import { gameInputSchema, type GameInput } from "@/lib/schemas";
import type { Game } from "@/lib/types";

export type ActionResult = { ok: true; warning?: string } | { ok: false; error: string };

const BUSY: ActionResult = { ok: false, error: "Busy, please try again." };
const GAME_GONE: ActionResult = { ok: false, error: "That game was deleted." };

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
  // A concurrent create of the same day hits sessions_one_per_day; resolveSessionId re-selects then.
  return resolveSessionId(
    () => supabase.from("sessions").select("id").eq("played_on", playedOn).maybeSingle(),
    () => supabase.from("sessions").insert({ played_on: playedOn }).select("id").single(),
  );
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

  // The game row commits before its audit entry, so a failed audit write must not fail the save
  // (the form would stay open and invite a duplicate). It is flagged on the redirect instead.
  let auditFailed = false;
  try {
    const supabase = await createSupabaseServerClient();
    const sessionId = await getOrCreateSession(supabase, input.playedOn);

    const inserted = await withUniqueRetry<Game>(async () => {
      const seq = await nextSessionSeq(supabase, sessionId);
      return supabase.from("games").insert(toRow(input, sessionId, seq)).select("*").single();
    });
    if (!inserted) return BUSY;

    const audit = await supabase.from("game_events").insert({
      game_id: inserted.id,
      action: "create",
      editor_name: input.editorName ?? null,
      after_data: inserted,
    });
    if (audit.error) {
      console.error("game_events insert failed (create)", audit.error);
      auditFailed = true;
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  redirect(auditRedirectPath(input.playedOn, auditFailed ? "audit" : null));
}

export async function updateGame(gameId: string, raw: GameInput, pin: string): Promise<ActionResult> {
  if (!verifyAdminPin(pin)) return { ok: false, error: "Incorrect admin PIN." };
  const parsed = gameInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the game details" };
  }
  const input = parsed.data;

  let auditFailed = false; // see saveGame
  try {
    const supabase = await createSupabaseServerClient();

    const before = await supabase.from("games").select("*").eq("id", gameId).single();
    if (before.error) throw before.error;
    const previous = before.data as Game;

    // Resolve the session for the chosen date; only re-sequence if it moved days.
    const sessionId = await getOrCreateSession(supabase, input.playedOn);
    // Only a live game may be edited: a soft-deleted row matches nothing, and .single() then
    // fails with PGRST116, which the catch below reports as "That game was deleted."
    const writeRow = (seq: number) =>
      supabase
        .from("games")
        .update(toRow(input, sessionId, seq))
        .eq("id", gameId)
        .is("deleted_at", null)
        .select("*")
        .single();

    let updated: Game | null = null;
    if (sessionId === previous.session_id) {
      const res = await writeRow(previous.session_seq);
      // A unique violation means this edit is stale (the game moved and its number was reused);
      // fall through and claim a fresh number instead.
      if (res.error && !isUniqueViolation(res.error)) throw res.error;
      updated = res.data;
    }
    if (!updated) {
      updated = await withUniqueRetry<Game>(async () => writeRow(await nextSessionSeq(supabase, sessionId)));
      if (!updated) return BUSY;
    }

    const audit = await supabase.from("game_events").insert({
      game_id: gameId,
      action: "edit",
      editor_name: input.editorName ?? null,
      before_data: previous,
      after_data: updated,
    });
    if (audit.error) {
      console.error("game_events insert failed (edit)", audit.error);
      auditFailed = true;
    }
  } catch (err) {
    if (isNoRows(err)) return GAME_GONE;
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  redirect(auditRedirectPath(input.playedOn, auditFailed ? "audit" : null));
}

export async function deleteGame(gameId: string, pin: string, editorName?: string): Promise<ActionResult> {
  if (!verifyAdminPin(pin)) return { ok: false, error: "Incorrect admin PIN." };
  let auditFailed = false; // see saveGame
  try {
    const supabase = await createSupabaseServerClient();

    const before = await supabase.from("games").select("*").eq("id", gameId).single();
    if (before.error) throw before.error;

    const deleted = await supabase
      .from("games")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", gameId)
      .is("deleted_at", null)
      .select("id");
    if (deleted.error) throw deleted.error;
    // No row: another delete got there first. Log nothing, so the audit holds one event per delete.
    if (deleted.data.length === 0) return { ok: false, error: "That game was already deleted." };

    const audit = await supabase.from("game_events").insert({
      game_id: gameId,
      action: "delete",
      editor_name: editorName ?? null,
      before_data: before.data,
    });
    if (audit.error) {
      console.error("game_events insert failed (delete)", audit.error);
      auditFailed = true;
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  revalidateEverything();
  return auditFailed ? { ok: true, warning: "Deleted, but the audit log entry failed." } : { ok: true };
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return "Something went wrong saving that. Try again.";
}
