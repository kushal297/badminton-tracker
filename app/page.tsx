import Link from "next/link";
import { getAllData } from "@/lib/data";
import { computeAll } from "@/lib/stats/computeAll";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState, btnPrimary } from "@/components/ui";
import { formatDateLong, formatRating, formatStreak } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { players, games, sessions } = await getAllData();
  const out = computeAll(players, games, sessions);
  const playersById = new Map(players.map((p) => [p.id, p]));

  const feedGames = games.filter((g) => !g.deleted_at);
  const hasGames = feedGames.length > 0;

  const leader = out.leaderboard[0];
  const champion = leader ? playersById.get(leader.playerId) ?? null : null;

  // Group games by day, newest day first; games within a day by session_seq desc.
  const byDay = new Map<string, typeof feedGames>();
  for (const g of feedGames) {
    const bucket = byDay.get(g.played_on);
    if (bucket) bucket.push(g);
    else byDay.set(g.played_on, [g]);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayGames]) => ({
      date,
      games: [...dayGames].sort(
        (a, b) => b.session_seq - a.session_seq || b.played_at.localeCompare(a.played_at),
      ),
    }));

  return (
    <div className="space-y-5">
      {/* Slim champion strip */}
      {hasGames && champion && leader ? (
        <div className="flex items-center gap-2 overflow-hidden rounded-full bg-court-deep px-4 py-2 text-sm text-white">
          <span aria-hidden>👑</span>
          <span className="truncate font-display font-semibold">{champion.name}</span>
          <span className="text-white/45">·</span>
          <span className="tnum text-gold">{formatRating(leader.rating)}</span>
          <span className="text-white/55">rating</span>
          <span className="text-white/45">·</span>
          <span className="tnum text-white/75">{formatStreak(leader.currentStreak)}</span>
        </div>
      ) : null}

      {/* Primary action */}
      <Link href="/new" className={`${btnPrimary} w-full`}>
        <span aria-hidden>＋</span> Log a game
      </Link>

      {/* Match feed */}
      {hasGames ? (
        <div className="space-y-6">
          {days.map(({ date, games: dayGames }) => (
            <section key={date} className="space-y-2.5">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                <span>{formatDateLong(date)}</span>
                <span className="tnum font-medium normal-case tracking-normal text-muted/80">
                  · {dayGames.length} game{dayGames.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="space-y-2">
                {dayGames.map((g) => (
                  <MatchCard
                    key={g.id}
                    game={g}
                    playersById={playersById}
                    mover={out.gameMovers[g.id] ?? null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No games yet"
          hint="Log your first 2v2 game and the ratings, rivalries and badges begin."
          action={
            <Link href="/new" className={btnPrimary}>
              <span aria-hidden>＋</span> Log a game
            </Link>
          }
        />
      )}
    </div>
  );
}
