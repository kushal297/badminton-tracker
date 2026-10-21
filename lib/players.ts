import type { Player } from "@/lib/types";

/** The minimal player shape needed to render an avatar (and pass to client components). */
export type MiniPlayer = Pick<Player, "id" | "name" | "color" | "photo_url">;

/** Project a full Player down to the avatar-only fields. */
export function toMini(p: Player): MiniPlayer {
  return { id: p.id, name: p.name, color: p.color, photo_url: p.photo_url };
}

/** Distinct, legible accent colors for player avatars and chart lines. */
export const PLAYER_PALETTE = [
  "#0B6E4F", // court green
  "#2563EB", // blue
  "#E8A317", // gold
  "#FF5C39", // shuttle coral
  "#7C3AED", // violet
  "#0EA5A0", // teal
  "#DB2777", // pink
  "#65A30D", // lime
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable color for a player: their saved color, else a deterministic palette pick. */
export function colorForPlayer(player: Pick<Player, "id" | "color">): string {
  return player.color ?? PLAYER_PALETTE[hashId(player.id) % PLAYER_PALETTE.length];
}

/**
 * Assign every player a colour. Saved colours are reserved first; players
 * without one then take unused palette entries in input order. Once the palette
 * is exhausted it cycles, so only then can two players share a colour.
 * Reordering or deleting players, or changing a saved colour, can shift the
 * automatic assignments.
 */
export function assignPlayerColors(players: Pick<Player, "id" | "color">[]): Map<string, string> {
  const result = new Map<string, string>();
  const reserved = new Set<string>();
  for (const p of players) {
    if (p.color) {
      result.set(p.id, p.color);
      reserved.add(p.color.toLowerCase());
    }
  }
  const free = PLAYER_PALETTE.filter((c) => !reserved.has(c.toLowerCase()));
  const pool = free.length > 0 ? free : PLAYER_PALETTE;
  let next = 0;
  for (const p of players) {
    if (p.color) continue;
    result.set(p.id, pool[next % pool.length]);
    next++;
  }
  return result;
}

/** One- or two-letter initials for an avatar. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
