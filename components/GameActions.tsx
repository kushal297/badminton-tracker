"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteGame } from "@/app/actions/games";
import { auditRedirectPath } from "@/lib/auditNotice";

export function GameActions({ gameId, playedOn, editHref }: { gameId: string; playedOn: string; editHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    const pin = window.prompt("Delete this game? Enter the admin PIN to confirm — everyone's stats will recalculate.");
    if (pin === null) return;
    startTransition(async () => {
      const res = await deleteGame(gameId, pin);
      if (res && !res.ok) setError(res.error);
      else {
        setOpen(false);
        // A warning means the audit entry failed; the session page shows a banner saying so.
        if (res.warning) router.push(auditRedirectPath(playedOn, "audit-delete"));
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Game options"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-court-soft hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open ? (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <Link href={editHref} className="block px-3 py-2 text-sm hover:bg-court-soft" onClick={() => setOpen(false)}>
              Edit game
            </Link>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="block w-full px-3 py-2 text-left text-sm text-loss hover:bg-shuttle-soft disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete game"}
            </button>
            {error ? <p className="px-3 py-2 text-xs text-loss">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
