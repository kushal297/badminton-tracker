"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SectionLabel } from "@/components/ui";
import { removeNoShow } from "@/app/actions/beers";
import { formatDate } from "@/lib/format";
import type { MiniPlayer } from "@/lib/players";

type RecentNoShow = { id: string; player_id: string; noshow_on: string; note: string | null };

/** The recent-no-shows ledger with remove. Rendered below the beer totals. */
export function RecentNoShows({ allPlayers, recent }: { allPlayers: MiniPlayer[]; recent: RecentNoShow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const playersById = new Map(allPlayers.map((p) => [p.id, p]));

  if (recent.length === 0) return null;

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeNoShow(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <SectionLabel>Recent no-shows</SectionLabel>
      {error ? <p className="mb-2 rounded-lg bg-shuttle-soft px-3 py-2 text-sm text-loss">{error}</p> : null}
      <ul className="space-y-1.5">
        {recent.map((r) => {
          const player = playersById.get(r.player_id);
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
              {player ? <PlayerAvatar player={player} size={32} /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{player?.name ?? "Unknown"}</div>
                <div className="tnum truncate text-xs text-muted">
                  {formatDate(r.noshow_on)}
                  {r.note ? <> &middot; {r.note}</> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={pending}
                aria-label="Remove no-show"
                className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-sm text-muted transition hover:text-loss disabled:opacity-60"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
