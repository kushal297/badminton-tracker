import Link from "next/link";
import { getAllData } from "@/lib/data";
import { computeAll } from "@/lib/stats/computeAll";
import { computeBeers } from "@/lib/stats/beers";
import { rankPairs } from "@/lib/stats/computeInsights";
import { STATS_CONFIG } from "@/lib/stats/config";
import { BADGE_CATALOG } from "@/lib/stats/badges";
import { Matrix, type MatrixCell } from "@/components/Matrix";
import { PairRanking } from "@/components/PairRanking";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PageHeader, SectionLabel, Card, EmptyState, btnGhost } from "@/components/ui";
import { formatPct, formatRating, formatRecord, formatStreak } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { players, games, sessions, absences, beerClears, beersPerNoShow } = await getAllData();
  const out = computeAll(players, games, sessions);
  const beers = computeBeers(players, absences, beerClears, beersPerNoShow);
  const playersById = new Map(players.map((p) => [p.id, p]));
  const hasGames = out.orderedGames.length > 0;
  const pairs = rankPairs(out.chemistry, players.map((p) => p.id));

  // Order players by the leaderboard so every grid reads top-to-bottom by skill.
  const order = out.leaderboard
    .map((r) => playersById.get(r.playerId))
    .filter(Boolean)
    .map((p) => ({ id: p!.id, name: p!.name, color: p!.color, photo_url: p!.photo_url }));

  const chemistryCell = (rowId: string, colId: string): MatrixCell | null => {
    const c = out.chemistry[rowId]?.[colId];
    if (!c || c.games === 0 || c.winRate === null) return null;
    const tone = c.winRate > 0.5 ? "win" : c.winRate < 0.5 ? "loss" : "muted";
    return { text: formatRecord(c.wins, c.losses), tone, faded: c.games < STATS_CONFIG.MIN_PAIR_GAMES };
  };

  const h2hCell = (rowId: string, colId: string): MatrixCell | null => {
    const h = out.headToHead[rowId]?.[colId];
    if (!h || h.games === 0) return null;
    const tone = h.wins > h.losses ? "win" : h.wins < h.losses ? "loss" : "muted";
    return { text: formatRecord(h.wins, h.losses), tone, faded: h.games < STATS_CONFIG.H2H_MIN_GAMES };
  };

  return (
    <>
      <PageHeader
        title="Stats"
        action={
          <Link href="/players" className={btnGhost}>
            Manage
          </Link>
        }
      />

      <div className="space-y-8">
        {/* ---- Player Ranking ---- */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Player Ranking</h2>
            <span className="rounded-full bg-court-soft px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-muted">
              from doubles
            </span>
          </div>
          {!hasGames ? (
            <EmptyState
              title="No rating yet"
              hint="Everyone starts at 1000. Log a few games and the rankings take shape."
            />
          ) : (
            <ol className="space-y-1.5">
              {out.leaderboard.map((row) => {
                const player = playersById.get(row.playerId);
                if (!player) return null;
                const played = row.gamesPlayed > 0;
                return (
                  <li key={row.playerId}>
                    <Link
                      href={`/players/${row.playerId}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:bg-court-soft"
                    >
                      <span className={`tnum w-6 text-base font-bold ${row.rank === 1 ? "text-gold" : "text-ink"}`}>
                        {row.rank}
                      </span>
                      <PlayerAvatar player={player} size={36} ring={row.rank === 1} dim={!played} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{player.name}</span>
                          {row.isProvisional && played ? (
                            <span className="rounded bg-court-soft px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-court">
                              new
                            </span>
                          ) : null}
                        </div>
                        <div className="tnum text-xs text-muted">
                          {played ? (
                            <>
                              {formatRecord(row.wins, row.losses)} &middot; {formatPct(row.winPct)} &middot;{" "}
                              {formatStreak(row.currentStreak)}
                            </>
                          ) : (
                            "Hasn't played yet"
                          )}
                        </div>
                      </div>
                      <span className="tnum text-xl font-bold">{formatRating(row.rating)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ---- Team Ranking (best duos) ---- */}
        {hasGames ? (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Team Ranking</h2>
              <span className="rounded-full bg-court-soft px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-court">
                best duos
              </span>
            </div>
            <PairRanking
              pairs={pairs}
              playersById={playersById}
              emptyTitle="No ranked pairs yet"
              emptyHint={`Play at least ${STATS_CONFIG.MIN_PAIR_GAMES} games with the same partner and your best duos appear here.`}
            />
          </section>
        ) : null}

        {/* ---- Pairings & rivals ---- */}
        {hasGames ? (
          <section>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <SectionLabel className="mb-0">Pairings &amp; rivals</SectionLabel>
                <span className="text-xs text-muted transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>

              <div className="mt-3 space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">Chemistry — your record as teammates</p>
                  <Card className="p-3">
                    <Matrix players={order} cell={chemistryCell} />
                  </Card>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted">Head-to-head — your record on opposite teams</p>
                  <Card className="p-3">
                    <Matrix players={order} cell={h2hCell} />
                  </Card>
                </div>

                <p className="px-1 text-xs leading-relaxed text-muted">
                  Read across a row: each cell is that player&apos;s <span className="text-court">wins</span>–
                  <span className="text-loss">losses</span> with (chemistry) or against (head-to-head) the player in that
                  column. Faded cells have too few games to be meaningful yet.
                </p>
              </div>
            </details>
          </section>
        ) : null}

        {/* ---- Badges ---- */}
        <section>
          <SectionLabel>Badges</SectionLabel>
          <ul className="space-y-1.5">
            {BADGE_CATALOG.map((badge) => {
              const holderIds =
                badge.code === "sleepyhead"
                  ? beers.sleepyheadId
                    ? [beers.sleepyheadId]
                    : []
                  : Array.from(
                      new Set(out.badges.filter((b) => b.code === badge.code).map((b) => b.playerId)),
                    );
              const holders = holderIds.map((id) => playersById.get(id)).filter(Boolean) as typeof players;

              return (
                <li
                  key={badge.code}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper text-lg">
                    {badge.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{badge.label}</div>
                    <div className="truncate text-xs text-muted">{badge.description}</div>
                  </div>
                  {holders.length > 0 ? (
                    <span className="flex shrink-0 -space-x-1.5">
                      {holders.map((p) => (
                        <PlayerAvatar key={p.id} player={p} size={28} />
                      ))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm text-muted/50">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
