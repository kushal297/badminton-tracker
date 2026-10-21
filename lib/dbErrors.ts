/**
 * True for a Postgres unique_violation. supabase-js returns PostgrestError, whose `code`
 * is a string holding the Postgres SQLSTATE ("23505") or a PostgREST code ("PGRST…").
 */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}
