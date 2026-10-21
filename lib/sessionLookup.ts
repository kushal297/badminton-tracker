import { isUniqueViolation } from "@/lib/dbErrors";

type Lookup = () => PromiseLike<{ data: { id: string } | null; error: unknown }>;

/**
 * Returns the id from `find`, or from `create` when nothing was found. If `create` hits a unique
 * violation (another save created the row after our find), runs `find` again and returns that.
 */
export async function resolveSessionId(find: Lookup, create: Lookup): Promise<string> {
  const existing = await find();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const created = await create();
  if (!created.error && created.data) return created.data.id;
  if (!isUniqueViolation(created.error)) throw created.error ?? new Error("Creating the session returned no row.");

  const raced = await find();
  if (raced.error) throw raced.error;
  if (!raced.data) throw new Error("Session for that day was not found after a concurrent create.");
  return raced.data.id;
}
