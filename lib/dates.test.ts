import { describe, expect, it } from "vitest";
import { isValidISODate } from "./dates";

describe("isValidISODate", () => {
  it("accepts real calendar days", () => {
    expect(isValidISODate("2026-06-15")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
  });
  it("rejects impossible days", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2027-02-29")).toBe(false);
  });
  it("rejects wrong shapes", () => {
    expect(isValidISODate("not-a-date")).toBe(false);
    expect(isValidISODate("2026-6-5")).toBe(false);
    expect(isValidISODate("")).toBe(false);
    expect(isValidISODate("2026-06-15T00:00")).toBe(false);
  });
});
