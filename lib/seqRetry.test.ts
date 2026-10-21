import { describe, expect, it } from "vitest";
import { withUniqueRetry } from "@/lib/seqRetry";

type Res = { data: { attempt: number } | null; error: unknown };

/** A fake write that returns the scripted error for each call (null = success) and counts calls. */
function fakeWrite(errors: unknown[]) {
  let calls = 0;
  const write = async (): Promise<Res> => {
    calls++;
    const error = errors[calls - 1] ?? null;
    return error ? { data: null, error } : { data: { attempt: calls }, error: null };
  };
  return { write, calls: () => calls };
}

const collision = { code: "23505" };

describe("withUniqueRetry", () => {
  it("retries past two unique violations and returns the third attempt's data", async () => {
    const fake = fakeWrite([collision, collision]);
    await expect(withUniqueRetry(fake.write)).resolves.toEqual({ attempt: 3 });
    expect(fake.calls()).toBe(3);
  });

  it("returns null after three straight collisions, calling write exactly three times", async () => {
    const fake = fakeWrite([collision, collision, collision, collision]);
    await expect(withUniqueRetry(fake.write)).resolves.toBeNull();
    expect(fake.calls()).toBe(3);
  });

  it("throws a non-unique error at once without retrying", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const fake = fakeWrite([denied]);
    await expect(withUniqueRetry(fake.write)).rejects.toBe(denied);
    expect(fake.calls()).toBe(1);
  });

  it("re-invokes the closure on each attempt and returns the final call's data", async () => {
    const fake = fakeWrite([collision]);
    await expect(withUniqueRetry(fake.write)).resolves.toEqual({ attempt: 2 });
    expect(fake.calls()).toBe(2);
  });

  it("honours a custom attempt count", async () => {
    const fake = fakeWrite([collision, collision]);
    await expect(withUniqueRetry(fake.write, 2)).resolves.toBeNull();
    expect(fake.calls()).toBe(2);
  });
});
