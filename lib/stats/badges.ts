import type { Player } from "@/lib/types";
import type { StatsConfig } from "@/lib/stats/config";
import type { Badge, ChemistryCell, H2HCell, Pairing, PlayerStats, RatingPoint } from "@/lib/stats/types";

/** Everything `deriveBadges` needs about a single replayed game. */
export type GameContext = {
  gameId: string;
  index: number;
  sessionId: string;
  playedOn: string;
  winners: [string, string];
  losers: [string, string];
  winnerScore: number;
  loserScore: number;
  margin: number;
  gameTarget: number;
  teamWinnerRatingBefore: number;
  teamLoserRatingBefore: number;
};

export type BadgeState = {
  config: StatsConfig;
  players: Player[];
  perPlayer: Record<string, PlayerStats>;
  gameContexts: GameContext[];
  chemistry: Record<string, Record<string, ChemistryCell>>;
  bestPairing: Pairing | null;
  headToHead: Record<string, Record<string, H2HCell>>;
  ratingHistory: Record<string, RatingPoint[]>;
  sessionsChrono: { id: string; playedOn: string }[];
};

const MILESTONES = [250, 100, 50, 25];

/** The full badge catalog, in display order, for the Achievements screen. */
export const BADGE_CATALOG: { code: string; emoji: string; label: string; description: string }[] = [
  { code: "on_fire", emoji: "🔥", label: "On Fire", description: "Win three or more in a row." },
  { code: "giant_killer", emoji: "🗡️", label: "Giant-Killer", description: "Beat a much stronger team." },
  { code: "mvp_day", emoji: "👑", label: "MVP of the Day", description: "Best player in the latest session." },
  { code: "perfect_game", emoji: "💯", label: "Perfect Game", description: "Win without conceding a point." },
  { code: "nail_biter", emoji: "😅", label: "Nail-biter", description: "Win by two points or fewer." },
  { code: "sleepyhead", emoji: "🛌", label: "Sleepyhead", description: "Most beers owed for sleeping in." },
];

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Badges are derived, never stored. Editing or deleting a game recomputes them
 * from scratch, so they are always consistent with current history. "Career"
 * badges fire if a player has ever met the condition; "current" badges reflect
 * present standing (streaks, MVP, leaders).
 */
