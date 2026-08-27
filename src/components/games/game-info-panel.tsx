import { ExternalLink } from "lucide-react";
import { FallbackImage } from "@/components/media/fallback-image";
import type { GameInfo } from "@/types/game-info";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-28 shrink-0 font-semibold text-foreground">{label}</span>
      <span className="text-foreground-muted">{value}</span>
    </div>
  );
}

/**
 * RAWG-sourced game info card, rendered on /game/[slug] whenever
 * data/games.json has an entry for that slug (see scripts/ingest/game-info.ts).
 * Omitted entirely when it doesn't — RAWG's coverage is inconsistent
 * enough that "no info available" is the normal case for a lot of titles,
 * not a bug.
 */
export function GameInfoPanel({ info }: { info: GameInfo }) {
  return (
    <div className="mb-6 overflow-hidden rounded-card border border-border bg-surface">
      {info.background_image && (
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-background-elevated">
          <FallbackImage
            src={info.background_image}
            alt={`${info.name} artwork`}
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent" />
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        {info.description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-foreground-muted">
            {info.description}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {info.released && <InfoRow label="Released" value={info.released} />}
          {info.developers.length > 0 && (
            <InfoRow label="Developer(s)" value={info.developers.join(", ")} />
          )}
          {info.publishers.length > 0 && (
            <InfoRow label="Publisher(s)" value={info.publishers.join(", ")} />
          )}
          {info.genres.length > 0 && <InfoRow label="Genres" value={info.genres.join(", ")} />}
          {info.platforms.length > 0 && (
            <InfoRow label="Platforms" value={info.platforms.join(", ")} />
          )}
        </div>

        {info.screenshots.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {info.screenshots.map((url, index) => (
              <div
                key={url}
                className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-chip bg-background-elevated"
              >
                <FallbackImage
                  src={url}
                  alt={`${info.name} screenshot ${index + 1}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {info.stores.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Where to play
            </span>
            {info.stores.map((store) => (
              <a
                key={store.url}
                href={store.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-chip border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
              >
                {store.name}
                <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
