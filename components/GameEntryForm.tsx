"use client";

import { useMemo, useState, useTransition } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { btnPrimary } from "@/components/ui";
import { saveGame, updateGame, type ActionResult } from "@/app/actions/games";
import type { GameInput } from "@/lib/schemas";

type MiniPlayer = { id: string; name: string; color: string | null; photo_url: string | null };

export type EntryInitial = {
  slots: (string | null)[]; // [A1, A2, B1, B2]
  scoreA: number;
  scoreB: number;
  playedOn: string;
  gameTarget: number;
};

const SLOT_TEAM = ["A", "A", "B", "B"] as const;

export function GameEntryForm({
  players,
  defaultDate,
  mode = "create",
  gameId,
  initial,
}: {
  players: MiniPlayer[];
  defaultDate: string;
  mode?: "create" | "edit";
  gameId?: string;
  initial?: EntryInitial;
}) {
  const [slots, setSlots] = useState<(string | null)[]>(initial?.slots ?? [null, null, null, null]);
  const [scoreA, setScoreA] = useState(initial?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(initial?.scoreB ?? 0);
  const [playedOn, setPlayedOn] = useState(initial?.playedOn ?? defaultDate);
  const [target, setTarget] = useState(initial?.gameTarget ?? 21);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const assigned = slots.filter((s): s is string => Boolean(s));
  const resting = players.filter((p) => !assigned.includes(p.id));
  const ready = assigned.length === 4 && scoreA !== scoreB;

  function toggle(id: string) {
    setError(null);
    const idx = slots.indexOf(id);
    if (idx >= 0) {
      const next = [...slots];
      next[idx] = null;
      setSlots(next);
      return;
    }
    const empty = slots.indexOf(null);
    if (empty === -1) return; // all four slots filled
    const next = [...slots];
    next[empty] = id;
    setSlots(next);
  }

  function submit() {
    if (!ready || pending) return;
    setError(null);
    const input: GameInput = {
      playedOn,
      teamA: [slots[0]!, slots[1]!],
      teamB: [slots[2]!, slots[3]!],
      satOut: resting.length === 1 ? resting[0].id : null,
      scoreA,
      scoreB,
      gameTarget: target,
    };
    if (mode === "edit" && gameId) {
      const pin = window.prompt("Enter the admin PIN to save these changes");
      if (pin === null) return; // cancelled = silent no-op
      startTransition(async () => {
        const res: ActionResult | void = await updateGame(gameId, input, pin);
        if (res && !res.ok) setError(res.error);
      });
    } else {
      startTransition(async () => {
        const res: ActionResult | void = await saveGame(input);
        if (res && !res.ok) setError(res.error);
      });
    }
  }

  const winnerText = !ready
    ? assigned.length < 4
      ? "Pick four players"
      : "Scores can't be level"
    : `${scoreA > scoreB ? "Team A" : "Team B"} win ${Math.max(scoreA, scoreB)}–${Math.min(scoreA, scoreB)}`;

  return (
    <div className="space-y-5">
      {/* When + format */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Date</span>
          <input
            type="date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            className="tnum rounded-lg border border-line bg-surface px-2.5 py-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Up to</span>
          <select
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="tnum rounded-lg border border-line bg-surface px-2.5 py-1.5"
          >
            <option value={21}>21</option>
            <option value={15}>15</option>
            <option value={11}>11</option>
          </select>
        </label>
      </div>

      {/* Team panels */}
      <div className="space-y-3">
        <TeamPanel
          label="Team A"
          accent="var(--color-court)"
          players={[slots[0], slots[1]].map((id) => (id ? byId.get(id) ?? null : null))}
          score={scoreA}
          setScore={setScoreA}
          winning={ready && scoreA > scoreB}
          onRemove={(id) => toggle(id)}
        />
        <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">vs</div>
        <TeamPanel
          label="Team B"
          accent="#2563eb"
          players={[slots[2], slots[3]].map((id) => (id ? byId.get(id) ?? null : null))}
          score={scoreB}
          setScore={setScoreB}
          winning={ready && scoreB > scoreA}
          onRemove={(id) => toggle(id)}
        />
      </div>

      {/* Player palette */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Tap to add &middot; tap again to remove
        </p>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const idx = slots.indexOf(p.id);
            const team = idx >= 0 ? SLOT_TEAM[idx] : null;
            const isResting = idx < 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition ${
                  team
                    ? "border-transparent bg-court-soft text-ink ring-1 ring-court/30"
                    : "border-line bg-surface text-muted"
                }`}
              >
                <PlayerAvatar player={p} size={26} dim={isResting} />
                <span className="font-medium">{p.name}</span>
                {team ? (
                  <span
                    className="tnum rounded-full px-1.5 text-xs font-bold text-white"
                    style={{ backgroundColor: team === "A" ? "var(--color-court)" : "#2563eb" }}
                  >
                    {team}
                  </span>
                ) : (
                  <span className="text-[0.7rem] uppercase tracking-wide">rest</span>
                )}
              </button>
            );
          })}
        </div>
        {resting.length === 1 ? (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-ink">{resting[0].name}</span> sits this one out.
          </p>
        ) : null}
      </div>

      {/* Winner preview + submit */}
      <div className="court-rule pt-4">
        <p className={`tnum mb-3 text-center text-sm ${ready ? "font-semibold text-court" : "text-muted"}`}>
          {winnerText}
        </p>
        {error ? (
          <p className="mb-3 rounded-lg bg-shuttle-soft px-3 py-2 text-center text-sm text-loss">{error}</p>
        ) : null}
        <button type="button" onClick={submit} disabled={!ready || pending} className={`${btnPrimary} w-full`}>
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save game"}
        </button>
      </div>
    </div>
  );
}

function TeamPanel({
  label,
  accent,
  players,
  score,
  setScore,
  winning,
  onRemove,
}: {
  label: string;
  accent: string;
  players: (MiniPlayer | null)[];
  score: number;
  setScore: (n: number) => void;
  winning: boolean;
  onRemove: (id: string) => void;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(99, n));
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: accent }}>
        <span className="font-display text-sm font-semibold text-white">{label}</span>
        {winning ? <span className="text-xs font-semibold text-white/90">Winner</span> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-stretch">
        <div className="flex flex-col gap-1.5 p-3">
          {players.map((p, i) =>
            p ? (
              <button
                key={p.id}
                type="button"
                onClick={() => onRemove(p.id)}
                className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-court-soft"
              >
                <PlayerAvatar player={p} size={28} />
                <span className="truncate font-medium">{p.name}</span>
              </button>
            ) : (
              <div key={i} className="flex items-center gap-2 px-1 py-1 text-muted">
                <span className="inline-block h-7 w-7 rounded-full border border-dashed border-line" />
                <span className="text-sm">Empty</span>
              </div>
            ),
          )}
        </div>
        {/* Scoreboard */}
        <div className="flex flex-col items-center justify-center gap-1 bg-court-deep px-3 py-2 text-white">
          <button
            type="button"
            aria-label={`${label} plus one`}
            onClick={() => setScore(clamp(score + 1))}
            className="flex h-7 w-9 items-center justify-center rounded-md bg-white/15 text-lg leading-none hover:bg-white/25"
          >
            +
          </button>
          <input
            inputMode="numeric"
            aria-label={`${label} score`}
            value={score}
            onChange={(e) => setScore(clamp(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
            className="tnum w-16 bg-transparent text-center text-3xl font-bold outline-none"
          />
          <button
            type="button"
            aria-label={`${label} minus one`}
            onClick={() => setScore(clamp(score - 1))}
            className="flex h-7 w-9 items-center justify-center rounded-md bg-white/15 text-lg leading-none hover:bg-white/25"
          >
            &minus;
          </button>
        </div>
      </div>
    </div>
  );
}
