"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearBeers } from "@/app/actions/beers";

/** Pay off everything a player currently owes. */
export function MarkPaidButton({ playerId, owed }: { playerId: string; owed: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(`Clear all ${owed} beer${owed === 1 ? "" : "s"} for this player?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await clearBeers(playerId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-court-soft active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? "Clearing…" : "Paid 🍻"}
      </button>
      {error ? <span className="mt-1 text-xs text-loss">{error}</span> : null}
    </span>
  );
}
