import Link from "next/link";
import { getAllData } from "@/lib/data";
import { computeAll } from "@/lib/stats/computeAll";
import { addDays, computeInsights, rankPairs, resolveWindow, toISO, type WindowKind } from "@/lib/stats/computeInsights";
import { PageHeader, SectionLabel, Card, EmptyState } from "@/components/ui";
import { PairRanking } from "@/components/PairRanking";
import { MultiLineChart, type Series } from "@/components/charts/MultiLineChart";
import { GamesBar } from "@/components/charts/GamesBar";
import { WinsBar } from "@/components/charts/WinsBar";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { colorForPlayer } from "@/lib/players";
import { formatDate, formatPct, formatRecord, formatSigned, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

const WINDOW_KINDS: WindowKind[] = ["day", "week", "month", "all"];
const WINDOW_LABELS: Record<WindowKind, string> = { day: "Day", week: "Week", month: "Month", all: "All" };

function isWindowKind(value: string | undefined): value is WindowKind {
  return value === "day" || value === "week" || value === "month" || value === "all";
}

/** Month stepping for nav (day/week stepping reuses addDays from the engine). */
function addMonths(iso: string, months: number): string {
  // Step from the 1st of the month so 29/30/31-day months don't overflow the day
  // (e.g. Jan 31 + 1mo must land in Feb, not spill into March).
  const [y, m] = iso.split("-").map(Number);
  return toISO(new Date(Date.UTC(y, m - 1 + months, 1)));
}

function stepAnchor(kind: WindowKind, anchor: string, dir: -1 | 1): string {
  if (kind === "day") return addDays(anchor, dir);
  if (kind === "week") return addDays(anchor, dir * 7);
  return addMonths(anchor, dir); // month
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; anchor?: string }>;
}) {
  const { window: windowParam, anchor: anchorParam } = await searchParams;
  const { players, games, sessions, absences, beersPerNoShow } = await getAllData();
  const out = computeAll(players, games, sessions);

  const playersById = new Map(players.map((p) => [p.id, p]));

  // Sorted unique calendar days that actually have games (soft-deletes already gone).
  const datesWithGames = [...new Set(out.orderedGames.map((g) => g.played_on))].sort();
  const latest = datesWithGames.length > 0 ? datesWithGames[datesWithGames.length - 1] : todayISO();
  const earliest = datesWithGames.length > 0 ? datesWithGames[0] : latest;

  const kind: WindowKind = isWindowKind(windowParam) ? windowParam : "week";
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : latest;
  const window = resolveWindow(kind, anchor, datesWithGames);
  const ins = computeInsights(out, players, absences, beersPerNoShow, window);

  const activePlayers = players.filter((p) => p.is_active);

  // ---- rating-trend chart: pivot to wide rows keyed by day label ----
  const trendSeries: Series[] = activePlayers.map((p) => ({
    key: p.name,
    name: p.name,
    color: colorForPlayer(p),
  }));

  // Collect (playedOn -> {playerName: rating}) within the window.
  const trendByDate = new Map<string, Record<string, number>>();
  for (const p of activePlayers) {
    const history =
      kind === "day"
        ? (out.ratingHistory[p.id] ?? []).map((pt) => ({ playedOn: pt.playedOn, rating: pt.rating }))
        : (out.sessionRatingHistory[p.id] ?? []).map((pt) => ({ playedOn: pt.playedOn, rating: pt.rating }));
    for (const pt of history) {
      if (pt.playedOn < window.startISO || pt.playedOn > window.endISO) continue;
      let row = trendByDate.get(pt.playedOn);
      if (!row) {
        row = {};
        trendByDate.set(pt.playedOn, row);
      }
      // For per-game (day) history, keep the last rating of the day per player.
      row[p.name] = pt.rating;
    }
  }
  const trendData: Array<Record<string, string | number>> = [...trendByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([playedOn, ratings]) => ({ label: formatDate(playedOn), ...ratings }));

  // ---- games-per-day bar over the window ----
  const gamesByDay = new Map<string, number>();
  for (const g of out.orderedGames) {
    if (g.played_on < window.startISO || g.played_on > window.endISO) continue;
    gamesByDay.set(g.played_on, (gamesByDay.get(g.played_on) ?? 0) + 1);
  }
  const gamesData = [...gamesByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([playedOn, count]) => ({ label: formatDate(playedOn), games: count }));

  // ---- players who played in the window (reused by the bar + table) ----
  const active = ins.perPlayer.filter((s) => s.gamesPlayed > 0);
  const winsData = active.map((s) => {
    const p = playersById.get(s.playerId);
    return { name: p?.name ?? s.playerId, wins: s.wins, color: p ? colorForPlayer(p) : "#0B6E4F" };
  });

  // ---- pairs (all-time view only) ----
  const pairs = kind === "all" ? rankPairs(out.chemistry, players.map((p) => p.id)) : [];

  // ---- nav availability (best-effort: hide steps past the data edges) ----
  const showNav = kind !== "all";
  const prevAnchor = stepAnchor(kind === "all" ? "day" : kind, anchor, -1);
  const nextAnchor = stepAnchor(kind === "all" ? "day" : kind, anchor, 1);
  // A previous step is useful only if some game day exists at/before its window end.
  const prevWindow = showNav ? resolveWindow(kind, prevAnchor, datesWithGames) : null;
  const nextWindow = showNav ? resolveWindow(kind, nextAnchor, datesWithGames) : null;
  const canPrev = !!prevWindow && earliest <= prevWindow.endISO;
  const canNext = !!nextWindow && nextWindow.startISO <= latest && anchor < latest;
  const atLatest = anchor >= latest;

  const segHref = (k: WindowKind) =>
    k === "all" ? "/insights?window=all" : `/insights?window=${k}&anchor=${anchor}`;

  return (
    <>
      <PageHeader title="Insights" subtitle={window.label} />

      {/* segmented control */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 rounded-full border border-line bg-surface p-0.5">
          {WINDOW_KINDS.map((k) => {
            const active = k === kind;
            return (
              <Link
                key={k}
                href={segHref(k)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-medium transition ${
                  active ? "bg-court text-white shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {WINDOW_LABELS[k]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* prev / latest / next */}
      {showNav ? (
        <div className="mb-5 flex items-center justify-between text-sm">
          {canPrev ? (
            <Link
              href={`/insights?window=${kind}&anchor=${prevAnchor}`}
              className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-ink transition hover:bg-court-soft"
            >
              ◀ Prev
            </Link>
          ) : (
            <span className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-muted/40">◀ Prev</span>
          )}

          {atLatest ? (
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Latest</span>
          ) : (
            <Link
              href={`/insights?window=${kind}&anchor=${latest}`}
              className="text-xs font-medium uppercase tracking-wide text-court hover:underline"
            >
              Jump to latest
            </Link>
          )}

          {canNext ? (
            <Link
              href={`/insights?window=${kind}&anchor=${nextAnchor}`}
              className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-ink transition hover:bg-court-soft"
            >
              Next ▶
            </Link>
          ) : (
            <span className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-muted/40">Next ▶</span>
          )}
        </div>
      ) : null}

      {ins.gamesPlayed === 0 && ins.noShows.count === 0 ? (
        <EmptyState
          title="Nothing here yet"
          hint="No games or no-shows fall in this window. Try a wider range or jump to the latest."
        />
      ) : (
        <div className="space-y-8">
          {/* ---- highlights ---- */}
          {ins.highlights.length > 0 ? (
            <section>
              <SectionLabel>Highlights</SectionLabel>
              <ul className="flex flex-wrap gap-2">
                {ins.highlights.map((h, i) => {
                  const player = h.playerId ? playersById.get(h.playerId) : null;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
                    >
                      {player ? <PlayerAvatar player={player} size={22} /> : null}
                      <span aria-hidden>{h.emoji}</span>
                      <span className="text-ink">{h.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* ---- rating trend (a time-series needs >1 day; skip on the single-day view) ---- */}
          {kind !== "day" ? (
            <section>
              <SectionLabel>Rating trend</SectionLabel>
              <Card className="p-3">
                <MultiLineChart data={trendData} series={trendSeries} />
              </Card>
            </section>
          ) : null}

          {/* ---- games per day ---- */}
          <section>
            <SectionLabel>Games per day</SectionLabel>
            <Card className="p-3">
              <GamesBar data={gamesData} />
            </Card>
          </section>

          {/* ---- wins per player ---- */}
          <section>
            <SectionLabel>Wins this {kind === "all" ? "period" : kind}</SectionLabel>
            <Card className="p-3">
              <WinsBar data={winsData} />
            </Card>
          </section>

          {/* ---- per-player table ---- */}
          <section>
            <SectionLabel>By player</SectionLabel>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-2 py-2 text-right font-semibold">W–L</th>
                    <th className="px-2 py-2 text-right font-semibold">Win%</th>
                    <th className="px-3 py-2 text-right font-semibold">Δ Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((s) => {
                      const player = playersById.get(s.playerId);
                      const delta = Math.round(s.ratingDelta);
                      const tone = delta > 0 ? "text-win" : delta < 0 ? "text-loss" : "text-muted";
                      return (
                        <tr key={s.playerId} className="border-b border-line last:border-0">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              {player ? <PlayerAvatar player={player} size={26} /> : null}
                              <span className="truncate font-medium">{player?.name ?? s.playerId}</span>
                            </span>
                          </td>
                          <td className="tnum px-2 py-2 text-right">{formatRecord(s.wins, s.losses)}</td>
                          <td className="tnum px-2 py-2 text-right text-muted">{formatPct(s.winPct)}</td>
                          <td className={`tnum px-3 py-2 text-right font-semibold ${tone}`}>{formatSigned(delta)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          </section>

          {/* ---- best pairs (all-time only) ---- */}
          {kind === "all" ? (
            <section>
              <SectionLabel>Best pairs</SectionLabel>
              <PairRanking pairs={pairs} playersById={playersById} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
