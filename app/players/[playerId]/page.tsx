import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllData } from "@/lib/data";
import { computeAll } from "@/lib/stats/computeAll";
import { computeBeers } from "@/lib/stats/beers";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { RatingChart } from "@/components/charts/RatingChart";
import { StatTile, SectionLabel } from "@/components/ui";
import { colorForPlayer } from "@/lib/players";
import { BADGE_CATALOG } from "@/lib/stats/badges";
import { formatDate, formatPct, formatRating, formatRecord, formatSigned, formatStreak } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayerProfile({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const { players, games, sessions, absences, beerClears, beersPerNoShow } = await getAllData();
  const player = players.find((p) => p.id === playerId);
  if (!player) notFound();

  const out = computeAll(players, games, sessions);
  const beers = computeBeers(players, absences, beerClears, beersPerNoShow);
  const playersById = new Map(players.map((p) => [p.id, p]));
  const stats = out.perPlayer[playerId];
  const row = out.leaderboard.find((r) => r.playerId === playerId);
  const color = colorForPlayer(player);
  const played = stats.gamesPlayed > 0;

  const chartData = out.sessionRatingHistory[playerId].map((pt) => ({
    label: formatDate(pt.playedOn),
    rating: pt.rating,
  }));

  // Recent form: last results in game order.
  const form: boolean[] = [];
  for (const g of out.orderedGames) {
    const inA = g.team_a1 === playerId || g.team_a2 === playerId;
    const inB = g.team_b1 === playerId || g.team_b2 === playerId;
    if (!inA && !inB) continue;
    form.push((inA && g.score_a > g.score_b) || (inB && g.score_b > g.score_a));
  }
  const recent = form.slice(-8);

  const best = out.bestPartner[playerId];
  const worst = out.worstPartner[playerId];
  // Only show a separate "toughest" card when there are at least two eligible partners.
  const showWorst = Boolean(best && worst && worst.partnerId !== best.partnerId);
  const badgeCodes = new Set(BADGE_CATALOG.map((b) => b.code));
  const badges = (out.badgesByPlayer[playerId] ?? []).filter((b) => badgeCodes.has(b.code));
  // Sleepyhead comes from the beer board (not the game-derived badges), so add it here.
  if (beers.sleepyheadId === playerId) {
    const cat = BADGE_CATALOG.find((b) => b.code === "sleepyhead");
    if (cat) badges.push({ code: cat.code, label: cat.label, emoji: cat.emoji, playerId, detail: cat.description });
  }

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm font-medium text-court">
        ← Stats
      </Link>

      {/* Scoreboard header */}
      <section className="overflow-hidden rounded-3xl bg-court-deep text-white">
        <div className="flex items-center gap-4 p-5">
          <PlayerAvatar player={player} size={64} ring={row?.rank === 1} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold">{player.name}</h1>
            <p className="tnum text-sm text-white/65">
              {played ? (
                <>
                  Rank #{row?.rank} &middot; {formatRecord(stats.wins, stats.losses)} &middot; {formatStreak(stats.currentStreak)}
                </>
              ) : (
                "Hasn't played yet"
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-gold">{formatRating(stats.rating)}</div>
            <div className="text-[0.7rem] uppercase tracking-wide text-white/55">rating</div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Games" value={<span className="tnum">{stats.gamesPlayed}</span>} />
        <StatTile label="Win rate" value={formatPct(stats.winPct)} tone="court" />
        <StatTile
          label="Pt diff / game"
          value={stats.avgPointDiff === null ? "—" : formatSigned(Math.round(stats.avgPointDiff))}
          tone={stats.avgPointDiff && stats.avgPointDiff < 0 ? "loss" : "win"}
        />
        <StatTile label="Wins" value={<span className="tnum">{stats.wins}</span>} tone="win" />
        <StatTile label="Losses" value={<span className="tnum">{stats.losses}</span>} tone="loss" />
        <StatTile label="Longest streak" value={stats.longestWinStreak > 0 ? `W${stats.longestWinStreak}` : "—"} />
      </div>

      {/* Recent form */}
      {recent.length > 0 ? (
        <div>
          <SectionLabel>Recent form</SectionLabel>
          <div className="flex gap-1.5">
            {recent.map((won, i) => (
              <span
                key={i}
                title={won ? "Win" : "Loss"}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${
                  won ? "bg-win" : "bg-loss"
                }`}
              >
                {won ? "W" : "L"}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Rating trend */}
      <div>
        <SectionLabel>Rating over time</SectionLabel>
        <RatingChart data={chartData} color={color} />
      </div>

      {/* Partners */}
      <div>
        <SectionLabel>Partnerships</SectionLabel>
        <div className={`grid gap-2 ${showWorst ? "grid-cols-2" : "grid-cols-1"}`}>
          <PartnerCard title="Best partner" partner={best} playersById={playersById} tone="win" />
          {showWorst ? (
            <PartnerCard title="Toughest pairing" partner={worst} playersById={playersById} tone="loss" />
          ) : null}
        </div>
        <Link href="/stats" className="mt-2 inline-block text-sm font-medium text-court">
          All chemistry →
        </Link>
      </div>

      {/* Badges */}
      <div>
        <SectionLabel>Badges</SectionLabel>
        {badges.length === 0 ? (
          <p className="text-sm text-muted">No badges yet — keep playing.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <span
                key={`${b.code}-${i}`}
                title={b.detail}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm"
              >
                <span aria-hidden>{b.emoji}</span>
                <span className="font-medium">{b.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PartnerCard({
  title,
  partner,
  playersById,
  tone,
}: {
  title: string;
  partner: { partnerId: string; wins: number; losses: number; winRate: number } | null;
  playersById: Map<string, { id: string; name: string; color: string | null; photo_url: string | null }>;
  tone: "win" | "loss";
}) {
  const p = partner ? playersById.get(partner.partnerId) : null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-[0.68rem] font-medium uppercase tracking-wide text-muted">{title}</div>
      {partner && p ? (
        <div className="mt-2 flex items-center gap-2">
          <PlayerAvatar player={p} size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{p.name}</div>
            <div className={`tnum text-xs ${tone === "win" ? "text-win" : "text-loss"}`}>
              {formatRecord(partner.wins, partner.losses)} · {formatPct(partner.winRate)}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Need 3+ games with a partner.</p>
      )}
    </div>
  );
}
