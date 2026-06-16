"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBeerRate } from "@/app/actions/beers";

/** Shows the current beers-per-no-show rate with an inline edit affordance. */
export function BeerRateEditor({ rate }: { rate: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      setError("Enter a whole number from 1 to 99.");
      return;
    }
    startTransition(async () => {
      const res = await setBeerRate(n);
      if (!res.ok) {
        setError(res.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="tnum">
          <span className="font-semibold text-ink">{rate}</span> beers per no-show
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(String(rate));
            setEditing(true);
          }}
          aria-label="Edit beer rate"
          className="rounded-full border border-line bg-surface px-2 py-0.5 text-ink transition hover:bg-court-soft"
        >
          ✎
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2 text-muted">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="tnum w-16 rounded-lg border border-line bg-surface px-2 py-1 text-ink"
        />
        beers per no-show
      </label>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-full bg-shuttle px-3 py-1 font-medium text-white transition hover:bg-[#ef4e2c] active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        disabled={pending}
        className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-ink transition hover:bg-court-soft disabled:opacity-60"
      >
        Cancel
      </button>
      {error ? <span className="w-full text-xs text-loss">{error}</span> : null}
    </div>
  );
}
