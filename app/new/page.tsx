import Link from "next/link";
import { getPlayers } from "@/lib/data";
import { GameEntryForm } from "@/components/GameEntryForm";
import { PageHeader, EmptyState, btnPrimary } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { isValidISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function NewGamePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { date } = await searchParams;
  const today = todayISO();
  const defaultDate = typeof date === "string" && isValidISODate(date) && date <= today ? date : today;
  const players = await getPlayers();
  const active = players.filter((p) => p.is_active);

  if (active.length < 4) {
    return (
      <>
        <PageHeader title="Log a game" />
        <EmptyState
          title="Add players first"
          hint="You need at least four active players to record a 2v2 game."
          action={
            <Link href="/players" className={btnPrimary}>
              Manage players
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Log a game" subtitle="Pick four players, tap in the score, save." />
      <GameEntryForm
        players={active.map((p) => ({ id: p.id, name: p.name, color: p.color, photo_url: p.photo_url }))}
        defaultDate={defaultDate}
      />
    </>
  );
}
