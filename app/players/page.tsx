import { getAllData } from "@/lib/data";
import { computeAll } from "@/lib/stats/computeAll";
import { PlayersManager } from "@/components/PlayersManager";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const { players, games, sessions } = await getAllData();
  const out = computeAll(players, games, sessions);

  const rows = players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    photo_url: p.photo_url,
    is_active: p.is_active,
    gamesPlayed: out.perPlayer[p.id]?.gamesPlayed ?? 0,
  }));

  return (
    <>
      <PageHeader title="Players" subtitle="Add, rename, retire — history is always kept" />
      <PlayersManager initial={rows} />
    </>
  );
}
