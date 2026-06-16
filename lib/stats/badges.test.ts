import { describe, expect, it } from "vitest";
import { computeAll } from "@/lib/stats/computeAll";
import { STATS_CONFIG } from "@/lib/stats/config";
import type { GameWithDate, Player, Session } from "@/lib/types";

const IDS = ["alice", "bob", "cara", "dan", "eve"] as const;
const players = (): Player[] =>
  IDS.map((id) => ({ id, name: id, color: null, photo_url: null, is_active: true, created_at: "2026-01-01T00:00:00Z" }));
const S = (id: string, played_on: string): Session => ({ id, played_on, label: null, created_at: `${played_on}T00:00:00Z` });

function world(played_on = "2026-02-01") {
  const s = S("s1", played_on);
  let seq = 0;
  const games: GameWithDate[] = [];
  const g = (a: [string, string], b: [string, string], out: string | null, sa: number, sb: number, target = 21) => {
    seq += 1;
    const at = `${played_on}T10:${String(seq).padStart(2, "0")}:00Z`;
    games.push({
      id: `g${seq}`,
      session_id: s.id,
      session_seq: seq,
      team_a1: a[0],
      team_a2: a[1],
      team_b1: b[0],
      team_b2: b[1],
      sat_out: out,
      score_a: sa,
      score_b: sb,
      game_target: target,
      played_at: at,
      deleted_at: null,
      created_at: at,
      updated_at: at,
      winner_team: sa > sb ? "A" : "B",
      player_ids: [a[0], a[1], b[0], b[1]],
      played_on,
    });
  };
  return { s, games, g };
}

const codes = (out: ReturnType<typeof computeAll>, id: string) => out.badgesByPlayer[id].map((b) => b.code);

describe("badges", () => {
  it("Perfect Game when a winner concedes zero", () => {
    const w = world();
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 0);
    const out = computeAll(players(), w.games, [w.s]);
    expect(codes(out, "alice")).toContain("perfect_game");
    expect(codes(out, "bob")).toContain("perfect_game");
    expect(codes(out, "cara")).not.toContain("perfect_game");
  });

  it("Nail-biter on a 2-point win and Deuce Thriller past the target", () => {
    const w = world();
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 19); // nail-biter, not deuce (21 == target)
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 23, 21); // deuce thriller (23 > 21, margin 2)
    const out = computeAll(players(), w.games, [w.s]);
    expect(codes(out, "alice")).toContain("nail_biter");
    expect(codes(out, "alice")).toContain("deuce_thriller");
  });

  it("On Fire after three straight wins", () => {
    const w = world();
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 5);
    w.g(["alice", "cara"], ["bob", "dan"], "eve", 21, 6);
    w.g(["alice", "dan"], ["bob", "cara"], "eve", 21, 7);
    const out = computeAll(players(), w.games, [w.s]);
    expect(out.perPlayer.alice.currentStreak).toBe(3);
    expect(codes(out, "alice")).toContain("on_fire");
  });

  it("Giant-Killer when underdogs beat a clearly stronger team", () => {
    const w = world();
    w.g(["cara", "dan"], ["alice", "bob"], "eve", 21, 5); // cara/dan rise, alice/bob fall
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 19); // underdogs alice/bob win
    const out = computeAll(players(), w.games, [w.s], { ...STATS_CONFIG, GK_MARGIN: 20 });
    expect(codes(out, "alice")).toContain("giant_killer");
    expect(codes(out, "bob")).toContain("giant_killer");
  });

  it("Best Partnership goes to the top eligible pairing (both players)", () => {
    const w = world();
    w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 10);
    w.g(["alice", "bob"], ["cara", "eve"], "dan", 21, 12);
    w.g(["alice", "bob"], ["dan", "eve"], "cara", 21, 14);
    const out = computeAll(players(), w.games, [w.s]);
    expect(out.bestPairing?.playerIds).toEqual(["alice", "bob"]);
    expect(codes(out, "alice")).toContain("best_partnership");
    expect(codes(out, "bob")).toContain("best_partnership");
  });

  it("Workhorse to the player with the most games; Milestone at 25 games", () => {
    const w = world();
    for (let i = 0; i < 25; i++) w.g(["alice", "bob"], ["cara", "dan"], "eve", 21, 5);
    const out = computeAll(players(), w.games, [w.s]);
    expect(out.perPlayer.alice.gamesPlayed).toBe(25);
    expect(codes(out, "alice")).toContain("workhorse");
    expect(out.badgesByPlayer.alice.some((b) => b.code === "milestone" && b.label === "25 Games")).toBe(true);
    // eve sat every game -> no participation badges
    expect(codes(out, "eve")).not.toContain("workhorse");
  });
});
