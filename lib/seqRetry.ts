import { isUniqueViolation } from "@/lib/dbErrors";

/**
 * Runs a write that claims a fresh unique number (e.g. games.session_seq). When another save
 * took the same number, calls `write` again so it can recompute, up to `attempts` times in all.
 * Returns the written row, or null if every attempt collided. Any other error throws.
 * Lives outside the "use server" actions file because that file may only export async actions.
 */
export async function withUniqueRetry<T>(
  write: () => PromiseLike<{ data: T | null; error: unknown }>,
  attempts = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await write();
    if (!res.error) return res.data;
    if (!isUniqueViolation(res.error)) throw res.error;
  }
  return null;
}
