import Link from "next/link";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-shuttle px-5 py-2.5 font-medium text-white shadow-sm transition active:scale-[0.98] hover:bg-[#ef4e2c] disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-medium text-ink transition hover:bg-court-soft";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="court-rule mt-3" />
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted ${className}`}>{children}</h2>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "ink" | "win" | "loss" | "court";
}) {
  const toneClass =
    tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : tone === "court" ? "text-court" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-[0.68rem] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`tnum mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export { Link };
