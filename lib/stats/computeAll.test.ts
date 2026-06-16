import { describe, expect, it } from "vitest";
import { computeAll } from "@/lib/stats/computeAll";
import { STATS_CONFIG } from "@/lib/stats/config";
import type { GameWithDate, Player, Session } from "@/lib/types";

// ---- fixture helpers -------------------------------------------------------

const PLAYER_IDS = ["alice", "bob", "cara", "dan", "eve"] as const;

function players(): Player[] {
  return PLAYER_IDS.map((id) => ({
    id,
    name: id,
    color: null,
    photo_url: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  }));
}

function session(id: string, played_on: string): Session {
  return { id, played_on, label: null, created_at: `${played_on}T00:00:00Z` };
}

let clock = 0;
function game(opts: {
  id: string;
  session: Session;
  seq?: number;
  a: [string, string];
  b: [string, string];
  out?: string | null;
  scoreA: number;
  scoreB: number;
  target?: number;
  playedAt?: string;
}): GameWithDate {
  const playedAt = opts.playedAt ?? `${opts.session.played_on}T10:${String(clock++).padStart(2, "0")}:00Z`;
  return {
    id: opts.id,
    session_id: opts.session.id,
    session_seq: opts.seq ?? 0,
    team_a1: opts.a[0],
    team_a2: opts.a[1],
    team_b1: opts.b[0],
    team_b2: opts.b[1],
    sat_out: opts.out ?? null,
    score_a: opts.scoreA,
    score_b: opts.scoreB,
    game_target: opts.target ?? 21,
    played_at: playedAt,
    deleted_at: null,
    created_at: playedAt,
    updated_at: playedAt,
    winner_team: opts.scoreA > opts.scoreB ? "A" : "B",
    player_ids: [opts.a[0], opts.a[1], opts.b[0], opts.b[1]],
    played_on: opts.session.played_on,
  };
}

function ratingsOf(players_: Player[], games: GameWithDate[], sessions: Session[]) {
  const out = computeAll(players_, games, sessions);
  return Object.fromEntries(
    Object.values(out.perPlayer).map((p) => [p.playerId, Math.round(p.rating * 1e6) / 1e6]),
  );
}

// ---- basic tallies & sit-out inertness ------------------------------------

describe("computeAll — basic tallies and sit-out inertness", () => {
  const s = session("s1", "2026-02-01");
  const games = [
    game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 15 }),
  ];
  const out = computeAll(players(), games, [s]);

  it("counts wins, losses, points for the four players who played", () => {
    expect(out.perPlayer.alice).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0, pointsFor: 21, pointsAgainst: 15, pointDiff: 6 });
    expect(out.perPlayer.bob).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0, pointDiff: 6 });
    expect(out.perPlayer.cara).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1, pointsFor: 15, pointsAgainst: 21, pointDiff: -6 });
    expect(out.perPlayer.dan).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 });
  });

  it("win% is a fraction, null when no games played", () => {
    expect(out.perPlayer.alice.winPct).toBe(1);
    expect(out.perPlayer.cara.winPct).toBe(0);
    expect(out.perPlayer.eve.winPct).toBeNull();
  });

  it("the sit-out player is completely inert (no games, rating unchanged, no streak, no history)", () => {
    expect(out.perPlayer.eve).toMatchObject({ gamesPlayed: 0, wins: 0, losses: 0, currentStreak: 0 });
    expect(out.perPlayer.eve.rating).toBe(STATS_CONFIG.INITIAL_RATING);
    expect(out.ratingHistory.eve ?? []).toHaveLength(0);
  });

  it("applies the first-game Elo update (provisional K=40, even teams): winners 1020, losers 980", () => {
    expect(out.perPlayer.alice.rating).toBeCloseTo(1020, 6);
    expect(out.perPlayer.bob.rating).toBeCloseTo(1020, 6);
    expect(out.perPlayer.cara.rating).toBeCloseTo(980, 6);
    expect(out.perPlayer.dan.rating).toBeCloseTo(980, 6);
  });

  it("records one rating-history point per game played", () => {
    expect(out.ratingHistory.alice).toHaveLength(1);
    expect(out.ratingHistory.alice[0].rating).toBeCloseTo(1020, 6);
  });
});

// ---- order-determinism & edit/delete invariance ---------------------------

