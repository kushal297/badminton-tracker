import { describe, expect, it } from "vitest";
import { PLAYER_PALETTE, assignPlayerColors, colorForPlayer } from "@/lib/players";

const unsaved = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, color: null }));

describe("assignPlayerColors", () => {
  it("gives 8 unsaved players 8 distinct palette colours", () => {
    const map = assignPlayerColors(unsaved(8));
    const colors = [...map.values()];
    expect(new Set(colors).size).toBe(8);
    for (const c of colors) expect(PLAYER_PALETTE).toContain(c);
  });

  it("keeps a saved colour and never hands it to anyone else", () => {
    const players = [{ id: "a", color: null }, { id: "b", color: "#123456" }, ...unsaved(3)];
    const map = assignPlayerColors(players);
    expect(map.get("b")).toBe("#123456");
    const others = [...map.entries()].filter(([id]) => id !== "b").map(([, c]) => c);
    expect(others).not.toContain("#123456");
  });

  it("does not reuse a saved palette colour for an unsaved player", () => {
    const players = [{ id: "a", color: null }, { id: "b", color: PLAYER_PALETTE[0] }];
    const map = assignPlayerColors(players);
    expect(map.get("a")).not.toBe(PLAYER_PALETTE[0]);
  });

  it("a saved colour reserves its palette entry regardless of case", () => {
    const players = [{ id: "a", color: "#0b6e4f" }, { id: "b", color: null }];
    const map = assignPlayerColors(players);
    expect(map.get("a")).toBe("#0b6e4f");
    expect(map.get("b")).not.toBe("#0B6E4F");
    expect(map.get("b")).not.toBe("#0b6e4f");
  });

  it("is deterministic", () => {
    const players = unsaved(5);
    expect(assignPlayerColors(players)).toEqual(assignPlayerColors(players));
  });

  it("cycles the palette once it is exhausted", () => {
    const map = assignPlayerColors(unsaved(9));
    const colors = [...map.values()];
    expect(new Set(colors.slice(0, 8)).size).toBe(8);
    expect(PLAYER_PALETTE).toContain(colors[8]);
  });
});

describe("colorForPlayer", () => {
  it("prefers the saved colour", () => {
    expect(colorForPlayer({ id: "x", color: "#abcdef" })).toBe("#abcdef");
  });
});
