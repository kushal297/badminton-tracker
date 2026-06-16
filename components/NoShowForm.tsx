"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "@/components/ui";
import { addNoShow } from "@/app/actions/beers";
import { todayISO } from "@/lib/format";
import type { MiniPlayer } from "@/lib/players";

/** The "log a no-show" form. The recent-no-shows list lives separately
 *  (RecentNoShows), so it can render below the beer totals. */
export function NoShowForm({ players }: { players: MiniPlayer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [playerId, setPlayerId] = useState<string>(players[0]?.id ?? "");
  const [date, setDate] = useState<string>(todayISO());
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!playerId) {
      setError("Pick a player.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Choose a date.");
      return;
    }
    startTransition(async () => {
      const res = await addNoShow(playerId, date, note.trim() || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Player
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={pending || players.length === 0}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-court"
          >
            {players.length === 0 ? <option value="">No players yet</option> : null}
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Date
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
            className="tnum rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-court"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Reason <span className="font-normal lowercase">(optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Bailed last minute…"
          maxLength={120}
          disabled={pending}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-court"
        />
      </label>

      <button type="submit" disabled={pending || !playerId} className={`${btnPrimary} w-full`}>
        {pending ? "Saving…" : "Log no-show"}
      </button>

      {error ? <p className="rounded-lg bg-shuttle-soft px-3 py-2 text-sm text-loss">{error}</p> : null}
    </form>
  );
}
