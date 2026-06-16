/**
 * All tunable constants for the rating + stats engine live here so they are
 * easy to find and adjust. Changing any of these is safe: the entire derived
 * state is recomputed from raw games on every read, so a config change takes
 * effect everywhere on the next page load with no migration or backfill.
 */
export type KTier = { underGames: number; k: number };

export type StatsConfig = {
  /** Starting rating for every player (cosmetic, but must stay constant). */
  INITIAL_RATING: number;
  /** Elo logistic scale. 400 => a 400-point gap ~= 10:1 expected win odds. */
  RATING_SCALE: number;
  /** Provisional K-factor schedule by games played BEFORE the current game. */
  K_SCHEDULE: KTier[];
  /** Margin-of-victory weighting (off in v1; differential is still stored). */
  USE_MOV: boolean;
  /** Minimum games together before a partnership is eligible for best/worst ranking. */
  MIN_PAIR_GAMES: number;
  /** Minimum games in a session before a player can win MVP of the Day / Iron-Man. */
  MIN_SESSION_GAMES: number;
  /** Rating gap (opponent avg − your avg) that qualifies a win as a Giant-Killer. */
  GK_MARGIN: number;
  /** Bayesian shrinkage strength for ranking partnerships. */
  SHRINK_K: number;
  /** Minimum opposite-team meetings before a head-to-head cell is shown at full strength. */
  H2H_MIN_GAMES: number;
  /** Default points a game is played to (21); enables 11/15-point games + deuce detection. */
  GAME_TARGET_DEFAULT: number;
  /** Win/loss streak badge tiers. */
  STREAK_TIERS: number[];
};

export const STATS_CONFIG: StatsConfig = {
  INITIAL_RATING: 1000,
  RATING_SCALE: 400,
  K_SCHEDULE: [
    { underGames: 10, k: 40 },
    { underGames: 30, k: 24 },
    { underGames: Infinity, k: 16 },
  ],
  USE_MOV: false,
  MIN_PAIR_GAMES: 3,
  MIN_SESSION_GAMES: 4,
  GK_MARGIN: 100,
  SHRINK_K: 2,
  H2H_MIN_GAMES: 3,
  GAME_TARGET_DEFAULT: 21,
  STREAK_TIERS: [3, 5, 7],
};
