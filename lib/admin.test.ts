import { afterEach, describe, expect, it } from "vitest";
import { verifyAdminPin } from "./admin";

describe("verifyAdminPin", () => {
  const original = process.env.ADMIN_PIN;
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = original;
  });

  it("accepts the default PIN (1234) when ADMIN_PIN is unset", () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin("1234")).toBe(true);
  });

  it("rejects a wrong PIN", () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin("0000")).toBe(false);
  });

  it("rejects empty, null, and undefined", () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin("")).toBe(false);
    expect(verifyAdminPin(null)).toBe(false);
    expect(verifyAdminPin(undefined)).toBe(false);
  });

  it("tolerates surrounding whitespace from the prompt", () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin("  1234 ")).toBe(true);
  });

  it("honours an ADMIN_PIN override", () => {
    process.env.ADMIN_PIN = "9999";
    expect(verifyAdminPin("9999")).toBe(true);
    expect(verifyAdminPin("1234")).toBe(false);
  });
});
