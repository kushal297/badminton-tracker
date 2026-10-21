import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetchAll";
import { assignPlayerColors } from "@/lib/players";
import type { Absence, BeerClear, Game, GameWithDate, Player, Session } from "@/lib/types";

/** Default beers owed per no-show when app_settings is missing or unreadable. */
const DEFAULT_BEERS_PER_NO_SHOW = 6;

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Shared by getPlayers and getAllData so the players order, paging and colour
 * assignment cannot drift. Unsaved colours are filled once here so avatars,
 * chips and charts all agree.
 */
async function fetchPlayers(supabase: ServerClient): Promise<Player[]> {
  const players = await fetchAllRows<Player>((from, to) =>
    supabase.from("players").select("*").order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
  );
  const assigned = assignPlayerColors(players);
  return players.map((p) => ({ ...p, color: assigned.get(p.id) ?? p.color }));
}

/** Players only, for pages that need nothing else (same order and paging as getAllData). */
export async function getPlayers(): Promise<Player[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  const supabase = await createSupabaseServerClient();
  return fetchPlayers(supabase);
}

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

  // Each table is paged through fetchAllRows so the PostgREST max_rows cap
  // cannot silently drop rows; every order ends in `id` so pages are stable.
  const [players, sessions, rawGames, absences, beerClears, settingsRes] = await Promise.all([
    fetchPlayers(supabase),
    fetchAllRows<Session>((from, to) =>
      supabase.from("sessions").select("*").order("played_on", { ascending: true }).order("id", { ascending: true }).range(from, to),
    ),
    fetchAllRows<Game>((from, to) =>
      supabase
        .from("games")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<Absence>((from, to) =>
      supabase.from("absences").select("*").order("noshow_on", { ascending: false }).order("id", { ascending: true }).range(from, to),
    ),
    fetchAllRows<BeerClear>((from, to) =>
      supabase.from("beer_clears").select("*").order("cleared_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
    ),
    supabase.from("app_settings").select("beers_per_no_show").single(),
  ]);

  // A failed page read rejects inside fetchAllRows, so a read error never renders empty stats.
  // app_settings is a single-row config: tolerate a missing row (PGRST116 = no
  // rows) by falling back to the default, but still surface any real error.
  if (settingsRes.error && settingsRes.error.code !== "PGRST116") throw settingsRes.error;

  const beersPerNoShow = settingsRes.data?.beers_per_no_show ?? DEFAULT_BEERS_PER_NO_SHOW;

  const playedOnBySession = new Map(sessions.map((s) => [s.id, s.played_on]));
  const games: GameWithDate[] = rawGames.map((g) => ({
    ...g,
    played_on: playedOnBySession.get(g.session_id) ?? g.played_at.slice(0, 10),
  }));

  return { players, sessions, games, absences, beerClears, beersPerNoShow };
}
