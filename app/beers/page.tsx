import { getAllData } from "@/lib/data";
import { computeBeers } from "@/lib/stats/beers";
import { toMini } from "@/lib/players";
import { PageHeader, EmptyState, Card } from "@/components/ui";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { MarkPaidButton } from "@/components/MarkPaidButton";
import { BeerRateEditor } from "@/components/BeerRateEditor";
import { NoShowForm } from "@/components/NoShowForm";
import { RecentNoShows } from "@/components/RecentNoShows";

export const dynamic = "force-dynamic";

export default async function BeersPage() {
  const { players, absences, beerClears, beersPerNoShow } = await getAllData();
  const beers = computeBeers(players, absences, beerClears, beersPerNoShow);
  const playersById = new Map(players.map((p) => [p.id, p]));

  // Only show players who have ever no-showed (earned > 0) or currently owe.
  const board = beers.board.filter((s) => s.earned > 0 || s.owed > 0);
  const isEmpty = board.length === 0;

  const activePlayers = players.filter((p) => p.is_active).map(toMini);
  const allMini = players.map(toMini);
  const recentNoShows = [...absences]
    .sort((a, b) => b.noshow_on.localeCompare(a.noshow_on))
    .map((a) => ({ id: a.id, player_id: a.player_id, noshow_on: a.noshow_on, note: a.note }));

  return (
    <>
      <PageHeader title="Beer Board" subtitle="Miss a session, owe a round 🍺" />

      <div className="mb-6">
        <NoShowForm players={activePlayers} />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Everyone's been showing up 🎉"
          hint={`No-shows get ${beersPerNoShow} beers. Log one with the form above.`}
        />
      ) : (
        <div className="space-y-3">
          <ol className="space-y-1.5">
            {board.map((standing, i) => {
              const player = playersById.get(standing.playerId);
              if (!player) return null;
              const isSleepyhead = standing.playerId === beers.sleepyheadId;
              return (
                <li
                  key={standing.playerId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <span className={`tnum w-5 text-base font-bold ${i === 0 ? "text-gold" : "text-ink"}`}>{i + 1}</span>
                  <span className="relative shrink-0">
                    <PlayerAvatar player={player} size={36} ring={isSleepyhead} />
                    {isSleepyhead ? (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm leading-none" aria-label="Sleepyhead">
                        🛌
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{player.name}</div>
                    <div className="tnum text-xs text-muted">
                      🍺 ×{standing.earned} all-time
                      {standing.cleared > 0 ? <> &middot; {standing.cleared} paid</> : null}
                    </div>
                  </div>
                  <span className="tnum text-lg font-bold text-shuttle">🍺 × {standing.owed}</span>
                  {standing.owed > 0 ? <MarkPaidButton playerId={standing.playerId} owed={standing.owed} /> : null}
                </li>
              );
            })}
          </ol>

          <p className="px-1 text-xs leading-relaxed text-muted">
            <span className="tnum">{beers.ratePerNoShow}</span> beers per no-show. 🛌 Sleepyhead = most owed.
          </p>
        </div>
      )}

      <div className="mt-6">
        <RecentNoShows allPlayers={allMini} recent={recentNoShows} />
      </div>

      <Card className="mt-4 p-3">
        <BeerRateEditor rate={beers.ratePerNoShow} />
      </Card>
    </>
  );
}
