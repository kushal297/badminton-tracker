/**
 * Period insights — a pure, recompute-on-read view over a date window.
 *
 * Same architecture as `computeAll` / `computeBeers`: raw rows (already turned
 * into a `ComputeOutput` by `computeAll`) in, a window-scoped summary out. The
 * caller picks a `DateWindow` (day / week / month / all time) and gets per-player
 * tallies, rating movement, superlatives, no-shows and a few human highlights —
 * all derived, nothing stored.
 */
import { formatDateLong, formatSigned } from "@/lib/format";
import { STATS_CONFIG } from "@/lib/stats/config";
import type { ComputeOutput, Pairing, ChemistryCell } from "@/lib/stats/types";
import type { Absence, Player } from "@/lib/types";

// ---- date windows ----------------------------------------------------------

export type WindowKind = "day" | "week" | "month" | "all";

export type DateWindow = {
  kind: WindowKind;
  startISO: string; // 'YYYY-MM-DD' inclusive
  endISO: string; // 'YYYY-MM-DD' inclusive
  label: string;
};

/** 'YYYY-MM-DD' -> UTC Date at midnight. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC Date -> 'YYYY-MM-DD'. */
export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to a 'YYYY-MM-DD' string using UTC math. */
export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

/**
 * Resolve a window kind + anchor day into concrete inclusive [start, end] bounds.
 *
 *   day   — start = end = anchor
 *   week  — start = anchor - 6 days, end = anchor (a rolling 7-day window)
 *   month — first .. last calendar day of the anchor's month
 *   all   — min .. max of `datesWithGames` (or anchor for both when empty)
 */
export function resolveWindow(kind: WindowKind, anchorISO: string, datesWithGames: string[]): DateWindow {
  switch (kind) {
    case "day":
      return { kind, startISO: anchorISO, endISO: anchorISO, label: formatDateLong(anchorISO) };
    case "week": {
      const startISO = addDays(anchorISO, -6);
      return { kind, startISO, endISO: anchorISO, label: `${formatDateLong(startISO)} – ${formatDateLong(anchorISO)}` };
    }
    case "month": {
      const anchor = parseISO(anchorISO);
      const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)); // day 0 of next month
      const startISO = toISO(first);
      const endISO = toISO(last);
      return { kind, startISO, endISO, label: `${formatDateLong(startISO)} – ${formatDateLong(endISO)}` };
    }
    case "all": {
      if (datesWithGames.length === 0) {
        return { kind, startISO: anchorISO, endISO: anchorISO, label: "All time" };
      }
      const sorted = [...datesWithGames].sort();
      return { kind, startISO: sorted[0], endISO: sorted[sorted.length - 1], label: "All time" };
    }
  }
}

// ---- period insights -------------------------------------------------------

export type PlayerPeriodStat = {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number | null;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  ratingDelta: number;
};

export type Highlight = { emoji: string; text: string; playerId?: string };

export type PeriodInsights = {
  window: DateWindow;
  gamesPlayed: number;
  perPlayer: PlayerPeriodStat[];
  biggestClimber: { playerId: string; ratingDelta: number } | null;
  biggestFaller: { playerId: string; ratingDelta: number } | null;
  mvp: { playerId: string; wins: number; winPct: number | null } | null;
  mostActive: { playerId: string; gamesPlayed: number } | null;
  noShows: { count: number; playerIds: string[] };
  beersEarned: number;
  highlights: Highlight[];
};

