/**
 * Reads every row of a query by paging. PostgREST caps a response at max_rows
 * (1000 by default), so an unpaginated select silently drops the rest.
 * `fetchPage` receives inclusive row bounds, as supabase-js `.range(from, to)`
 * expects (a supabase query builder is a PromiseLike). It must use a
 * deterministic order so pages do not overlap.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
