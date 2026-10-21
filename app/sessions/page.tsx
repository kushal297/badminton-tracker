import Link from "next/link";
import { getAllData } from "@/lib/data";
import { Card, EmptyState, PageHeader, btnPrimary } from "@/components/ui";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { games } = await getAllData();

  const counts = new Map<string, number>();
  for (const g of games) {
    if (g.deleted_at) continue;
    counts.set(g.played_on, (counts.get(g.played_on) ?? 0) + 1);
  }
  const days = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div>
      <PageHeader title="All sessions" subtitle={`${days.length} day${days.length === 1 ? "" : "s"} played`} />
      {days.length === 0 ? (
        <EmptyState
          title="No games yet"
          hint="Log your first 2v2 game and your sessions will show up here."
          action={
            <Link href="/new" className={btnPrimary}>
              <span aria-hidden>＋</span> Log a game
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {days.map(([date, count]) => (
            <Link
              key={date}
              href={`/sessions/${date}`}
              className="flex items-baseline justify-between gap-3 px-4 py-3 transition hover:bg-court-soft focus-visible:bg-court-soft"
            >
              <span className="font-medium">{formatDateLong(date)}</span>
              <span className="tnum text-sm text-muted">
                {count} game{count === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
