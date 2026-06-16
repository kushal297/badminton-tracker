import { STATS_CONFIG } from "@/lib/stats/config";

/**
 * Per-player Elo for 2v2 rotating doubles. We rate players (not teams) because
 * partners change every game; a team's rating is the mean of its two players.
 *
 * Margin of victory is intentionally NOT applied here in v1 (STATS_CONFIG.USE_MOV
 * is false). Point differential is still recorded by the stats layer, so MOV can
 * be enabled later as a pure recompute with no data backfill.
 */

/** Probability that team A beats team B, given the two team ratings. */
export function expectedScoreA(
  ratingA: number,
  ratingB: number,
  scale: number = STATS_CONFIG.RATING_SCALE,
): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / scale));
}

/** K-factor for a player based on the games they had played BEFORE the current game. */
export function kFactor(
  gamesPlayedBefore: number,
  schedule: ReadonlyArray<{ underGames: number; k: number }> = STATS_CONFIG.K_SCHEDULE,
): number {
  for (const tier of schedule) {
    if (gamesPlayedBefore < tier.underGames) return tier.k;
  }
  return schedule[schedule.length - 1].k;
}

/** A doubles team's rating is the mean of its two players' ratings. */
export function teamRating(r1: number, r2: number): number {
  return (r1 + r2) / 2;
}

export type EloUpdateInput = {
  teamARatings: [number, number];
  teamBRatings: [number, number];
  teamAKs: [number, number];
  teamBKs: [number, number];
  winner: "A" | "B";
  scale?: number;
};

export type EloUpdateResult = {
  expectedA: number;
  expectedB: number;
  deltasA: [number, number]; // rating change for team A's two players
  deltasB: [number, number];
};

/**
 * Compute the four rating deltas for one game. Both partners on a team receive
 * the same `(actual - expected)` term scaled by their own K — with only a
 * team-level score there is no fair basis to split credit unequally.
 */
export function eloUpdate(input: EloUpdateInput): EloUpdateResult {
  const scale = input.scale ?? STATS_CONFIG.RATING_SCALE;
  const rA = teamRating(input.teamARatings[0], input.teamARatings[1]);
  const rB = teamRating(input.teamBRatings[0], input.teamBRatings[1]);

  const expectedA = expectedScoreA(rA, rB, scale);
  const expectedB = 1 - expectedA;

  const actualA = input.winner === "A" ? 1 : 0;
  const actualB = 1 - actualA;

  return {
    expectedA,
    expectedB,
    deltasA: [
      input.teamAKs[0] * (actualA - expectedA),
      input.teamAKs[1] * (actualA - expectedA),
    ],
    deltasB: [
      input.teamBKs[0] * (actualB - expectedB),
      input.teamBKs[1] * (actualB - expectedB),
    ],
  };
}
