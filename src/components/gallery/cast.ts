type RemoteVideo = HTMLVideoElement & {
  remote?: { prompt: () => Promise<void> };
  webkitShowPlaybackTargetPicker?: () => void;
};

export type CastMethod = "remote" | "airplay";

/**
 * Feature detection for casting. The Remote Playback API covers Chromecast
 * (Chrome/Edge) and AirPlay (Safari); older Safari only has the WebKit picker.
 * No Cast SDK: it would load third-party script into the gallery.
 */
export function detectCast(video: HTMLVideoElement): CastMethod | null {
  const v = video as RemoteVideo;
  if (typeof v.remote?.prompt === "function") return "remote";
  if (typeof v.webkitShowPlaybackTargetPicker === "function") return "airplay";
  return null;
}

export async function promptCast(
  video: HTMLVideoElement,
  method: CastMethod,
): Promise<void> {
  const v = video as RemoteVideo;
  try {
    if (method === "remote") await v.remote?.prompt();
    else v.webkitShowPlaybackTargetPicker?.();
  } catch {
    // User dismissed the picker or no device is available.
  }
}
