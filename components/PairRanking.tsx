import { PlayerAvatar } from "@/components/PlayerAvatar";
import { EmptyState } from "@/components/ui";
import { formatPct, formatRecord } from "@/lib/format";
import type { Pairing } from "@/lib/stats/types";
import type { Player } from "@/lib/types";

/** Shared ranked-duo list, used by the Stats "Team Ranking" and Insights "Best pairs". */
export function PairRanking({
  pairs,
  playersById,
  emptyTitle = "No standout pairs yet",
  emptyHint = "Play more games together and the strongest partnerships rise to the top.",
}: {
  pairs: Pairing[];
  playersById: Map<string, Player>;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (pairs.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <ol className="space-y-1.5">
      {pairs.map((pair, i) => {
        const a = playersById.get(pair.playerIds[0]);
        const b = playersById.get(pair.playerIds[1]);
        if (!a || !b) return null;
        return (
          <li
            key={`${pair.playerIds[0]}-${pair.playerIds[1]}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            <span className={`tnum w-5 text-base font-bold ${i === 0 ? "text-gold" : "text-ink"}`}>{i + 1}</span>
            <span className="flex shrink-0 -space-x-1.5">
              <PlayerAvatar player={a} size={30} />
              <PlayerAvatar player={b} size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {a.name} &amp; {b.name}
              </div>
              <div className="tnum text-xs text-muted">{formatRecord(pair.wins, pair.losses)}</div>
            </div>
            <span className="tnum text-base font-bold text-court">{formatPct(pair.winRate)}</span>
          </li>
        );
      })}
    </ol>
  );
}
