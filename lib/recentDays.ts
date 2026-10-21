/** The `limit` newest days of a YYYY-MM-DD keyed map, newest first. */
export function recentDays<T>(byDay: Map<string, T[]>, limit: number): [string, T[]][] {
  return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, limit);
}
