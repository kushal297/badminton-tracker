import { describe, expect, it } from "vitest";
import { computeInsights, rankPairs, resolveWindow } from "@/lib/stats/computeInsights";
import { computeAll } from "@/lib/stats/computeAll";
import { STATS_CONFIG } from "@/lib/stats/config";
import type { Absence, GameWithDate, Player, Session } from "@/lib/types";
import type { ChemistryCell } from "@/lib/stats/types";

// ---- fixture helpers -------------------------------------------------------

const IDS = ["alice", "bob", "cara", "dan", "eve"] as const;

function players(): Player[] {
  return IDS.map((id) => ({
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

let gseq = 0;
function game(
  sessionId: string,
  playedOn: string,
  a1: string,
  a2: string,
  b1: string,
  b2: string,
  scoreA: number,
  scoreB: number,
): GameWithDate {
  gseq += 1;
  const ts = `${playedOn}T0${gseq % 9}:00:00Z`;
  return {
    id: `g${gseq}`,
    session_id: sessionId,
    session_seq: gseq,
    team_a1: a1,
    team_a2: a2,
    team_b1: b1,
    team_b2: b2,
    sat_out: null,
    score_a: scoreA,
    score_b: scoreB,
    game_target: 21,
    played_at: ts,
    deleted_at: null,
    created_at: ts,
    updated_at: ts,
    winner_team: scoreA > scoreB ? "A" : "B",
    player_ids: [a1, a2, b1, b2],
    played_on: playedOn,
  };
}

function absence(playerId: string, day: string): Absence {
  return { id: `abs-${playerId}-${day}`, player_id: playerId, noshow_on: day, note: null, created_at: "2026-02-01T00:00:00Z" };
}

const RATE = 6;

// ===========================================================================
// resolveWindow
// ===========================================================================

describe("resolveWindow", () => {
  it("day: start = end = anchor", () => {
    const w = resolveWindow("day", "2026-06-10", []);
    expect(w.kind).toBe("day");
    expect(w.startISO).toBe("2026-06-10");
    expect(w.endISO).toBe("2026-06-10");
  });

  it("week: start = anchor - 6 days, end = anchor", () => {
    const w = resolveWindow("week", "2026-06-10", []);
    expect(w.startISO).toBe("2026-06-04");
    expect(w.endISO).toBe("2026-06-10");
  });

  it("week handles month boundary via UTC date math", () => {
    const w = resolveWindow("week", "2026-03-03", []);
    expect(w.startISO).toBe("2026-02-25");
    expect(w.endISO).toBe("2026-03-03");
  });

  it("month: first..last calendar day of anchor's month", () => {
    const w = resolveWindow("month", "2026-02-14", []);
    expect(w.startISO).toBe("2026-02-01");
    expect(w.endISO).toBe("2026-02-28"); // 2026 is not a leap year
  });

  it("month handles 31-day months", () => {
    const w = resolveWindow("month", "2026-07-15", []);
    expect(w.startISO).toBe("2026-07-01");
    expect(w.endISO).toBe("2026-07-31");
  });

  it("all: min..max of datesWithGames", () => {
    const w = resolveWindow("all", "2026-06-10", ["2026-06-05", "2026-01-02", "2026-12-31"]);
    expect(w.startISO).toBe("2026-01-02");
    expect(w.endISO).toBe("2026-12-31");
    expect(w.label).toBe("All time");
  });

  it("all with no games falls back to anchor for both bounds", () => {
    const w = resolveWindow("all", "2026-06-10", []);
    expect(w.startISO).toBe("2026-06-10");
    expect(w.endISO).toBe("2026-06-10");
  });
});

// ===========================================================================
// computeInsights — window filtering
// ===========================================================================

describe("computeInsights — window filtering", () => {
  it("only counts games whose played_on falls inside [startISO, endISO]", () => {
    const ps = players();
    const sess = [session("s1", "2026-06-01"), session("s2", "2026-06-10"), session("s3", "2026-06-20")];
    const games = [
      game("s1", "2026-06-01", "alice", "bob", "cara", "dan", 21, 10), // before window
      game("s2", "2026-06-10", "alice", "bob", "cara", "dan", 21, 15), // in window
      game("s2", "2026-06-10", "alice", "cara", "bob", "dan", 21, 18), // in window
      game("s3", "2026-06-20", "alice", "bob", "cara", "dan", 5, 21), // after window
    ];
    const out = computeAll(ps, games, sess);
    const win = resolveWindow("day", "2026-06-10", ["2026-06-01", "2026-06-10", "2026-06-20"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    expect(ins.gamesPlayed).toBe(2);
    expect(ins.perPlayer.find((p) => p.playerId === "alice")?.gamesPlayed).toBe(2);
    expect(ins.perPlayer.find((p) => p.playerId === "alice")?.wins).toBe(2);
    expect(ins.perPlayer.find((p) => p.playerId === "dan")?.gamesPlayed).toBe(2);
    expect(ins.perPlayer.find((p) => p.playerId === "dan")?.wins).toBe(0);
    expect(ins.perPlayer.find((p) => p.playerId === "dan")?.losses).toBe(2);
  });

  it("tallies wins/losses/points only from in-window games", () => {
    const ps = players();
    const sess = [session("s2", "2026-06-10")];
    const games = [game("s2", "2026-06-10", "alice", "bob", "cara", "dan", 21, 15)];
    const out = computeAll(ps, games, sess);
    const win = resolveWindow("day", "2026-06-10", ["2026-06-10"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    const alice = ins.perPlayer.find((p) => p.playerId === "alice")!;
    expect(alice).toMatchObject({ wins: 1, losses: 0, winPct: 1, pointsFor: 21, pointsAgainst: 15, pointDiff: 6 });
    const dan = ins.perPlayer.find((p) => p.playerId === "dan")!;
    expect(dan).toMatchObject({ wins: 0, losses: 1, winPct: 0, pointsFor: 15, pointsAgainst: 21, pointDiff: -6 });
  });
});

// ===========================================================================
// computeInsights — within-window ratingDelta from history points
// ===========================================================================

describe("computeInsights — ratingDelta", () => {
  it("delta = (last rating <= endISO) - (last rating < startISO; else INITIAL_RATING)", () => {
    const ps = players();
    const sess = [session("s1", "2026-06-01"), session("s2", "2026-06-10")];
    // Alice wins on day 1 (rating climbs above INITIAL), then plays in window on day 2.
    const games = [
      game("s1", "2026-06-01", "alice", "bob", "cara", "dan", 21, 10),
      game("s2", "2026-06-10", "alice", "bob", "cara", "dan", 21, 12),
    ];
    const out = computeAll(ps, games, sess);

    // Window = day 2 only. Baseline is alice's rating after day 1 (< startISO),
    // end is alice's rating after day 2 (<= endISO). delta should be positive.
    const win = resolveWindow("day", "2026-06-10", ["2026-06-01", "2026-06-10"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    const history = out.ratingHistory["alice"];
    const baseline = history.filter((pt) => pt.playedOn < "2026-06-10").slice(-1)[0]!.rating;
    const end = history.filter((pt) => pt.playedOn <= "2026-06-10").slice(-1)[0]!.rating;
    const aliceDelta = ins.perPlayer.find((p) => p.playerId === "alice")!.ratingDelta;
    expect(aliceDelta).toBeCloseTo(end - baseline, 6);
    expect(aliceDelta).toBeGreaterThan(0);
  });

  it("baseline falls back to INITIAL_RATING when there is no history before the window", () => {
    const ps = players();
    const sess = [session("s1", "2026-06-01")];
    const games = [game("s1", "2026-06-01", "alice", "bob", "cara", "dan", 21, 10)];
    const out = computeAll(ps, games, sess);

    const win = resolveWindow("all", "2026-06-01", ["2026-06-01"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    const end = out.ratingHistory["alice"].slice(-1)[0]!.rating;
    const aliceDelta = ins.perPlayer.find((p) => p.playerId === "alice")!.ratingDelta;
    expect(aliceDelta).toBeCloseTo(end - out.config.INITIAL_RATING, 6);
  });
});

// ===========================================================================
// computeInsights — mvp / mostActive / biggestClimber-faller
// ===========================================================================

describe("computeInsights — superlatives", () => {
  it("mvp = most wins; mostActive = most games; biggestClimber/faller = extreme rating deltas", () => {
    const ps = players();
    const sess = [session("s2", "2026-06-10")];
    // Alice plays & wins 3, Bob plays 3 & wins 0; cara/dan/eve play fewer.
    const games = [
      game("s2", "2026-06-10", "alice", "cara", "bob", "dan", 21, 10),
      game("s2", "2026-06-10", "alice", "dan", "bob", "eve", 21, 12),
      game("s2", "2026-06-10", "alice", "eve", "bob", "cara", 21, 14),
    ];
    const out = computeAll(ps, games, sess);
    const win = resolveWindow("day", "2026-06-10", ["2026-06-10"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    expect(ins.mvp?.playerId).toBe("alice");
    expect(ins.mvp?.wins).toBe(3);
    // Alice and Bob both played 3, but mostActive breaks ties deterministically
    // toward the higher count holders; both have 3. Verify it's one of them.
    expect(ins.mostActive?.gamesPlayed).toBe(3);
    expect(["alice", "bob"]).toContain(ins.mostActive?.playerId);
    // Alice won everything -> biggest climber; Bob lost everything -> biggest faller.
    expect(ins.biggestClimber?.playerId).toBe("alice");
    expect(ins.biggestFaller?.playerId).toBe("bob");
  });

  it("all superlatives are null when no games fall in the window", () => {
    const ps = players();
    const sess = [session("s1", "2026-06-01")];
    const games = [game("s1", "2026-06-01", "alice", "bob", "cara", "dan", 21, 10)];
    const out = computeAll(ps, games, sess);
    const win = resolveWindow("day", "2026-12-25", ["2026-06-01"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    expect(ins.gamesPlayed).toBe(0);
    expect(ins.mvp).toBeNull();
    expect(ins.mostActive).toBeNull();
    expect(ins.biggestClimber).toBeNull();
    expect(ins.biggestFaller).toBeNull();
  });
});

// ===========================================================================
// computeInsights — no-shows in window + beersEarned
// ===========================================================================

describe("computeInsights — no-shows", () => {
  it("counts absences whose noshow_on is in the window and computes beersEarned", () => {
    const ps = players();
    const sess = [session("s2", "2026-06-10")];
    const games = [game("s2", "2026-06-10", "alice", "bob", "cara", "dan", 21, 10)];
    const out = computeAll(ps, games, sess);
    const absences = [
      absence("eve", "2026-06-09"), // in window
      absence("eve", "2026-06-10"), // in window (distinct day)
      absence("dan", "2026-06-10"), // in window
      absence("cara", "2026-05-01"), // out of window
    ];
    const win = resolveWindow("week", "2026-06-10", ["2026-06-10"]); // 2026-06-04 .. 2026-06-10
    const ins = computeInsights(out, ps, absences, RATE, win);

    expect(ins.noShows.count).toBe(3);
    expect(ins.noShows.playerIds.sort()).toEqual(["dan", "eve"]);
    expect(ins.beersEarned).toBe(3 * RATE);
  });

  it("builds at least one highlight", () => {
    const ps = players();
    const sess = [session("s2", "2026-06-10")];
    const games = [game("s2", "2026-06-10", "alice", "bob", "cara", "dan", 21, 10)];
    const out = computeAll(ps, games, sess);
    const win = resolveWindow("day", "2026-06-10", ["2026-06-10"]);
    const ins = computeInsights(out, ps, [], RATE, win);

    expect(ins.highlights.length).toBeGreaterThan(0);
    expect(ins.highlights[0]).toHaveProperty("emoji");
    expect(ins.highlights[0]).toHaveProperty("text");
  });
});

// ===========================================================================
// rankPairs
// ===========================================================================

describe("rankPairs", () => {
  function chem(games: number, wins: number, shrunk: number): ChemistryCell {
    return {
      games,
      wins,
      losses: games - wins,
      winRate: games > 0 ? wins / games : null,
      avgPointDiff: null,
      shrunkWinRate: shrunk,
    };
  }

  it("keeps pairs at/above the threshold and orders by shrunkWinRate desc, then games desc", () => {
    const ids = ["a", "b", "c"];
    const chemistry: Record<string, Record<string, ChemistryCell>> = {
      a: { b: chem(5, 4, 0.7), c: chem(2, 2, 0.9) }, // a-c has only 2 games (below default 3)
      b: { a: chem(5, 4, 0.7), c: chem(4, 1, 0.3) },
      c: { a: chem(2, 2, 0.9), b: chem(4, 1, 0.3) },
    };
    const pairs = rankPairs(chemistry, ids); // default MIN_PAIR_GAMES = 3

    // a-c (2 games) filtered out; remaining a-b (0.7) before b-c (0.3).
    expect(pairs.map((p) => p.playerIds.join("-"))).toEqual(["a-b", "b-c"]);
    expect(pairs[0]).toMatchObject({ games: 5, wins: 4, losses: 1, shrunkWinRate: 0.7 });
  });

  it("honors an explicit minGames threshold and iterates each unordered pair once", () => {
    const ids = ["a", "b", "c"];
    const chemistry: Record<string, Record<string, ChemistryCell>> = {
      a: { b: chem(5, 4, 0.7), c: chem(2, 2, 0.9) },
      b: { a: chem(5, 4, 0.7), c: chem(4, 1, 0.3) },
      c: { a: chem(2, 2, 0.9), b: chem(4, 1, 0.3) },
    };
    const pairs = rankPairs(chemistry, ids, 2);
    // Now a-c (0.9) qualifies and ranks first.
    expect(pairs.map((p) => p.playerIds.join("-"))).toEqual(["a-c", "a-b", "b-c"]);
    // Each unordered pair appears exactly once (3 distinct pairs).
    expect(pairs).toHaveLength(3);
  });

  it("breaks shrunkWinRate ties by games desc", () => {
    const ids = ["a", "b", "c"];
    const chemistry: Record<string, Record<string, ChemistryCell>> = {
      a: { b: chem(3, 2, 0.6), c: chem(6, 4, 0.6) },
      b: { a: chem(3, 2, 0.6), c: chem(3, 1, 0.2) },
      c: { a: chem(6, 4, 0.6), b: chem(3, 1, 0.2) },
    };
    const pairs = rankPairs(chemistry, ids, 3);
    // a-c and a-b tie on shrunkWinRate 0.6; a-c has more games -> first.
    expect(pairs[0].playerIds.join("-")).toBe("a-c");
    expect(pairs[1].playerIds.join("-")).toBe("a-b");
  });

  it("uses STATS_CONFIG.MIN_PAIR_GAMES as the default threshold", () => {
    expect(STATS_CONFIG.MIN_PAIR_GAMES).toBe(3);
  });
});
