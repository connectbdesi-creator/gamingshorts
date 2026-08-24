import { getPlatform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export function PlatformChip({
  platform,
  active = false,
  className,
}: {
  platform: string;
  active?: boolean;
  className?: string;
}) {
  const info = getPlatform(platform);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground-muted",
        className
      )}
    >
      {info?.label ?? platform}
    </span>
  );
}
