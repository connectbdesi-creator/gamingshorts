// Detects a showcase/event-style burst in new RSS volume and flags a
// temporary "dense mode" window — CLAUDE.md's "denser refresh cadence
// during known showcase windows (Direct, State of Play, Summer Game
// Fest...)" without hardcoding a fragile calendar of event dates (which
// needs constant upkeep and still misses surprise announcements). Instead
// this reacts to the actual evidence a showcase produces: a burst of new
// articles across outlets, all at once — exactly what candidatesConsidered
// (the not-yet-seen RSS item count, pre-classification) measures.

const HISTORY_WINDOW = 10;
// Below this many prior runs, there's no real baseline yet — a fresh repo
// or one just past a seen.json reset would otherwise read every ordinary
// run as a "spike" against an empty/tiny average.
const MIN_HISTORY_FOR_DETECTION = 3;
const SPIKE_MULTIPLIER = 2.5;
// Even a 2.5x jump off a very small baseline (e.g. 3 -> 8) isn't a real
// event — this floor requires the absolute count to also look like actual
// showcase-level volume.
const SPIKE_MIN_ABSOLUTE = 15;
const DENSE_MODE_HOURS = 6;

export interface EventDetectionState {
  recentCandidateCounts?: number[];
  denseModeUntil?: string;
}

export interface EventDetectionResult {
  recentCandidateCounts: number[];
  denseModeUntil?: string;
  spikeDetected: boolean;
}

/**
 * Call once per run with that run's candidatesConsidered. Returns the
 * updated history (write back into data/meta.json) and, when a spike is
 * detected, a new denseModeUntil timestamp — ingest.yml's "Check if a run
 * is due" step reads this to use a much shorter due-threshold while it's
 * still in the future, so the standing ~2-hour cadence temporarily
 * collapses to roughly the trigger interval itself.
 */
export function updateEventDetection(
  state: EventDetectionState,
  candidatesConsidered: number,
  now: Date
): EventDetectionResult {
  const history = state.recentCandidateCounts ?? [];

  let spikeDetected = false;
  if (history.length >= MIN_HISTORY_FOR_DETECTION) {
    const avg = history.reduce((sum, n) => sum + n, 0) / history.length;
    if (candidatesConsidered >= Math.max(SPIKE_MIN_ABSOLUTE, avg * SPIKE_MULTIPLIER)) {
      spikeDetected = true;
    }
  }

  const recentCandidateCounts = [...history, candidatesConsidered].slice(-HISTORY_WINDOW);

  let denseModeUntil = state.denseModeUntil;
  if (denseModeUntil && new Date(denseModeUntil) <= now) denseModeUntil = undefined;
  if (spikeDetected) {
    denseModeUntil = new Date(now.getTime() + DENSE_MODE_HOURS * 60 * 60 * 1000).toISOString();
  }

  return { recentCandidateCounts, denseModeUntil, spikeDetected };
}
