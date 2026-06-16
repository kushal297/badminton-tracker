import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Absence, BeerClear, Game, GameWithDate, Player, Session } from "@/lib/types";

/** Default beers owed per no-show when app_settings is missing or unreadable. */
const DEFAULT_BEERS_PER_NO_SHOW = 6;

export type AllData = {
  players: Player[];
  sessions: Session[];
  games: GameWithDate[];
  absences: Absence[];
  beerClears: BeerClear[];
  beersPerNoShow: number;
};

/**
 * The single read for the whole app. The dataset is tiny (five players, low
 * hundreds of games), so every stats page fetches everything once and hands it
 * to `computeAll`. This keeps one consistent source of truth per request and
 * means an edit or delete is reflected everywhere on the next render.
 *
 * Soft-deleted games are excluded here, so the rest of the app (and the rating
 * replay) simply never sees them.
 */
export async function getAllData(): Promise<AllData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Surfaced as a friendly setup screen by app/error.tsx.
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const supabase = await createSupabaseServerClient();

  const [playersRes, sessionsRes, gamesRes, absencesRes, beerClearsRes, settingsRes] = await Promise.all([
    supabase.from("players").select("*").order("created_at", { ascending: true }),
    supabase.from("sessions").select("*").order("played_on", { ascending: true }),
    supabase.from("games").select("*").is("deleted_at", null),
    supabase.from("absences").select("*").order("noshow_on", { ascending: false }),
    supabase.from("beer_clears").select("*"),
    supabase.from("app_settings").select("beers_per_no_show").single(),
  ]);

  // Fail loudly — a read error must not silently render empty stats.
  if (playersRes.error) throw playersRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (gamesRes.error) throw gamesRes.error;
  if (absencesRes.error) throw absencesRes.error;
  if (beerClearsRes.error) throw beerClearsRes.error;
  // app_settings is a single-row config: tolerate a missing row (PGRST116 = no
  // rows) by falling back to the default, but still surface any real error.
  if (settingsRes.error && settingsRes.error.code !== "PGRST116") throw settingsRes.error;

  const players = (playersRes.data ?? []) as Player[];
  const sessions = (sessionsRes.data ?? []) as Session[];
  const absences = (absencesRes.data ?? []) as Absence[];
  const beerClears = (beerClearsRes.data ?? []) as BeerClear[];
  const beersPerNoShow = settingsRes.data?.beers_per_no_show ?? DEFAULT_BEERS_PER_NO_SHOW;

  const playedOnBySession = new Map(sessions.map((s) => [s.id, s.played_on]));
  const games: GameWithDate[] = ((gamesRes.data ?? []) as Game[]).map((g) => ({
    ...g,
    played_on: playedOnBySession.get(g.session_id) ?? g.played_at.slice(0, 10),
  }));

  return { players, sessions, games, absences, beerClears, beersPerNoShow };
}
