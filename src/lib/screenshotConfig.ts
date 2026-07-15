/** Minimum time between successful screenshot uploads (clocked-in employees). */
export const SCREENSHOT_CAPTURE_INTERVAL_MS = 30 * 60 * 1000;

/** First capture after app start when none taken yet this interval window. */
export const SCREENSHOT_INITIAL_DELAY_MS = 5 * 60 * 1000;

/** Re-check clock-in state when between captures. */
export const SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS = 10 * 60 * 1000;

const STORAGE_KEY = "base2brand_last_screenshot_at";

export function lastScreenshotCaptureMs(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function markScreenshotCaptured(atMs = Date.now()) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(atMs));
  } catch {
    /* ignore */
  }
}

export function msUntilNextScreenshotAllowed(nowMs = Date.now()): number {
  const last = lastScreenshotCaptureMs();
  if (!last) return SCREENSHOT_INITIAL_DELAY_MS;
  const elapsed = nowMs - last;
  return Math.max(0, SCREENSHOT_CAPTURE_INTERVAL_MS - elapsed);
}
