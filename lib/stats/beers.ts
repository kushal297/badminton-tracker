import type { Absence, BeerClear, Player } from "@/lib/types";

/**
 * Beer board — the no-show penalty ledger.
 *
 * Pure function in the same spirit as `computeAll`: raw `absences` and
 * `beer_clears` rows in, every derived beer standing out, recomputed on read.
 *
 *   earned  = (# of that player's absence rows) * ratePerNoShow   (lifetime; never shrinks)
 *   cleared = sum of that player's beer_clears.beers
 *   owed    = max(0, earned - cleared)
 *
 * No-shows are now MANUAL and date-based (v3): every absence row is an
 * authoritative no-show, so there is no "played that session" filtering.
 * Clearing beers reduces `owed` but never the lifetime `earned`, so the board
 * always remembers the full no-show count.
 */
export type BeerStanding = {
  playerId: string;
  absences: number;
  earned: number;
  cleared: number;
  owed: number;
};

export type BeerResult = {
  ratePerNoShow: number;
  perPlayer: Record<string, BeerStanding>;
  board: BeerStanding[];
  /** Player at the top of the board, but only if they actually owe something. */
  sleepyheadId: string | null;
};

export function computeBeers(
  players: Player[],
  absences: Absence[],
  beerClears: BeerClear[],
  ratePerNoShow: number,
): BeerResult {
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const absenceCount: Record<string, number> = {};
  const clearedSum: Record<string, number> = {};
  for (const p of players) {
    absenceCount[p.id] = 0;
    clearedSum[p.id] = 0;
  }

  // Ignore rows that reference players not in the current roster — the same
  // defensive stance the rest of the engine takes toward stale references.
  for (const a of absences) {
    if (!(a.player_id in absenceCount)) continue;
    absenceCount[a.player_id] += 1;
  }
  for (const c of beerClears) {
    if (c.player_id in clearedSum) clearedSum[c.player_id] += c.beers;
  }

  const perPlayer: Record<string, BeerStanding> = {};
  for (const p of players) {
    const earned = absenceCount[p.id] * ratePerNoShow;
    const cleared = clearedSum[p.id];
    perPlayer[p.id] = {
      playerId: p.id,
      absences: absenceCount[p.id],
      earned,
      cleared,
      owed: Math.max(0, earned - cleared),
    };
  }

  const board = Object.values(perPlayer).sort((x, y) => {
    if (y.owed !== x.owed) return y.owed - x.owed; // owed desc
    if (y.earned !== x.earned) return y.earned - x.earned; // tiebreak: earned desc
    return (nameById.get(x.playerId) ?? x.playerId).localeCompare(nameById.get(y.playerId) ?? y.playerId); // then name asc
  });

  const sleepyheadId = board.length > 0 && board[0].owed > 0 ? board[0].playerId : null;

  return { ratePerNoShow, perPlayer, board, sleepyheadId };
}