describe("computeAll — deterministic & edit/delete safe", () => {
  const s = session("s1", "2026-02-01");
  const g1 = game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 10, playedAt: "2026-02-01T10:00:00Z" });
  const g2 = game({ id: "g2", session: s, seq: 2, a: ["alice", "cara"], b: ["bob", "eve"], out: "dan", scoreA: 18, scoreB: 21, playedAt: "2026-02-01T10:10:00Z" });
  const g3 = game({ id: "g3", session: s, seq: 3, a: ["dan", "eve"], b: ["alice", "bob"], out: "cara", scoreA: 21, scoreB: 19, playedAt: "2026-02-01T10:20:00Z" });
  const base = [g1, g2, g3];

  it("ignores input array order (sorts into a canonical replay order)", () => {
    const shuffled = [g3, g1, g2];
    expect(ratingsOf(players(), shuffled, [s])).toEqual(ratingsOf(players(), base, [s]));
  });

  it("inserting a game then deleting it returns to the baseline ratings exactly", () => {
    const gX = game({ id: "gX", session: s, seq: 2, a: ["cara", "eve"], b: ["alice", "dan"], out: "bob", scoreA: 21, scoreB: 5, playedAt: "2026-02-01T10:05:00Z" });
    const withX = [g1, gX, g2, g3];
    const afterDelete = withX.filter((g) => g.id !== "gX");
    expect(ratingsOf(players(), afterDelete, [s])).toEqual(ratingsOf(players(), base, [s]));
  });

  it("rating pool is conservative when all four players share the same K", () => {
    // Every player is provisional (K=40) here, so total rating must stay 5 * INITIAL.
    const out = computeAll(players(), base, [s]);
    const total = Object.values(out.perPlayer).reduce((sum, p) => sum + p.rating, 0);
    expect(total).toBeCloseTo(5 * STATS_CONFIG.INITIAL_RATING, 4);
  });
});

// ---- head-to-head, chemistry, partners ------------------------------------

describe("computeAll — head-to-head and chemistry", () => {
  const s = session("s1", "2026-03-01");
  // alice+bob pairing: 3 games, all wins.
  // alice+dan pairing: 4 games, 3 wins + 1 loss.
  const games = [
    game({ id: "ab1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 10 }),
    game({ id: "ab2", session: s, seq: 2, a: ["alice", "bob"], b: ["cara", "eve"], out: "dan", scoreA: 21, scoreB: 12 }),
    game({ id: "ab3", session: s, seq: 3, a: ["alice", "bob"], b: ["dan", "eve"], out: "cara", scoreA: 21, scoreB: 14 }),
    game({ id: "ad1", session: s, seq: 4, a: ["alice", "dan"], b: ["bob", "cara"], out: "eve", scoreA: 21, scoreB: 15 }),
    game({ id: "ad2", session: s, seq: 5, a: ["alice", "dan"], b: ["bob", "eve"], out: "cara", scoreA: 21, scoreB: 16 }),
    game({ id: "ad3", session: s, seq: 6, a: ["alice", "dan"], b: ["cara", "eve"], out: "bob", scoreA: 21, scoreB: 17 }),
    game({ id: "ad4", session: s, seq: 7, a: ["alice", "dan"], b: ["bob", "cara"], out: "eve", scoreA: 15, scoreB: 21 }),
  ];
  const out = computeAll(players(), games, [s]);

  it("chemistry counts only same-team games", () => {
    expect(out.chemistry.alice.bob).toMatchObject({ games: 3, wins: 3, losses: 0 });
    expect(out.chemistry.alice.dan).toMatchObject({ games: 4, wins: 3, losses: 1 });
  });

  it("chemistry is symmetric", () => {
    expect(out.chemistry.bob.alice).toMatchObject({ games: 3, wins: 3, losses: 0 });
    expect(out.chemistry.dan.alice).toMatchObject({ games: 4, wins: 3, losses: 1 });
  });

  it("shrinks small samples toward .500 for ranking but reports raw win rate", () => {
    // alice+bob 3-0 -> shrunk (3+1)/(3+2)=0.8 ; alice+dan 3-1 -> shrunk (3+1)/(4+2)=0.6667
    expect(out.chemistry.alice.bob.winRate).toBeCloseTo(1, 6);
    expect(out.chemistry.alice.bob.shrunkWinRate).toBeCloseTo(0.8, 6);
    expect(out.chemistry.alice.dan.shrunkWinRate).toBeCloseTo(4 / 6, 6);
  });

  it("ranks best/worst partner by shrunk win rate among eligible pairs (>= MIN_PAIR_GAMES)", () => {
    expect(out.bestPartner.alice?.partnerId).toBe("bob");
    expect(out.worstPartner.alice?.partnerId).toBe("dan");
  });

  it("head-to-head counts only opposite-team games and is anti-symmetric", () => {
    for (const i of PLAYER_IDS) {
      for (const j of PLAYER_IDS) {
        if (i === j) continue;
        const ij = out.headToHead[i][j];
        const ji = out.headToHead[j][i];
        expect(ij.games).toBe(ji.games);
        expect(ij.wins).toBe(ji.losses);
        expect(ij.losses).toBe(ji.wins);
      }
    }
    // alice vs cara: opposite teams in ab1, ab2, ad1, ad3, ad4 -> alice 4 wins, 1 loss.
    expect(out.headToHead.alice.cara).toMatchObject({ games: 5, wins: 4, losses: 1 });
  });
});

// ---- streaks ---------------------------------------------------------------

describe("computeAll — streaks", () => {
  const s = session("s1", "2026-04-01");

  it("tracks signed current streak and longest win/loss streaks in game order", () => {
    // alice: Win, Win, Loss  ->  current -1, longestWin 2, longestLoss 1
    const games = [
      game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 1 }),
      game({ id: "g2", session: s, seq: 2, a: ["alice", "cara"], b: ["bob", "dan"], out: "eve", scoreA: 21, scoreB: 2 }),
      game({ id: "g3", session: s, seq: 3, a: ["alice", "dan"], b: ["bob", "cara"], out: "eve", scoreA: 3, scoreB: 21 }),
    ];
    const out = computeAll(players(), games, [s]);
    expect(out.perPlayer.alice).toMatchObject({ currentStreak: -1, longestWinStreak: 2, longestLossStreak: 1 });
  });

  it("a sat-out game does not break a streak", () => {
    // alice: Win, (sits), Win -> current +2
    const games = [
      game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 5 }),
      game({ id: "g2", session: s, seq: 2, a: ["bob", "cara"], b: ["dan", "eve"], out: "alice", scoreA: 21, scoreB: 5 }),
      game({ id: "g3", session: s, seq: 3, a: ["alice", "dan"], b: ["bob", "eve"], out: "cara", scoreA: 21, scoreB: 5 }),
    ];
    const out = computeAll(players(), games, [s]);
    expect(out.perPlayer.alice.currentStreak).toBe(2);
  });
});

