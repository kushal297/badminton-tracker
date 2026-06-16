import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatSigned } from "@/lib/format";
import type { GameWithDate, Player } from "@/lib/types";

type Mover = { playerId: string; delta: number } | null;

/** A team's two players as overlapping avatars + "A & B". */
function TeamLine({ players, won }: { players: Player[]; won: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex -space-x-1.5">
        {players.map((p) => (
          <PlayerAvatar key={p.id} player={p} size={24} dim={!won} />
        ))}
      </span>
      <span className={`truncate text-sm ${won ? "font-semibold text-ink" : "text-muted"}`}>
        {won ? "🏆 " : ""}
        {players.map((p) => p.name).join(" & ")}
      </span>
    </div>
  );
}

/**
 * The match card on session screens. A left accent bar colored by how decisive
 * the result was: green for a 6+ blowout, gold for in-between, neutral slate for
 * a tight 4-or-fewer finish. Tapping the card opens the edit screen.
 */
export function MatchCard({
  game,
  playersById,
  mover,
}: {
  game: GameWithDate;
  playersById: Map<string, Player>;
  mover: Mover;
}) {
  const get = (id: string) => playersById.get(id);
  const teamA = [get(game.team_a1), get(game.team_a2)].filter(Boolean) as Player[];
  const teamB = [get(game.team_b1), get(game.team_b2)].filter(Boolean) as Player[];
  const aWon = game.score_a > game.score_b;
  const winners = aWon ? teamA : teamB;
  const losers = aWon ? teamB : teamA;
  const winnerScore = aWon ? game.score_a : game.score_b;
  const loserScore = aWon ? game.score_b : game.score_a;

  const margin = Math.abs(game.score_a - game.score_b);
  // Decisive (>=6) → win green; close (<=4) → neutral slate; in-between → gold.
  const accent = margin >= 6 ? "bg-win" : margin <= 4 ? "bg-line" : "bg-gold";

  const satOut = game.sat_out ? get(game.sat_out) : null;
  const moverPlayer = mover ? get(mover.playerId) : null;

  return (
    <Link
      href={`/sessions/${game.played_on}/${game.id}/edit`}
      className="relative block overflow-hidden rounded-xl border border-line bg-surface pl-3 transition hover:bg-court-soft active:scale-[0.99]"
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${accent}`} aria-hidden />
      <div className="flex items-center gap-3 py-3 pr-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <TeamLine players={winners} won />
          <TeamLine players={losers} won={false} />
        </div>
        <span className="tnum shrink-0 rounded-lg bg-court-soft px-2.5 py-1.5 text-lg font-bold text-court">
          {winnerScore} – {loserScore}
        </span>
      </div>

      {satOut || moverPlayer ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-1.5 pr-3 text-xs text-muted">
          {satOut ? <span>💤 {satOut.name} rested</span> : null}
          {moverPlayer && mover ? (
            <span className="tnum inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-medium text-ink">
              ⚡ {moverPlayer.name} {formatSigned(Math.round(mover.delta))}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
