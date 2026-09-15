import { status } from "./simulation.ts";
import type { Game } from "./simulation.ts";

/**
 * Progress is deliberately separate from the simulation.  A headless run can
 * use the engine without accidentally teaching the browser learner's ranges.
 */
export const PROGRESS_VERSION = 1;
export const PROGRESS_KEY = "homeostasis-marathon.progress.v1";
export const RANGE_UNLOCK_SECONDS = 900;

export type LearnerProgress = {
  version: number;
  activeSeconds: number;
  failedRuns: number;
  rangesEarned: boolean;
};

export const emptyProgress = (): LearnerProgress => ({
  version: PROGRESS_VERSION,
  activeSeconds: 0,
  failedRuns: 0,
  rangesEarned: false,
});

export function readProgress(): LearnerProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<LearnerProgress>;
    if (parsed.version !== PROGRESS_VERSION) return emptyProgress();
    const active = parsed.activeSeconds;
    const failed = parsed.failedRuns;
    if (typeof active !== "number" || typeof failed !== "number") return emptyProgress();
    if (!Number.isFinite(active) || active < 0 || !Number.isFinite(failed) || failed < 0) return emptyProgress();
    const activeSeconds = Math.min(RANGE_UNLOCK_SECONDS, active);
    const failedRuns = Math.floor(failed);
    return {
      version: PROGRESS_VERSION,
      activeSeconds,
      failedRuns,
      rangesEarned: parsed.rangesEarned === true || failedRuns > 0 || activeSeconds >= RANGE_UNLOCK_SECONDS,
    };
  } catch {
    // Private browsing and disabled storage should not prevent a run.
    return emptyProgress();
  }
}

export function writeProgress(progress: LearnerProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Treat unavailable storage as an in-session-only progression.
  }
}

function isDangerous(game: Game): boolean {
  return [
    status("glucose", game.glucose),
    status("oxygen", game.oxygen),
    status("temperature", game.temperature),
    status("sodium", game.sodium),
  ].includes("danger") || game.hydration <= -6 || game.oxygenDelivery < 65;
}

/** Record only visible, active play.  `classroomTime` is the engine's active
 * clock, so pause time, rest, dialogs, and accelerated headless time do not
 * count here. */
export function advanceProgress(progress: LearnerProgress, previous: Game, next: Game): LearnerProgress {
  const failed = previous.phase === "running" && next.phase === "collapsed";
  const activeDelta = previous.phase === "running" && next.phase !== "collapsed" && next.pace > 0 && !isDangerous(next)
    ? Math.max(0, next.classroomTime - previous.classroomTime)
    : 0;
  const activeSeconds = Math.min(RANGE_UNLOCK_SECONDS, progress.activeSeconds + activeDelta);
  const failedRuns = progress.failedRuns + (failed ? 1 : 0);
  const rangesEarned = progress.rangesEarned || failed || activeSeconds >= RANGE_UNLOCK_SECONDS;
  if (activeDelta === 0 && !failed && rangesEarned === progress.rangesEarned && failedRuns === progress.failedRuns) return progress;
  return { version: PROGRESS_VERSION, activeSeconds, failedRuns, rangesEarned };
}

export function progressLabel(progress: LearnerProgress): string {
  if (progress.rangesEarned) return "Normal ranges earned";
  const minutes = Math.floor(progress.activeSeconds / 60);
  return `${minutes}/15 min active homeostasis`;
}
