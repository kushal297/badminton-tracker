import { notFound } from "next/navigation";
import { getAllData } from "@/lib/data";
import { GameEntryForm, type EntryInitial } from "@/components/GameEntryForm";
import { PageHeader } from "@/components/ui";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditGamePage({ params }: { params: Promise<{ date: string; gameId: string }> }) {
  const { gameId } = await params;
  const { players, games } = await getAllData();
  const game = games.find((g) => g.id === gameId);
  if (!game) notFound();

  // Show active players, plus anyone in this game even if since deactivated.
  const inGame = new Set([game.team_a1, game.team_a2, game.team_b1, game.team_b2, game.sat_out].filter(Boolean) as string[]);
  const palette = players
    .filter((p) => p.is_active || inGame.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, color: p.color, photo_url: p.photo_url }));

  const initial: EntryInitial = {
    slots: [game.team_a1, game.team_a2, game.team_b1, game.team_b2],
    scoreA: game.score_a,
    scoreB: game.score_b,
    playedOn: game.played_on,
    gameTarget: game.game_target,
  };

  return (
    <>
      <PageHeader title="Edit game" subtitle={formatDateLong(game.played_on)} />
      <GameEntryForm mode="edit" gameId={gameId} players={palette} defaultDate={game.played_on} initial={initial} />
    </>
  );
}
