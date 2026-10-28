const PREFIX = "roses:resume:";
/** Positions closer than this to the start or end are not worth resuming. */
const EDGE_SECONDS = 5;

export function readResume(videoId: string, duration: number): number {
  try {
    const value = Number(localStorage.getItem(PREFIX + videoId));
    if (!Number.isFinite(value) || value < EDGE_SECONDS) return 0;
    if (duration > 0 && value > duration - EDGE_SECONDS) return 0;
    return value;
  } catch {
    return 0;
  }
}

export function writeResume(
  videoId: string,
  position: number,
  duration: number,
) {
  try {
    if (
      position < EDGE_SECONDS ||
      (duration > 0 && position > duration - EDGE_SECONDS)
    ) {
      localStorage.removeItem(PREFIX + videoId);
    } else {
      localStorage.setItem(PREFIX + videoId, String(Math.floor(position)));
    }
  } catch {
    // storage unavailable (private mode): resuming is a convenience only
  }
}
