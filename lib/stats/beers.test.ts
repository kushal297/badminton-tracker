import { describe, expect, it } from "vitest";
import { computeBeers } from "@/lib/stats/beers";
import type { Absence, BeerClear, Player } from "@/lib/types";

// ---- fixture helpers -------------------------------------------------------

function players(): Player[] {
  return [
    { id: "alice", name: "Alice", color: null, photo_url: null, is_active: true, created_at: "2026-01-01T00:00:00Z" },
    { id: "bob", name: "Bob", color: null, photo_url: null, is_active: true, created_at: "2026-01-01T00:00:00Z" },
    { id: "cara", name: "Cara", color: null, photo_url: null, is_active: true, created_at: "2026-01-01T00:00:00Z" },
  ];
}

let seq = 0;
function absence(playerId: string, day: string): Absence {
  return { id: `abs-${seq++}`, player_id: playerId, noshow_on: day, note: null, created_at: "2026-02-01T00:00:00Z" };
}
function clear(playerId: string, beers: number): BeerClear {
  return { id: `clr-${seq++}`, player_id: playerId, beers, cleared_at: "2026-02-01T00:00:00Z" };
}

const RATE = 6;

// ---- earned / owed arithmetic ---------------------------------------------

describe("computeBeers — earned/cleared/owed arithmetic", () => {
  it("two no-shows at rate 6 => earned 12, owed 12", () => {
    const out = computeBeers(
      players(),
      [absence("alice", "s1"), absence("alice", "s2")],
      [],
      RATE,
    );
    expect(out.perPlayer.alice).toMatchObject({ playerId: "alice", absences: 2, earned: 12, cleared: 0, owed: 12 });
  });

  it("a beer_clear of 6 reduces owed to 6 but lifetime earned stays 12", () => {
    const out = computeBeers(
      players(),
      [absence("alice", "s1"), absence("alice", "s2")],
      [clear("alice", 6)],
      RATE,
    );
    expect(out.perPlayer.alice).toMatchObject({ absences: 2, earned: 12, cleared: 6, owed: 6 });
  });

  it("a full clear drives owed to 0; over-clearing never goes negative", () => {
    const out = computeBeers(
      players(),
      [absence("alice", "s1"), absence("alice", "s2")],
      [clear("alice", 6), clear("alice", 6), clear("alice", 6)], // cleared 18 > earned 12
      RATE,
    );
    expect(out.perPlayer.alice).toMatchObject({ earned: 12, cleared: 18, owed: 0 });
  });

  it("players with no absences are present with all zeros", () => {
    const out = computeBeers(players(), [], [], RATE);
    expect(out.perPlayer.bob).toEqual({ playerId: "bob", absences: 0, earned: 0, cleared: 0, owed: 0 });
    expect(Object.keys(out.perPlayer).sort()).toEqual(["alice", "bob", "cara"]);
  });

});

// ---- board ordering & sleepyhead ------------------------------------------

describe("computeBeers — board ordering and sleepyhead", () => {
  it("ranks by owed desc, tiebreak earned desc, then name asc", () => {
    // alice: 1 no-show, no clears -> earned 6, owed 6
    // bob:   2 no-shows, cleared 6 -> earned 12, owed 6  (ties alice on owed; higher earned ranks first)
    // cara:  1 no-show, no clears -> earned 6, owed 6   (ties alice on owed AND earned; name "Cara" > "Alice")
    const out = computeBeers(
      players(),
      [
        absence("alice", "s1"),
        absence("bob", "s1"),
        absence("bob", "s2"),
        absence("cara", "s1"),
      ],
      [clear("bob", 6)],
      RATE,
    );
    expect(out.board.map((b) => b.playerId)).toEqual(["bob", "alice", "cara"]);
    expect(out.board[0]).toMatchObject({ playerId: "bob", earned: 12, owed: 6 });
    expect(out.board[1]).toMatchObject({ playerId: "alice", earned: 6, owed: 6 });
    expect(out.board[2]).toMatchObject({ playerId: "cara", earned: 6, owed: 6 });
  });

  it("sleepyhead is the top ower", () => {
    const out = computeBeers(
      players(),
      [absence("alice", "s1"), absence("alice", "s2"), absence("bob", "s1")],
      [],
      RATE,
    );
    expect(out.sleepyheadId).toBe("alice");
    expect(out.board[0].playerId).toBe("alice");
  });

  it("sleepyhead is null when everyone owes zero", () => {
    const out = computeBeers(players(), [], [], RATE);
    expect(out.board[0].owed).toBe(0);
    expect(out.sleepyheadId).toBeNull();
  });

  it("sleepyhead is null even when there are cleared beers but nothing owed", () => {
    const out = computeBeers(
      players(),
      [absence("alice", "s1")],
      [clear("alice", 6)], // earned 6, cleared 6 -> owed 0
      RATE,
    );
    expect(out.sleepyheadId).toBeNull();
  });
});

// ---- shape & rate ----------------------------------------------------------

describe("computeBeers — result shape", () => {
  it("echoes the rate, keys perPlayer by every player, and board lists everyone", () => {
    const out = computeBeers(players(), [absence("alice", "s1")], [], RATE);
    expect(out.ratePerNoShow).toBe(RATE);
    expect(Object.keys(out.perPlayer).sort()).toEqual(["alice", "bob", "cara"]);
    expect(out.board).toHaveLength(3);
  });
});
