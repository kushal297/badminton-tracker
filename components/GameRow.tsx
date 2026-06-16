import { PlayerAvatar } from "@/components/PlayerAvatar";
import { GameActions } from "@/components/GameActions";
import type { GameWithDate, Player } from "@/lib/types";

function TeamLine({ players, score, won }: { players: Player[]; score: number; won: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex -space-x-1.5">
          {players.map((p) => (
            <PlayerAvatar key={p.id} player={p} size={26} dim={!won} />
          ))}
        </span>
        <span className={`truncate text-sm ${won ? "font-semibold text-ink" : "text-muted"}`}>
          {players.map((p) => p.name).join(" & ")}
        </span>
      </div>
      <span className={`tnum text-xl font-bold ${won ? "text-court" : "text-muted"}`}>{score}</span>
    </div>
  );
}

export function GameRow({
  game,
  playersById,
  editable = false,
}: {
  game: GameWithDate;
  playersById: Map<string, Player>;
  editable?: boolean;
}) {
  const get = (id: string) => playersById.get(id);
  const teamA = [get(game.team_a1), get(game.team_a2)].filter(Boolean) as Player[];
  const teamB = [get(game.team_b1), get(game.team_b2)].filter(Boolean) as Player[];
  const aWon = game.score_a > game.score_b;
  const satOut = game.sat_out ? get(game.sat_out) : null;

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-start gap-2 p-3">
        <div className="flex-1 space-y-2">
          <TeamLine players={teamA} score={game.score_a} won={aWon} />
          <TeamLine players={teamB} score={game.score_b} won={!aWon} />
        </div>
        {editable ? (
          <GameActions gameId={game.id} editHref={`/sessions/${game.played_on}/${game.id}/edit`} />
        ) : null}
      </div>
      {satOut || game.game_target !== 21 ? (
        <div className="border-t border-line px-3 py-1.5 text-xs text-muted">
          {satOut ? <span>{satOut.name} rested</span> : null}
          {satOut && game.game_target !== 21 ? <span> &middot; </span> : null}
          {game.game_target !== 21 ? <span className="tnum">to {game.game_target}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