export function deriveBadges(state: BadgeState): Badge[] {
  const { config, players, perPlayer, gameContexts, bestPairing, headToHead, ratingHistory, sessionsChrono } = state;
  const ids = players.map((p) => p.id);
  const out: Badge[] = [];
  const push = (b: Badge) => out.push(b);

  // ---- streak badges (current) ----
  for (const id of ids) {
    const s = perPlayer[id].currentStreak;
    if (s >= 7) push({ code: "on_fire", label: "Unstoppable", emoji: "🔥", playerId: id, detail: `${s}-game win streak` });
    else if (s >= 5) push({ code: "on_fire", label: "Blazing", emoji: "🔥", playerId: id, detail: `${s}-game win streak` });
    else if (s >= 3) push({ code: "on_fire", label: "On Fire", emoji: "🔥", playerId: id, detail: `${s}-game win streak` });
    if (s <= -3) push({ code: "cold_snap", label: "Cold Snap", emoji: "🧊", playerId: id, detail: `${-s}-game skid` });
  }

  // ---- career badges scanned from game contexts ----
  const giantKiller = new Set<string>();
  const perfectGame = new Set<string>();
  const dominantWin = new Set<string>();
  const nailBiter = new Set<string>();
  const deuceThriller = new Set<string>();

  for (const ctx of gameContexts) {
    const stronger = ctx.teamLoserRatingBefore >= ctx.teamWinnerRatingBefore + config.GK_MARGIN;
    for (const w of ctx.winners) {
      if (stronger) giantKiller.add(w);
      if (ctx.loserScore === 0) perfectGame.add(w);
      if (ctx.margin >= 15 && ctx.loserScore > 0) dominantWin.add(w);
      if (ctx.margin <= 2) nailBiter.add(w);
      if (ctx.winnerScore > ctx.gameTarget && ctx.margin === 2) deuceThriller.add(w);
    }
  }
  for (const id of giantKiller) push({ code: "giant_killer", label: "Giant-Killer", emoji: "🗡️", playerId: id, detail: "Beat a much stronger team" });
  for (const id of perfectGame) push({ code: "perfect_game", label: "Perfect Game", emoji: "💯", playerId: id, detail: "Won without conceding a point" });
  for (const id of dominantWin) push({ code: "dominant_win", label: "Dominant Win", emoji: "🧱", playerId: id, detail: "Won by 15+" });
  for (const id of nailBiter) push({ code: "nail_biter", label: "Nail-biter", emoji: "😅", playerId: id, detail: "Won by 2 or less" });
  for (const id of deuceThriller) push({ code: "deuce_thriller", label: "Deuce Thriller", emoji: "⚡", playerId: id, detail: "Won past the deuce" });

  // ---- per-player milestones & first win (career) ----
  for (const id of ids) {
    const ps = perPlayer[id];
    if (ps.wins >= 1) push({ code: "first_win", label: "First Win", emoji: "🏅", playerId: id });
    const tier = MILESTONES.find((m) => ps.gamesPlayed >= m);
    if (tier) push({ code: "milestone", label: `${tier} Games`, emoji: "🎖️", playerId: id });
  }

  // ---- workhorse: strict-max career games (current) ----
  const maxGames = Math.max(0, ...ids.map((id) => perPlayer[id].gamesPlayed));
  if (maxGames > 0) {
    for (const id of ids) {
      if (perPlayer[id].gamesPlayed === maxGames) push({ code: "workhorse", label: "Workhorse", emoji: "🐴", playerId: id, detail: `${maxGames} games played` });
    }
  }

  // ---- nemesis: dominant head-to-head over one opponent (career) ----
  for (const id of ids) {
    for (const opp of ids) {
      if (opp === id) continue;
      const cell = headToHead[id][opp];
      if (cell.games >= 5 && cell.wins >= 5 && cell.losses <= 1) {
        push({ code: "nemesis", label: "Nemesis", emoji: "😈", playerId: id, detail: `Owns ${perPlayer[opp]?.playerId ?? opp} (${cell.wins}-${cell.losses})` });
        break;
      }
    }
  }

  // ---- best partnership (current) ----
  if (bestPairing) {
    for (const id of bestPairing.playerIds) {
      push({ code: "best_partnership", label: "Best Partnership", emoji: "🤝", playerId: id, detail: `${bestPairing.wins}-${bestPairing.losses} together` });
    }
  }

  // ---- session/window aware badges ----
  if (sessionsChrono.length > 0) {
    const latest = sessionsChrono[sessionsChrono.length - 1];

    // Iron-Man + MVP of the Day: scoped to the latest session.
    const dayStats = aggregateWindow(gameContexts, (c) => c.sessionId === latest.id);
    const dayCounts = dayStats.games;
    const maxDayGames = Math.max(0, ...ids.map((id) => dayCounts[id] ?? 0));
    if (maxDayGames >= config.MIN_SESSION_GAMES) {
      for (const id of ids) {
        if ((dayCounts[id] ?? 0) === maxDayGames) push({ code: "iron_man", label: "Iron-Man", emoji: "🏋️", playerId: id, detail: `${maxDayGames} games today` });
      }
    }
    for (const id of mvpWinners(ids, dayStats, config)) {
      push({ code: "mvp_day", label: "MVP of the Day", emoji: "👑", playerId: id });
    }

    // MVP of the Week: trailing 7 days from the latest day.
    const weekStart = isoDateMinusDays(latest.playedOn, 6);
    const weekStats = aggregateWindow(gameContexts, (c) => c.playedOn >= weekStart);
    for (const id of mvpWinners(ids, weekStats, config)) {
      push({ code: "mvp_week", label: "MVP of the Week", emoji: "🏆", playerId: id });
    }

    // Most Improved: biggest rating gain over the trailing 7 days.
    let bestGain = { id: "", gain: 0 };
    for (const id of ids) {
      const history = ratingHistory[id];
      const playedInWindow = history.some((p) => p.playedOn >= weekStart);
      if (!playedInWindow) continue;
      const before = [...history].reverse().find((p) => p.playedOn < weekStart);
      const ratingBefore = before ? before.rating : config.INITIAL_RATING;
      const gain = perPlayer[id].rating - ratingBefore;
      if (gain > bestGain.gain + 1e-9) bestGain = { id, gain };
    }
    if (bestGain.id) push({ code: "most_improved", label: "Most Improved", emoji: "📈", playerId: bestGain.id, detail: `+${Math.round(bestGain.gain)} this week` });
  }

  return out;
}

type WindowStats = {
  games: Record<string, number>;
  wins: Record<string, number>;
  pdSum: Record<string, number>;
};

function aggregateWindow(contexts: GameContext[], include: (c: GameContext) => boolean): WindowStats {
  const games: Record<string, number> = {};
  const wins: Record<string, number> = {};
  const pdSum: Record<string, number> = {};
  const bump = (rec: Record<string, number>, id: string, by: number) => (rec[id] = (rec[id] ?? 0) + by);
  for (const c of contexts) {
    if (!include(c)) continue;
    for (const w of c.winners) {
      bump(games, w, 1);
      bump(wins, w, 1);
      bump(pdSum, w, c.margin);
    }
    for (const l of c.losers) {
      bump(games, l, 1);
      bump(pdSum, l, -c.margin);
    }
  }
  return { games, wins, pdSum };
}

/** MVP = 0.7*winRate + 0.3*normalizedAvgPD among players with >= MIN_SESSION_GAMES in the window. */
function mvpWinners(ids: string[], stats: WindowStats, config: StatsConfig): string[] {
  const candidates = ids.filter((id) => (stats.games[id] ?? 0) >= config.MIN_SESSION_GAMES);
  if (candidates.length === 0) return [];

  const avgPd = (id: string) => (stats.pdSum[id] ?? 0) / (stats.games[id] ?? 1);
  const pds = candidates.map(avgPd);
  const minPd = Math.min(...pds);
  const maxPd = Math.max(...pds);
  const norm = (id: string) => (maxPd > minPd ? (avgPd(id) - minPd) / (maxPd - minPd) : 1);
  const score = (id: string) => 0.7 * ((stats.wins[id] ?? 0) / (stats.games[id] ?? 1)) + 0.3 * norm(id);

  const best = Math.max(...candidates.map(score));
  return candidates.filter((id) => Math.abs(score(id) - best) < 1e-9);
}
