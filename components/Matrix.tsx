import { PlayerAvatar } from "@/components/PlayerAvatar";

type MiniPlayer = { id: string; name: string; color: string | null; photo_url: string | null };

export type MatrixCell = { text: string; tone: "win" | "loss" | "muted"; faded?: boolean };

const TONE: Record<MatrixCell["tone"], string> = {
  win: "bg-court-soft text-court",
  loss: "bg-shuttle-soft text-loss",
  muted: "bg-paper text-muted",
};

/**
 * A 5x5 results grid. Row = the player you read across for; columns are the
 * other players. The diagonal is blank. `cell` returns null when the pair has
 * never met in the relevant sense.
 */
export function Matrix({
  players,
  cell,
}: {
  players: MiniPlayer[];
  cell: (rowId: string, colId: string) => MatrixCell | null;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[20rem] table-fixed border-collapse text-center">
        <thead>
          <tr>
            <th className="w-9 p-1" />
            {players.map((c) => (
              <th key={c.id} className="p-1">
                <span className="flex justify-center">
                  <PlayerAvatar player={c} size={26} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((r) => (
            <tr key={r.id}>
              <th className="p-1">
                <span className="flex justify-center">
                  <PlayerAvatar player={r} size={26} />
                </span>
              </th>
              {players.map((c) => {
                if (r.id === c.id) {
                  return (
                    <td key={c.id} className="p-1">
                      <div className="rounded-md bg-paper py-1.5 text-muted/40">·</div>
                    </td>
                  );
                }
                const d = cell(r.id, c.id);
                return (
                  <td key={c.id} className="p-1">
                    {d ? (
                      <div className={`tnum rounded-md py-1.5 text-xs font-semibold ${TONE[d.tone]} ${d.faded ? "opacity-45" : ""}`}>
                        {d.text}
                      </div>
                    ) : (
                      <div className="rounded-md bg-paper py-1.5 text-xs text-muted/40">–</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
