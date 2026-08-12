/** Minimum time between successful screenshot uploads (clocked-in employees). */
export const SCREENSHOT_CAPTURE_INTERVAL_MS = 15 * 60 * 1000;

/** First capture after clock-in / app start. */
export const SCREENSHOT_INITIAL_DELAY_MS = 30 * 1000;

/** Re-check clock-in state when between captures. */
export const SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS = 3 * 60 * 1000;

/** Retry sooner after a failed capture attempt. */
export const SCREENSHOT_RETRY_ON_FAILURE_MS = 3 * 60 * 1000;

/** Watchdog checks that the scheduler is still alive. */
export const SCREENSHOT_WATCHDOG_MS = 60 * 1000;

/** Abort a stuck capture so the scheduler can recover. */
export const SCREENSHOT_CAPTURE_TIMEOUT_MS = 90 * 1000;

function storageKey(employeeId?: string | null) {
  const day = new Date().toISOString().slice(0, 10);
  return `base2brand_last_screenshot_${employeeId || "anon"}_${day}`;
}

export function lastScreenshotCaptureMs(employeeId?: string | null): number {
  try {
    const raw = sessionStorage.getItem(storageKey(employeeId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function clearScreenshotThrottle(employeeId?: string | null) {
  try {
    sessionStorage.removeItem(storageKey(employeeId));
  } catch {
    /* ignore */
  }
}

export function markScreenshotCaptured(employeeId?: string | null, atMs = Date.now()) {
  try {
    sessionStorage.setItem(storageKey(employeeId), String(atMs));
  } catch {
    /* ignore */
  }
}

export function msUntilNextScreenshotAllowed(employeeId?: string | null, nowMs = Date.now()): number {
  const last = lastScreenshotCaptureMs(employeeId);
  if (!last) return 0;
  const elapsed = nowMs - last;
  return Math.max(0, SCREENSHOT_CAPTURE_INTERVAL_MS - elapsed);
}

export function logScreenshot(message: string, detail?: unknown) {
  if (detail !== undefined) {
    console.info(`[Screenshot] ${message}`, detail);
  } else {
    console.info(`[Screenshot] ${message}`);
  }
}
