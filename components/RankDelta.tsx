export function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-[0.6rem] text-muted/40">new</span>;
  if (delta === 0) return <span className="text-xs text-muted">–</span>;
  const up = delta > 0;
  return (
    <span className={`tnum text-[0.7rem] font-semibold ${up ? "text-win" : "text-loss"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
