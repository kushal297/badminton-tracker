import type { GameWithDate, Player, Session } from "@/lib/types";
import { STATS_CONFIG, type StatsConfig } from "@/lib/stats/config";
import { eloUpdate, kFactor } from "@/lib/stats/elo";
import { deriveBadges, type GameContext } from "@/lib/stats/badges";
import type {
  Badge,
  ChemistryCell,
  ComputeOutput,
  H2HCell,
  LeaderboardRow,
  Pairing,
  PartnerRef,
  PlayerStats,
  RatingPoint,
  SessionRatingPoint,
} from "@/lib/stats/types";

/**
 * THE engine. Pure function: raw games in, every derived number out.
 *
 * It sorts games into one canonical order and replays them once. Ratings,
 * rating history, streaks, tallies, head-to-head, chemistry and badges all fall
 * out of that single pass. Because nothing is read from stored derived state,
 * editing or deleting any past game and recomputing is always correct.
 */
export function computeAll(
  players: Player[],
  games: GameWithDate[],
  sessions: Session[],
  config: StatsConfig = STATS_CONFIG,
): ComputeOutput {
  const ids = players.map((p) => p.id);
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  // --- per-player accumulators ---
  const rating: Record<string, number> = {};
  const gp: Record<string, number> = {};
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const pf: Record<string, number> = {};
  const pa: Record<string, number> = {};
  const streak: Record<string, number> = {};
  const longWin: Record<string, number> = {};
  const longLoss: Record<string, number> = {};
  const ratingHistory: Record<string, RatingPoint[]> = {};
  const sessionRatingHistory: Record<string, SessionRatingPoint[]> = {};
  for (const id of ids) {
    rating[id] = config.INITIAL_RATING;
    gp[id] = wins[id] = losses[id] = pf[id] = pa[id] = 0;
    streak[id] = longWin[id] = longLoss[id] = 0;
    ratingHistory[id] = [];
    sessionRatingHistory[id] = [];
  }

  // --- pairwise accumulators (lazily filled) ---
  const headToHead: Record<string, Record<string, H2HCell>> = {};
  const chemRaw: Record<string, Record<string, { games: number; wins: number; losses: number; pdSum: number }>> = {};
  for (const id of ids) {
    headToHead[id] = {};
    chemRaw[id] = {};
    for (const other of ids) {
      if (other === id) continue;
      headToHead[id][other] = { games: 0, wins: 0, losses: 0 };
      chemRaw[id][other] = { games: 0, wins: 0, losses: 0, pdSum: 0 };
    }
  }

  const applyWin = (p: string) => {
    streak[p] = streak[p] > 0 ? streak[p] + 1 : 1;
    longWin[p] = Math.max(longWin[p], streak[p]);
  };
  const applyLoss = (p: string) => {
    streak[p] = streak[p] < 0 ? streak[p] - 1 : -1;
    longLoss[p] = Math.max(longLoss[p], -streak[p]);
  };

  // --- canonical order ---
  const ordered = [...games]
    .filter((g) => !g.deleted_at)
    .sort((a, b) => {
      if (a.played_at !== b.played_at) return a.played_at < b.played_at ? -1 : 1;
      if (a.session_seq !== b.session_seq) return a.session_seq - b.session_seq;
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const gameContexts: GameContext[] = [];
  const gameMovers: Record<string, { playerId: string; delta: number } | null> = {};
  const sessionsChrono: { id: string; playedOn: string }[] = [];
  const snapshotSession = (sess: { id: string; playedOn: string }) => {
    sessionsChrono.push(sess);
    for (const id of ids) {
      sessionRatingHistory[id].push({ sessionId: sess.id, playedOn: sess.playedOn, rating: rating[id] });
    }
  };

  let currentSession: { id: string; playedOn: string } | null = null;

  ordered.forEach((g, index) => {
    // Session boundary: snapshot the session we are leaving (games are contiguous
    // per session because played_at carries the date).
    if (currentSession && currentSession.id !== g.session_id) {
      snapshotSession(currentSession);
    }
    currentSession = { id: g.session_id, playedOn: g.played_on };

    const teamA: [string, string] = [g.team_a1, g.team_a2];
    const teamB: [string, string] = [g.team_b1, g.team_b2];
    const aWon = g.score_a > g.score_b;
    const winners = aWon ? teamA : teamB;
    const losers = aWon ? teamB : teamA;
    const winnerScore = aWon ? g.score_a : g.score_b;
    const loserScore = aWon ? g.score_b : g.score_a;
    const margin = winnerScore - loserScore;

    // Ratings & K BEFORE this game.
    const rW: [number, number] = [rating[winners[0]], rating[winners[1]]];
    const rL: [number, number] = [rating[losers[0]], rating[losers[1]]];
    const teamWinnerRatingBefore = (rW[0] + rW[1]) / 2;
    const teamLoserRatingBefore = (rL[0] + rL[1]) / 2;
    const kW: [number, number] = [kFactor(gp[winners[0]], config.K_SCHEDULE), kFactor(gp[winners[1]], config.K_SCHEDULE)];
    const kL: [number, number] = [kFactor(gp[losers[0]], config.K_SCHEDULE), kFactor(gp[losers[1]], config.K_SCHEDULE)];

    const upd = eloUpdate({
      teamARatings: rW,
      teamBRatings: rL,
      teamAKs: kW,
      teamBKs: kL,
      winner: "A",
      scale: config.RATING_SCALE,
    });
    rating[winners[0]] += upd.deltasA[0];
    rating[winners[1]] += upd.deltasA[1];
    rating[losers[0]] += upd.deltasB[0];
    rating[losers[1]] += upd.deltasB[1];

    // Game mover: the player who moved most in ABSOLUTE terms this game, keeping
    // the SIGNED delta (winners positive, losers negative). Deltas are signed,
    // so a winner and a loser with equal magnitude tie; first one wins the tie.
    const moverCandidates: { playerId: string; delta: number }[] = [
      { playerId: winners[0], delta: upd.deltasA[0] },
      { playerId: winners[1], delta: upd.deltasA[1] },
      { playerId: losers[0], delta: upd.deltasB[0] },
      { playerId: losers[1], delta: upd.deltasB[1] },
    ];
    let mover = moverCandidates[0];
    for (const c of moverCandidates) {
      if (Math.abs(c.delta) > Math.abs(mover.delta)) mover = c;
    }
    gameMovers[g.id] = mover;

    for (const p of [...winners, ...losers]) {
      gp[p] += 1;
      ratingHistory[p].push({ gameId: g.id, gameIndex: index, sessionId: g.session_id, playedOn: g.played_on, rating: rating[p] });
    }

    for (const p of winners) {
      wins[p] += 1;
      pf[p] += winnerScore;
      pa[p] += loserScore;
      applyWin(p);
    }
    for (const p of losers) {
      losses[p] += 1;
      pf[p] += loserScore;
      pa[p] += winnerScore;
      applyLoss(p);
    }

    // Head-to-head: every winner vs every loser (opposite teams).
    for (const w of winners) {
      for (const l of losers) {
        headToHead[w][l].games += 1;
        headToHead[w][l].wins += 1;
        headToHead[l][w].games += 1;
        headToHead[l][w].losses += 1;
      }
    }

    // Chemistry: the two teammates on each side.
    const addChem = (x: string, y: string, won: boolean, pd: number) => {
      const cell = chemRaw[x][y];
      cell.games += 1;
      cell.pdSum += pd;
      if (won) cell.wins += 1;
      else cell.losses += 1;
    };
    addChem(winners[0], winners[1], true, margin);
    addChem(winners[1], winners[0], true, margin);
    addChem(losers[0], losers[1], false, -margin);
    addChem(losers[1], losers[0], false, -margin);

    gameContexts.push({
      gameId: g.id,
      index,
      sessionId: g.session_id,
      playedOn: g.played_on,
      winners,
      losers,
      winnerScore,
      loserScore,
      margin,
      gameTarget: g.game_target,
      teamWinnerRatingBefore,
      teamLoserRatingBefore,
    });
  });

  if (currentSession) snapshotSession(currentSession);

  // --- finalize per-player stats ---
  const provisionalThreshold = config.K_SCHEDULE[0]?.underGames ?? 0;
  const perPlayer: Record<string, PlayerStats> = {};
  for (const id of ids) {
    const games_ = gp[id];
    const pointDiff = pf[id] - pa[id];
    perPlayer[id] = {
      playerId: id,
      gamesPlayed: games_,
      wins: wins[id],
      losses: losses[id],
      winPct: games_ > 0 ? wins[id] / games_ : null,
      pointsFor: pf[id],
      pointsAgainst: pa[id],
      pointDiff,
      avgPointDiff: games_ > 0 ? pointDiff / games_ : null,
      rating: rating[id],
      isProvisional: games_ < provisionalThreshold,
      currentStreak: streak[id],
      longestWinStreak: longWin[id],
      longestLossStreak: longLoss[id],
    };
  }

  // --- chemistry (shrunk) + best/worst partners + best/worst pairing ---
  const chemistry: Record<string, Record<string, ChemistryCell>> = {};
  for (const id of ids) chemistry[id] = {};
  const bestPartner: Record<string, PartnerRef | null> = {};
  const worstPartner: Record<string, PartnerRef | null> = {};
  let bestPairing: Pairing | null = null;
  let worstPairing: Pairing | null = null;
  const seenPair = new Set<string>();

  for (const id of ids) {
    let best: { ref: PartnerRef; shrunk: number } | null = null;
    let worst: { ref: PartnerRef; shrunk: number } | null = null;
    for (const other of ids) {
      if (other === id) continue;
      const raw = chemRaw[id][other];
      const shrunk = (raw.wins + config.SHRINK_K * 0.5) / (raw.games + config.SHRINK_K);
      chemistry[id][other] = {
        games: raw.games,
        wins: raw.wins,
        losses: raw.losses,
        winRate: raw.games > 0 ? raw.wins / raw.games : null,
        avgPointDiff: raw.games > 0 ? raw.pdSum / raw.games : null,
        shrunkWinRate: shrunk,
      };

      if (raw.games >= config.MIN_PAIR_GAMES) {
        const ref: PartnerRef = { partnerId: other, games: raw.games, wins: raw.wins, losses: raw.losses, winRate: raw.wins / raw.games };
        if (!best || shrunk > best.shrunk) best = { ref, shrunk };
        if (!worst || shrunk < worst.shrunk) worst = { ref, shrunk };

        // overall pairings, each unordered pair considered once
        const key = [id, other].sort().join("|");
        if (!seenPair.has(key)) {
          seenPair.add(key);
          const pairing: Pairing = {
            playerIds: [id, other].sort() as [string, string],
            games: raw.games,
            wins: raw.wins,
            losses: raw.losses,
            winRate: raw.wins / raw.games,
            shrunkWinRate: shrunk,
          };
          if (!bestPairing || pairing.shrunkWinRate > bestPairing.shrunkWinRate) bestPairing = pairing;
          if (!worstPairing || pairing.shrunkWinRate < worstPairing.shrunkWinRate) worstPairing = pairing;
        }
      }
    }
    bestPartner[id] = best?.ref ?? null;
    worstPartner[id] = worst?.ref ?? null;
  }

  // --- leaderboard with session-over-session rank movement ---
  const rankFromRatings = (ratingMap: Record<string, number>): Record<string, number> => {
    const order = [...ids].sort((x, y) => {
      if (ratingMap[y] !== ratingMap[x]) return ratingMap[y] - ratingMap[x];
      return (nameById.get(x) ?? x).localeCompare(nameById.get(y) ?? y);
    });
    const ranks: Record<string, number> = {};
    order.forEach((id, i) => (ranks[id] = i + 1));
    return ranks;
  };

  const currentRanks = rankFromRatings(rating);
  let previousRanks: Record<string, number> | null = null;
  if (sessionsChrono.length >= 2) {
    const prevSession = sessionsChrono[sessionsChrono.length - 2];
    const prevRatings: Record<string, number> = {};
    for (const id of ids) {
      const snap = sessionRatingHistory[id].find((s) => s.sessionId === prevSession.id);
      prevRatings[id] = snap ? snap.rating : config.INITIAL_RATING;
    }
    previousRanks = rankFromRatings(prevRatings);
  }

  const leaderboard: LeaderboardRow[] = [...ids]
    .sort((x, y) => currentRanks[x] - currentRanks[y])
    .map((id) => {
      const previousRank = previousRanks ? previousRanks[id] : null;
      return {
        ...perPlayer[id],
        rank: currentRanks[id],
        previousRank,
        rankDelta: previousRank !== null ? previousRank - currentRanks[id] : null,
      };
    });

  // --- badges ---
  const badges = deriveBadges({
    config,
    players,
    perPlayer,
    gameContexts,
    chemistry,
    bestPairing,
    headToHead,
    ratingHistory,
    sessionsChrono,
  });
  const badgesByPlayer: Record<string, Badge[]> = {};
  for (const id of ids) badgesByPlayer[id] = [];
  for (const b of badges) {
    if (!badgesByPlayer[b.playerId]) badgesByPlayer[b.playerId] = [];
    badgesByPlayer[b.playerId].push(b);
  }

  return {
    config,
    players,
    orderedGames: ordered,
    perPlayer,
    leaderboard,
    ratingHistory,
    sessionRatingHistory,
    headToHead,
    chemistry,
    bestPartner,
    worstPartner,
    bestPairing,
    worstPairing,
    badges,
    badgesByPlayer,
    gameMovers,
  };
}
