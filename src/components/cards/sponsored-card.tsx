import { FallbackImage } from "@/components/media/fallback-image";
import type { SponsoredCardData } from "@/lib/sponsors";

/**
 * Visually matches NewsCard (same shape/spacing/hover treatment, so it
 * sits naturally in the grid) but clearly labeled "Sponsored" — CLAUDE.md's
 * native ad card requirement. Whole card links out to the sponsor's own
 * URL; no like/comment/share affordances, since those imply this is
 * editorial content rather than a paid placement.
 */
export function SponsoredCard({ sponsor, className }: { sponsor: SponsoredCardData; className?: string }) {
  return (
    <article className={`mb-4 break-inside-avoid overflow-hidden rounded-card border border-border bg-surface ${className ?? ""}`}>
      <a href={sponsor.cta_url} target="_blank" rel="noopener sponsored" className="group block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-background-elevated">
          <FallbackImage
            src={sponsor.image_url}
            alt={sponsor.headline}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3">
            <span className="rounded-chip bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
              Sponsored
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-4 py-4">
          <h2 className="line-clamp-3 text-base font-semibold leading-snug text-foreground">{sponsor.headline}</h2>
          <p className="line-clamp-3 text-sm leading-relaxed text-foreground-muted">{sponsor.body}</p>
          <span className="truncate text-xs text-foreground-subtle">{sponsor.sponsor_name}</span>
          <span className="mt-1 inline-flex w-fit items-center rounded-chip bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors group-hover:bg-accent-hover">
            {sponsor.cta_label}
          </span>
        </div>
      </a>
    </article>
  );
}
