import { describe, expect, it } from "vitest";
import { resolveSessionId } from "@/lib/sessionLookup";

type Res = { data: { id: string } | null; error: unknown };

/** Returns the scripted results in order and counts calls. */
function scripted(results: Res[]) {
  let calls = 0;
  const fn = async (): Promise<Res> => results[calls++] ?? { data: null, error: { message: "unexpected call" } };
  return { fn, calls: () => calls };
}

const ok = (id: string): Res => ({ data: { id }, error: null });
const none: Res = { data: null, error: null };

describe("resolveSessionId", () => {
  it("returns an existing session without creating one", async () => {
    const find = scripted([ok("s1")]);
    const create = scripted([]);
    await expect(resolveSessionId(find.fn, create.fn)).resolves.toBe("s1");
    expect(create.calls()).toBe(0);
  });

  it("creates the session when none exists", async () => {
    const find = scripted([none]);
    const create = scripted([ok("new")]);
    await expect(resolveSessionId(find.fn, create.fn)).resolves.toBe("new");
    expect(find.calls()).toBe(1);
  });

  it("re-selects the racing session when create hits a unique violation", async () => {
    const find = scripted([none, ok("raced")]);
    const create = scripted([{ data: null, error: { code: "23505" } }]);
    await expect(resolveSessionId(find.fn, create.fn)).resolves.toBe("raced");
    expect(find.calls()).toBe(2);
    expect(create.calls()).toBe(1);
  });

  it("throws other create errors without re-selecting", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const find = scripted([none]);
    const create = scripted([{ data: null, error: denied }]);
    await expect(resolveSessionId(find.fn, create.fn)).rejects.toBe(denied);
    expect(find.calls()).toBe(1);
  });

  it("throws a find error", async () => {
    const boom = { code: "PGRST000", message: "boom" };
    const find = scripted([{ data: null, error: boom }]);
    const create = scripted([]);
    await expect(resolveSessionId(find.fn, create.fn)).rejects.toBe(boom);
    expect(create.calls()).toBe(0);
  });
});
