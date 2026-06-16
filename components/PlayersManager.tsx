"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PhotoUploader } from "@/components/PhotoUploader";
import { btnPrimary } from "@/components/ui";
import { addPlayer, renamePlayer, setPlayerActive } from "@/app/actions/players";

type Row = {
  id: string;
  name: string;
  color: string | null;
  photo_url: string | null;
  is_active: boolean;
  gamesPlayed: number;
};

export function PlayersManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else {
        setError(null);
        onOk();
        router.refresh();
      }
    });

  const active = initial.filter((p) => p.is_active);
  const retired = initial.filter((p) => !p.is_active);

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) run(() => addPlayer(newName), () => setNewName(""));
        }}
        className="flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a player…"
          maxLength={30}
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 outline-none focus:border-court"
        />
        <button type="submit" disabled={pending || !newName.trim()} className={btnPrimary}>
          Add
        </button>
      </form>

      {error ? <p className="rounded-lg bg-shuttle-soft px-3 py-2 text-sm text-loss">{error}</p> : null}

      <ul className="space-y-2">
        {active.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
            <PhotoUploader player={p} />
            {editingId === p.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") run(() => renamePlayer(p.id, editName), () => setEditingId(null));
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 rounded-lg border border-line px-2 py-1 outline-none focus:border-court"
              />
            ) : (
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="tnum text-xs text-muted">{p.gamesPlayed} games</div>
              </div>
            )}

            {editingId === p.id ? (
              <button
                type="button"
                onClick={() => run(() => renamePlayer(p.id, editName), () => setEditingId(null))}
                className="text-sm font-medium text-court"
              >
                Save
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  setEditName(p.name);
                }}
                className="text-sm font-medium text-muted hover:text-ink"
              >
                Rename
              </button>
            )}
            <button
              type="button"
              onClick={() => run(() => setPlayerActive(p.id, false), () => {})}
              aria-label={`Retire ${p.name}`}
              className="text-sm text-muted hover:text-loss"
            >
              Retire
            </button>
          </li>
        ))}
      </ul>

      {retired.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Retired</h2>
          <ul className="space-y-2">
            {retired.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5">
                <PlayerAvatar player={p} size={32} dim />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-muted">{p.name}</div>
                  <div className="tnum text-xs text-muted">{p.gamesPlayed} games · keeps their history</div>
                </div>
                <button
                  type="button"
                  onClick={() => run(() => setPlayerActive(p.id, true), () => {})}
                  className="text-sm font-medium text-court"
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
