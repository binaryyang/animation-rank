import { useState } from "react";
import { Anime } from "./model";
export function Cover({
  anime,
  className = "",
}: {
  anime: Pick<Anime, "name" | "cover">;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  return anime.cover.startsWith("data:image/") && broken !== anime.cover ? (
    <img
      className={"cover " + className}
      src={anime.cover}
      onError={() => setBroken(anime.cover)}
      alt={anime.name}
    />
  ) : (
    <div className={"cover placeholder " + className}>
      <span>✦</span>
      <b>{anime.name.slice(0, 12)}</b>
    </div>
  );
}
