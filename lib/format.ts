/** Small display helpers. Kept pure so they can be used on server or client. */

const EN_DASH = "–";

export function formatPct(value: number | null, digits = 0): string {
  if (value === null) return EN_DASH;
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRating(value: number): string {
  return Math.round(value).toString();
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

/** A win/loss record like "9–3". */
export function formatRecord(wins: number, losses: number): string {
  return `${wins}${EN_DASH}${losses}`;
}

/** Signed streak as scoreboard text: W3 / L2 / — */
export function formatStreak(streak: number): string {
  if (streak > 0) return `W${streak}`;
  if (streak < 0) return `L${-streak}`;
  return EN_DASH;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Mon 16 Jun" from a 'YYYY-MM-DD' string (parsed as a plain calendar date). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Mon 16 Jun 2026" — longer form for headers. */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's calendar date as 'YYYY-MM-DD' in the given IANA timezone. */
export function todayISO(timeZone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}
