import { describe, expect, it } from "vitest";
import { eloUpdate, expectedScoreA, kFactor, teamRating } from "@/lib/stats/elo";
import { STATS_CONFIG } from "@/lib/stats/config";

describe("expectedScoreA", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScoreA(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it("matches the logistic formula for the worked example (R_A=1050 vs R_B=980)", () => {
    expect(expectedScoreA(1050, 980)).toBeCloseTo(0.5994, 4);
  });

  it("a 400-point edge is ~10:1 odds (~0.909)", () => {
    expect(expectedScoreA(1400, 1000)).toBeCloseTo(10 / 11, 4);
  });

  it("is symmetric: E_A(a,b) + E_A(b,a) === 1", () => {
    expect(expectedScoreA(1234, 987) + expectedScoreA(987, 1234)).toBeCloseTo(1, 10);
  });
});

describe("kFactor (tiered 40 / 24 / 16)", () => {
  it("uses K=40 while provisional (<10 games)", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(5)).toBe(40);
    expect(kFactor(9)).toBe(40);
  });
  it("uses K=24 for 10..29 games", () => {
    expect(kFactor(10)).toBe(24);
    expect(kFactor(12)).toBe(24);
    expect(kFactor(29)).toBe(24);
  });
  it("uses K=16 once settled (>=30 games)", () => {
    expect(kFactor(30)).toBe(16);
    expect(kFactor(250)).toBe(16);
  });
});

describe("teamRating", () => {
  it("is the mean of the two partners", () => {
    expect(teamRating(1080, 1020)).toBe(1050);
    expect(teamRating(1000, 960)).toBe(980);
  });
});

describe("eloUpdate — the plan's worked example", () => {
  // Eve sits. Team A = {Alice 1080/GP12, Bob 1020/GP8} beat Team B = {Cara 1000/GP25, Dan 960/GP5} 21-17.
  const result = eloUpdate({
    teamARatings: [1080, 1020],
    teamBRatings: [1000, 960],
    teamAKs: [kFactor(12), kFactor(8)], // [24, 40]
    teamBKs: [kFactor(25), kFactor(5)], // [24, 40]
    winner: "A",
    scale: STATS_CONFIG.RATING_SCALE,
  });

  it("computes the expected score for team A", () => {
    expect(result.expectedA).toBeCloseTo(0.5994, 4);
  });

  it("produces the four deltas +9.6 / +16.0 / -9.6 / -16.0", () => {
    expect(result.deltasA[0]).toBeCloseTo(9.6, 1); // Alice (K=24)
    expect(result.deltasA[1]).toBeCloseTo(16.0, 1); // Bob (K=40)
    expect(result.deltasB[0]).toBeCloseTo(-9.6, 1); // Cara (K=24)
    expect(result.deltasB[1]).toBeCloseTo(-16.0, 1); // Dan (K=40)
  });

  it("yields the new ratings 1089.6 / 1036.0 / 990.4 / 944.0", () => {
    expect(1080 + result.deltasA[0]).toBeCloseTo(1089.6, 1);
    expect(1020 + result.deltasA[1]).toBeCloseTo(1036.0, 1);
    expect(1000 + result.deltasB[0]).toBeCloseTo(990.4, 1);
    expect(960 + result.deltasB[1]).toBeCloseTo(944.0, 1);
  });

  it("winner's gains exactly mirror the loser's losses for equal Ks", () => {
    // Alice (K=24) gain mirrors Cara (K=24) loss; Bob (K=40) mirrors Dan (K=40).
    expect(result.deltasA[0]).toBeCloseTo(-result.deltasB[0], 10);
    expect(result.deltasA[1]).toBeCloseTo(-result.deltasB[1], 10);
  });
});
