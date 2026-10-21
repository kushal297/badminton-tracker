/**
 * Who sat out a game. Rules, in order:
 * 1. A stored id that is still resting wins.
 * 2. In create mode (`stored === undefined`) a lone resting player is assumed to sit out.
 * 3. Otherwise null; never guess a rester for an edited game.
 */
export function deriveSatOut(restingIds: string[], stored: string | null | undefined): string | null {
  if (typeof stored === "string" && restingIds.includes(stored)) return stored;
  if (stored === undefined && restingIds.length === 1) return restingIds[0];
  return null;
}
