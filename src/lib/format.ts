export function isWithinHours(isoDate: string, hours: number, now = Date.now()): boolean {
  return now - new Date(isoDate).getTime() <= hours * 60 * 60 * 1000;
}

export function formatRelativeTime(isoDate: string, now = new Date()) {
  const then = new Date(isoDate);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
