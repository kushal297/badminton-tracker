import { describe, expect, it } from "vitest";
import { deriveSatOut } from "@/lib/satOut";

describe("deriveSatOut", () => {
  it("create + one resting returns that player", () => {
    expect(deriveSatOut(["a"], undefined)).toBe("a");
  });
  it("create + two resting returns null", () => {
    expect(deriveSatOut(["a", "b"], undefined)).toBeNull();
  });
  it("create + zero resting returns null", () => {
    expect(deriveSatOut([], undefined)).toBeNull();
  });
  it("edit + stored among two resting keeps stored", () => {
    expect(deriveSatOut(["a", "b"], "b")).toBe("b");
  });
  it("edit + stored moved onto court and one other resting returns null", () => {
    expect(deriveSatOut(["a"], "z")).toBeNull();
  });
  it("edit + stored null and one resting returns null", () => {
    expect(deriveSatOut(["a"], null)).toBeNull();
  });
});