// ---- leaderboard -----------------------------------------------------------

describe("computeAll — leaderboard", () => {
  it("is sorted by rating and assigns ranks; empty data is handled", () => {
    const empty = computeAll(players(), [], []);
    expect(empty.leaderboard).toHaveLength(5);
    expect(empty.leaderboard.every((r) => r.rating === STATS_CONFIG.INITIAL_RATING)).toBe(true);

    const s = session("s1", "2026-05-01");
    const games = [
      game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 5 }),
    ];
    const out = computeAll(players(), games, [s]);
    const ratingsDesc = out.leaderboard.map((r) => r.rating);
    expect([...ratingsDesc]).toEqual([...ratingsDesc].sort((a, b) => b - a));
    expect(out.leaderboard[0].rank).toBe(1);
  });
});

// ---- game movers -----------------------------------------------------------

describe("computeAll — gameMovers", () => {
  it("on the even-teams worked example, the top mover's delta magnitude is 20", () => {
    // All players start at 1000, K=40 provisional, expected = 0.5.
    // Each delta = 40 * (1 - 0.5) = +20 for winners, -20 for losers.
    const s = session("s1", "2026-05-01");
    const g1 = game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 5 });
    const out = computeAll(players(), [g1], [s]);

    const mover = out.gameMovers.g1;
    expect(mover).not.toBeNull();
    expect(Math.abs(mover!.delta)).toBeCloseTo(20, 6);
    expect(["alice", "bob", "cara", "dan"]).toContain(mover!.playerId);
  });

  it("has exactly one entry per non-deleted game", () => {
    const s = session("s1", "2026-05-01");
    const games = [
      game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 5 }),
      game({ id: "g2", session: s, seq: 2, a: ["alice", "cara"], b: ["bob", "eve"], out: "dan", scoreA: 18, scoreB: 21 }),
      game({ id: "g3", session: s, seq: 3, a: ["dan", "eve"], b: ["alice", "bob"], out: "cara", scoreA: 21, scoreB: 19 }),
    ];
    const out = computeAll(players(), games, [s]);
    expect(Object.keys(out.gameMovers).sort()).toEqual(["g1", "g2", "g3"]);
    for (const id of ["g1", "g2", "g3"]) {
      expect(out.gameMovers[id]).not.toBeNull();
    }
  });

  it("the mover's signed delta sign matches whether they won (positive) or lost (negative)", () => {
    const s = session("s1", "2026-05-01");
    const g1 = game({ id: "g1", session: s, seq: 1, a: ["alice", "bob"], b: ["cara", "dan"], out: "eve", scoreA: 21, scoreB: 5 });
    const out = computeAll(players(), [g1], [s]);
    const mover = out.gameMovers.g1!;
    const aliceWon = ["alice", "bob"].includes(mover.playerId);
    expect(Math.sign(mover.delta)).toBe(aliceWon ? 1 : -1);
  });
});
