import Link from "next/link";
import { getAllData } from "@/lib/data";
import { GameRow } from "@/components/GameRow";
import { PageHeader, EmptyState, btnPrimary } from "@/components/ui";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const { players, games } = await getAllData();
  const playersById = new Map(players.map((p) => [p.id, p]));

  const dayGames = games
    .filter((g) => g.played_on === date)
    .sort((a, b) => a.session_seq - b.session_seq || a.played_at.localeCompare(b.played_at));

  // Quick day tally: who won the most this session.
  const tally = new Map<string, { w: number; l: number }>();
  for (const g of dayGames) {
    const aWon = g.score_a > g.score_b;
    const winners = aWon ? [g.team_a1, g.team_a2] : [g.team_b1, g.team_b2];
    const losers = aWon ? [g.team_b1, g.team_b2] : [g.team_a1, g.team_a2];
    for (const p of winners) tally.set(p, { w: (tally.get(p)?.w ?? 0) + 1, l: tally.get(p)?.l ?? 0 });
    for (const p of losers) tally.set(p, { w: tally.get(p)?.w ?? 0, l: (tally.get(p)?.l ?? 0) + 1 });
  }
  const leaders = [...tally.entries()].sort((a, b) => b[1].w - a[1].w);
  const topWins = leaders[0]?.[1].w ?? 0;

  return (
    <>
      <PageHeader
        title={formatDateLong(date)}
        subtitle={`${dayGames.length} game${dayGames.length === 1 ? "" : "s"}`}
        action={
          <Link href="/new" className={btnPrimary}>
            Add
          </Link>
        }
      />

      {dayGames.length === 0 ? (
        <EmptyState
          title="No games on this day"
          hint="They may all have been deleted, or this date has nothing logged yet."
          action={
            <Link href="/new" className={btnPrimary}>
              Log a game
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {topWins > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {leaders
                .filter(([, r]) => r.w === topWins)
                .map(([id, r]) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-court-soft px-2.5 py-1 text-sm">
                    <span aria-hidden>👑</span>
                    <span className="font-medium">{playersById.get(id)?.name}</span>
                    <span className="tnum text-muted">
                      {r.w}–{r.l}
                    </span>
                  </span>
                ))}
            </div>
          ) : null}

          <ul className="space-y-2">
            {dayGames.map((g) => (
              <GameRow key={g.id} game={g} playersById={playersById} editable />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
