import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameInputSchema } from "./schemas";

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "22222222-2222-4222-8222-222222222222";
const B1 = "33333333-3333-4333-8333-333333333333";
const B2 = "44444444-4444-4444-8444-444444444444";
const REST = "55555555-5555-4555-8555-555555555555";

function valid(over: Record<string, unknown> = {}) {
  return {
    playedOn: "2026-06-15",
    teamA: [A1, A2],
    teamB: [B1, B2],
    satOut: REST,
    scoreA: 21,
    scoreB: 15,
    gameTarget: 21,
    ...over,
  };
}

describe("gameInputSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z")); // 17:30 in Asia/Kolkata, same calendar day
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a valid input", () => {
    expect(gameInputSchema.safeParse(valid()).success).toBe(true);
  });

  it("accepts today and a null satOut", () => {
    expect(gameInputSchema.safeParse(valid({ playedOn: "2026-06-15", satOut: null })).success).toBe(true);
  });

  it("rejects a date after today in Asia/Kolkata", () => {
    const res = gameInputSchema.safeParse(valid({ playedOn: "2026-06-16" }));
    expect(res.success).toBe(false);
  });

  it("computes today at parse time, not at module load", () => {
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
    expect(gameInputSchema.safeParse(valid({ playedOn: "2026-06-18" })).success).toBe(true);
  });

  it("rejects non-UUID player ids", () => {
    expect(gameInputSchema.safeParse(valid({ teamA: ["alice", A2] })).success).toBe(false);
    expect(gameInputSchema.safeParse(valid({ teamB: [B1, "x"] })).success).toBe(false);
    expect(gameInputSchema.safeParse(valid({ satOut: "bob" })).success).toBe(false);
  });

  it("rejects an empty-string satOut", () => {
    expect(gameInputSchema.safeParse(valid({ satOut: "" })).success).toBe(false);
  });

  it("still rejects duplicate players, satOut on court, and ties", () => {
    expect(gameInputSchema.safeParse(valid({ teamB: [A1, B2] })).success).toBe(false);
    expect(gameInputSchema.safeParse(valid({ satOut: A1 })).success).toBe(false);
    expect(gameInputSchema.safeParse(valid({ scoreA: 21, scoreB: 21 })).success).toBe(false);
  });
});
