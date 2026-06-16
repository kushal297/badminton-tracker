import { colorForPlayer, initials, type MiniPlayer } from "@/lib/players";

export function PlayerAvatar({
  player,
  size = 36,
  dim = false,
  ring = false,
}: {
  player: MiniPlayer;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ${
        ring ? "ring-2 ring-gold ring-offset-1 ring-offset-surface" : ""
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: colorForPlayer(player),
        fontSize: Math.round(size * 0.4),
        opacity: dim ? 0.4 : 1,
      }}
      title={player.name}
    >
      {player.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.photo_url}
          alt={player.name}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        initials(player.name)
      )}
    </span>
  );
}

/** Avatar followed by the player's name. */
export function PlayerTag({
  player,
  size = 28,
  className = "",
}: {
  player: MiniPlayer;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <PlayerAvatar player={player} size={size} />
      <span className="truncate font-medium">{player.name}</span>
    </span>
  );
}
