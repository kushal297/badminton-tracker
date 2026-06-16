/**
 * Database row types. These mirror `supabase/schema.sql` exactly.
 *
 * The single source of truth for the whole app is the set of (non-deleted)
 * `games` rows. Everything derived — ratings, leaderboard, head-to-head,
 * chemistry, streaks, badges, charts — is recomputed by `lib/stats/computeAll`
 * from these rows on every read. Nothing derived is stored.
 */

export type Player = {
  id: string;
  name: string;
  color: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type Session = {
  id: string;
  played_on: string; // 'YYYY-MM-DD'
  label: string | null;
  created_at: string;
};

export type Game = {
  id: string;
  session_id: string;
  session_seq: number;

  team_a1: string;
  team_a2: string;
  team_b1: string;
  team_b2: string;
  sat_out: string | null;

  score_a: number;
  score_b: number;
  game_target: number;

  played_at: string; // ISO timestamp
  deleted_at: string | null;
  created_at: string;
  updated_at: string;

  // Postgres generated columns (derived from the columns above).
  winner_team: "A" | "B";
  player_ids: string[];
};

/** A game enriched with its session's calendar day, as returned by the data layer. */
export type GameWithDate = Game & { played_on: string };

export const AUDIT_ACTIONS = ["create", "edit", "delete", "restore"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type GameEvent = {
  id: number;
  game_id: string | null;
  action: AuditAction;
  editor_name: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

/** A row means the player NO-SHOWED on that calendar day (manual, date-based). */
export type Absence = {
  id: string;
  player_id: string;
  noshow_on: string; // 'YYYY-MM-DD'
  note: string | null;
  created_at: string;
};

/** Append-only ledger of beers paid off; lifetime "earned" is never reduced. */
export type BeerClear = { id: string; player_id: string; beers: number; cleared_at: string };
