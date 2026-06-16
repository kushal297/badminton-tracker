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

/** One- or two-letter initials for an avatar. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
