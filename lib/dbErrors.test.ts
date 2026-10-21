import { describe, expect, it } from "vitest";
import { isNoRows, isUniqueViolation } from "@/lib/dbErrors";

describe("isUniqueViolation", () => {
  it("is true for a Postgres unique_violation (SQLSTATE 23505)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("is false for another SQLSTATE", () => {
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
  });

  it("is false for null", () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("is false for a bare string", () => {
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("is false when code is a number rather than a string", () => {
    expect(isUniqueViolation({ code: 23505 })).toBe(false);
  });
});

describe("isNoRows", () => {
  it("is true for PostgREST PGRST116", () => {
    expect(isNoRows({ code: "PGRST116" })).toBe(true);
  });

  it("is false for another code and for null", () => {
    expect(isNoRows({ code: "23505" })).toBe(false);
    expect(isNoRows(null)).toBe(false);
  });
});
