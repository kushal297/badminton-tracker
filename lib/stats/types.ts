import type { GameWithDate, Player, Session } from "@/lib/types";
import type { StatsConfig } from "@/lib/stats/config";

/** Per-player aggregate stats. All counts ignore games the player sat out. */
export type PlayerStats = {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number | null; // null when gamesPlayed === 0
  pointsFor: number; // sum of the player's own team's score
  pointsAgainst: number; // sum of the opposing team's score
  pointDiff: number;
  avgPointDiff: number | null;
  rating: number;
  isProvisional: boolean; // still inside the first (highest-K) tier
  currentStreak: number; // signed: +n win streak, -n loss streak, 0 if no games
  longestWinStreak: number;
  longestLossStreak: number;
};

/** One point on a player's rating curve: their rating immediately after a game they played. */
export type RatingPoint = {
  gameId: string;
  gameIndex: number; // position in canonical order
  sessionId: string;
  playedOn: string;
  rating: number;
};

/** A player's rating at the end of a session (the default x-axis for the rating chart). */
export type SessionRatingPoint = {
  sessionId: string;
  playedOn: string;
  rating: number;
};

export type LeaderboardRow = PlayerStats & {
  rank: number;
  previousRank: number | null; // rank as of the previous session
  rankDelta: number | null; // previousRank - rank (positive === moved up)
};

/** Record between two players when they were on OPPOSITE teams. */
export type H2HCell = {
  games: number;
  wins: number; // row player's wins vs column player
  losses: number;
};

/** Record between two players when they were on the SAME team. */
export type ChemistryCell = {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgPointDiff: number | null;
  shrunkWinRate: number; // Bayesian-shrunk, used for ranking
};

export type PartnerRef = {
  partnerId: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type Pairing = {
  playerIds: [string, string];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  shrunkWinRate: number;
};

export type Badge = {
  code: string;
  label: string;
  emoji: string;
  playerId: string;
  detail?: string;
};

export type ComputeOutput = {
  config: StatsConfig;
  players: Player[];
  orderedGames: GameWithDate[]; // canonical order, soft-deletes already excluded
  perPlayer: Record<string, PlayerStats>;
  leaderboard: LeaderboardRow[];
  ratingHistory: Record<string, RatingPoint[]>;
  sessionRatingHistory: Record<string, SessionRatingPoint[]>;
  headToHead: Record<string, Record<string, H2HCell>>;
  chemistry: Record<string, Record<string, ChemistryCell>>;
  bestPartner: Record<string, PartnerRef | null>;
  worstPartner: Record<string, PartnerRef | null>;
  bestPairing: Pairing | null;
  worstPairing: Pairing | null;
  badges: Badge[];
  badgesByPlayer: Record<string, Badge[]>;
  /**
   * Per game id, the player whose rating moved the most in ABSOLUTE terms in
   * that game, with the SIGNED delta (winners positive, losers negative).
   * One entry per non-deleted game; null only for a game with no players.
   */
  gameMovers: Record<string, { playerId: string; delta: number } | null>;
};

export type ComputeInput = {
  players: Player[];
  games: GameWithDate[];
  sessions: Session[];
  config?: StatsConfig;
};
