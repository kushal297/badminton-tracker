import { describe, expect, it } from "vitest";
import { recentDays } from "@/lib/recentDays";

describe("recentDays", () => {
  it("returns the newest N days, descending, with arrays intact", () => {
    const byDay = new Map<string, string[]>();
    byDay.set("2026-06-03", ["c"]);
    byDay.set("2026-06-07", ["g1", "g2"]);
    byDay.set("2026-06-01", ["a"]);
    byDay.set("2026-06-06", ["f"]);
    byDay.set("2026-06-02", ["b"]);
    byDay.set("2026-06-05", ["e"]);
    byDay.set("2026-06-04", ["d"]);
    const out = recentDays(byDay, 5);
    expect(out.map(([d]) => d)).toEqual([
      "2026-06-07", "2026-06-06", "2026-06-05", "2026-06-04", "2026-06-03",
    ]);
    expect(out[0][1]).toBe(byDay.get("2026-06-07"));
  });

  it("returns all days descending when fewer than the limit", () => {
    const byDay = new Map([["2026-06-01", [1]], ["2026-06-03", [3]], ["2026-06-02", [2]]]);
    expect(recentDays(byDay, 5).map(([d]) => d)).toEqual(["2026-06-03", "2026-06-02", "2026-06-01"]);
  });

  it("returns [] for an empty map", () => {
    expect(recentDays(new Map<string, number[]>(), 5)).toEqual([]);
  });

  it("returns [] for limit 0", () => {
    expect(recentDays(new Map([["2026-06-01", [1]]]), 0)).toEqual([]);
  });
});