export function computeInsights(
  out: ComputeOutput,
  players: Player[],
  absences: Absence[],
  ratePerNoShow: number,
  window: DateWindow,
): PeriodInsights {
  const { startISO, endISO } = window;
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  // --- per-player tally over in-window games (counting only) ---
  const stat = new Map<string, PlayerPeriodStat>();
  for (const p of players) {
    stat.set(p.id, {
      playerId: p.id,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: null,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      ratingDelta: 0,
    });
  }

  let gamesPlayed = 0;
  for (const g of out.orderedGames) {
    if (g.played_on < startISO || g.played_on > endISO) continue;
    gamesPlayed += 1;

    const aWon = g.score_a > g.score_b;
    const teamA = [g.team_a1, g.team_a2];
    const teamB = [g.team_b1, g.team_b2];

    for (const pid of teamA) {
      const s = stat.get(pid);
      if (!s) continue;
      s.gamesPlayed += 1;
      s.pointsFor += g.score_a;
      s.pointsAgainst += g.score_b;
      if (aWon) s.wins += 1;
      else s.losses += 1;
    }
    for (const pid of teamB) {
      const s = stat.get(pid);
      if (!s) continue;
      s.gamesPlayed += 1;
      s.pointsFor += g.score_b;
      s.pointsAgainst += g.score_a;
      if (!aWon) s.wins += 1;
      else s.losses += 1;
    }
  }

  // --- rating delta within window from each player's rating history ---
  for (const p of players) {
    const history = out.ratingHistory[p.id] ?? [];
    let baseline = out.config.INITIAL_RATING; // last rating strictly before the window
    let end = baseline; // last rating at/before the window end (stays = baseline if none)
    for (const pt of history) {
      if (pt.playedOn < startISO) baseline = pt.rating;
      if (pt.playedOn <= endISO) end = pt.rating;
    }

    const s = stat.get(p.id)!;
    s.ratingDelta = end - baseline;
    s.pointDiff = s.pointsFor - s.pointsAgainst;
    s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : null;
  }

  // --- ordering: wins desc, then ratingDelta desc ---
  const perPlayer = [...stat.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.ratingDelta !== a.ratingDelta) return b.ratingDelta - a.ratingDelta;
    return (nameById.get(a.playerId) ?? a.playerId).localeCompare(nameById.get(b.playerId) ?? b.playerId);
  });

  // --- superlatives (only among players who actually played in the window) ---
  const active = perPlayer.filter((s) => s.gamesPlayed > 0);

  let mvp: PeriodInsights["mvp"] = null;
  let mostActive: PeriodInsights["mostActive"] = null;
  let biggestClimber: PeriodInsights["biggestClimber"] = null;
  let biggestFaller: PeriodInsights["biggestFaller"] = null;

  if (active.length > 0) {
    const mvpRow = [...active].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aw = a.winPct ?? 0;
      const bw = b.winPct ?? 0;
      if (bw !== aw) return bw - aw;
      if (b.ratingDelta !== a.ratingDelta) return b.ratingDelta - a.ratingDelta;
      return (nameById.get(a.playerId) ?? a.playerId).localeCompare(nameById.get(b.playerId) ?? b.playerId);
    })[0];
    mvp = { playerId: mvpRow.playerId, wins: mvpRow.wins, winPct: mvpRow.winPct };

    const activeRow = [...active].sort((a, b) => {
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return (nameById.get(a.playerId) ?? a.playerId).localeCompare(nameById.get(b.playerId) ?? b.playerId);
    })[0];
    mostActive = { playerId: activeRow.playerId, gamesPlayed: activeRow.gamesPlayed };

    const climber = [...active].sort((a, b) => b.ratingDelta - a.ratingDelta)[0];
    biggestClimber = { playerId: climber.playerId, ratingDelta: climber.ratingDelta };

    const faller = [...active].sort((a, b) => a.ratingDelta - b.ratingDelta)[0];
    biggestFaller = { playerId: faller.playerId, ratingDelta: faller.ratingDelta };
  }

  // --- no-shows in window + beers earned ---
  const playerIdSet = new Set(players.map((p) => p.id));
  let noShowCount = 0;
  const noShowPlayers = new Set<string>();
  for (const a of absences) {
    if (!playerIdSet.has(a.player_id)) continue;
    if (a.noshow_on < startISO || a.noshow_on > endISO) continue;
    noShowCount += 1;
    noShowPlayers.add(a.player_id);
  }
  const beersEarned = noShowCount * ratePerNoShow;

  // --- human highlights ---
  const highlights: Highlight[] = [];
  const nameOf = (id: string) => nameById.get(id) ?? id;

  if (gamesPlayed > 0) {
    highlights.push({
      emoji: "🏸",
      text: `${gamesPlayed} game${gamesPlayed === 1 ? "" : "s"} played`,
    });
  }
  if (mvp) {
    highlights.push({
      emoji: "🏆",
      text: `${nameOf(mvp.playerId)} was MVP with ${mvp.wins} win${mvp.wins === 1 ? "" : "s"}`,
      playerId: mvp.playerId,
    });
  }
  if (biggestClimber && biggestClimber.ratingDelta > 0) {
    highlights.push({
      emoji: "📈",
      text: `${nameOf(biggestClimber.playerId)} climbed ${formatSigned(Math.round(biggestClimber.ratingDelta))}`,
      playerId: biggestClimber.playerId,
    });
  }
  if (
    biggestFaller &&
    biggestFaller.ratingDelta < 0 &&
    biggestFaller.playerId !== biggestClimber?.playerId
  ) {
    highlights.push({
      emoji: "📉",
      text: `${nameOf(biggestFaller.playerId)} slid ${formatSigned(Math.round(biggestFaller.ratingDelta))}`,
      playerId: biggestFaller.playerId,
    });
  }
  if (mostActive) {
    highlights.push({
      emoji: "🔥",
      text: `${nameOf(mostActive.playerId)} played the most (${mostActive.gamesPlayed})`,
      playerId: mostActive.playerId,
    });
  }
  if (noShowCount > 0) {
    highlights.push({
      emoji: "🛌",
      text: `${noShowCount} no-show${noShowCount === 1 ? "" : "s"} → ${beersEarned} 🍺 earned`,
    });
  }

  return {
    window,
    gamesPlayed,
    perPlayer,
    biggestClimber,
    biggestFaller,
    mvp,
    mostActive,
    noShows: { count: noShowCount, playerIds: [...noShowPlayers] },
    beersEarned,
    highlights,
  };
}

// ---- pair ranking ----------------------------------------------------------

/**
 * Rank teammate pairings by Bayesian-shrunk win rate.
 *
 * Iterates each unordered pair exactly once (i < j over `ids`), keeps pairs with
 * at least `minGames` games together, and sorts by shrunkWinRate desc then games
 * desc. Returns the same `Pairing` shape used by `computeAll`.
 */
export function rankPairs(
  chemistry: Record<string, Record<string, ChemistryCell>>,
  ids: string[],
  minGames: number = STATS_CONFIG.MIN_PAIR_GAMES,
): Pairing[] {
  const pairs: Pairing[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const cell = chemistry[a]?.[b];
      if (!cell || cell.games < minGames) continue;
      pairs.push({
        playerIds: [a, b],
        games: cell.games,
        wins: cell.wins,
        losses: cell.losses,
        winRate: cell.winRate ?? 0,
        shrunkWinRate: cell.shrunkWinRate,
      });
    }
  }

  pairs.sort((x, y) => {
    if (y.shrunkWinRate !== x.shrunkWinRate) return y.shrunkWinRate - x.shrunkWinRate;
    return y.games - x.games;
  });

  return pairs;
}
