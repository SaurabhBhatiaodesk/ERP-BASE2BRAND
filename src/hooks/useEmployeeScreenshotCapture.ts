import { useEffect, useRef } from "react";
import {
  fetchActiveClockSession,
  fetchTodayOfficeSession,
  insertEmployeeScreenshot,
  type EmployeeProfile,
} from "@/lib/database";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import {
  SCREENSHOT_CAPTURE_INTERVAL_MS,
  SCREENSHOT_CAPTURE_TIMEOUT_MS,
  SCREENSHOT_INITIAL_DELAY_MS,
  SCREENSHOT_RETRY_ON_FAILURE_MS,
  SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS,
  SCREENSHOT_WATCHDOG_MS,
  logScreenshot,
  markScreenshotCaptured,
  clearScreenshotThrottle,
  msUntilNextScreenshotAllowed,
  lastScreenshotCaptureMs,
} from "@/lib/screenshotConfig";

const MIN_IMAGE_BYTES = 1500;

type CaptureState = {
  userName: string;
  employeeId?: string;
  getProfile: () => EmployeeProfile | null | undefined;
};

let subscribers = 0;
let activeState: CaptureState | null = null;
let nextTimer: ReturnType<typeof setTimeout> | null = null;
let captureInFlight = false;
let captureTimeout: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let bypassThrottleOnce = false;

function clearScreenshotTimer() {
  if (nextTimer) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function clearCaptureTimeout() {
  if (captureTimeout) {
    clearTimeout(captureTimeout);
    captureTimeout = null;
  }
}

function scheduleScreenshot(delayMs: number, reason: string) {
  clearScreenshotTimer();
  if (subscribers === 0 || !activeState) return;
  const waitMs =
    reason === "clock-in"
      ? Math.max(5_000, delayMs)
      : Math.max(15_000, delayMs);
  logScreenshot(`Next attempt in ${Math.round(waitMs / 1000)}s (${reason})`);
  nextTimer = setTimeout(() => {
    void runCaptureCycle();
  }, waitMs);
}

export function triggerScreenshotAfterClockIn() {
  if (subscribers === 0 || !activeState) return;
  clearScreenshotThrottle(activeState.employeeId);
  clearScreenshotTimer();
  captureInFlight = false;
  bypassThrottleOnce = true;
  scheduleScreenshot(5_000, "clock-in");
}

function kickScheduler(reason = "kick") {
  if (subscribers === 0 || !activeState) {
    clearScreenshotTimer();
    return;
  }
  if (nextTimer || captureInFlight) return;
  const delay =
    lastScreenshotCaptureMs(activeState.employeeId) > 0
      ? msUntilNextScreenshotAllowed(activeState.employeeId)
      : SCREENSHOT_INITIAL_DELAY_MS;
  scheduleScreenshot(delay, reason);
}

function ensureWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (subscribers > 0 && activeState && !nextTimer && !captureInFlight) {
      kickScheduler("watchdog");
    }
  }, SCREENSHOT_WATCHDOG_MS);
}

async function isOnClockToday(state: CaptureState): Promise<boolean> {
  const profile = state.getProfile();
  const name = profile?.name || state.userName;
  const employeeId = profile?.id || state.employeeId;

  const active = await fetchActiveClockSession(name, employeeId);
  if (active) {
    logScreenshot("Clock check: active session", { sessionId: active.id, status: active.status });
    return true;
  }

  const today = await fetchTodayOfficeSession(name, employeeId);
  const onClock = !!today && today.status !== "completed";
  logScreenshot(onClock ? "Clock check: on clock today" : "Clock check: off clock", {
    name,
    employeeId: employeeId || "unknown",
    todayStatus: today?.status ?? "none",
  });
  return onClock;
}

function beginCapture() {
  captureInFlight = true;
  clearCaptureTimeout();
  captureTimeout = setTimeout(() => {
    if (!captureInFlight) return;
    logScreenshot("Capture timed out — resetting scheduler");
    captureInFlight = false;
    if (subscribers > 0 && activeState) {
      scheduleScreenshot(SCREENSHOT_RETRY_ON_FAILURE_MS, "timeout");
    }
  }, SCREENSHOT_CAPTURE_TIMEOUT_MS);
}

function endCapture() {
  clearCaptureTimeout();
  captureInFlight = false;
}

async function runCaptureCycle() {
  clearScreenshotTimer();

  if (subscribers === 0 || !activeState) return;

  if (captureInFlight) {
    scheduleScreenshot(30_000, "capture-busy");
    return;
  }

  const state = activeState;
  beginCapture();
  let nextDelay = SCREENSHOT_CAPTURE_INTERVAL_MS;
  let nextReason = "interval";

  try {
    if (!(window as any).electronAPI?.takeScreenshot) {
      logScreenshot("Stopped: run the desktop app (Electron), not the browser tab");
      nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
      nextReason = "no-electron";
      return;
    }

    if (!isCloudinaryConfigured()) {
      logScreenshot("Paused: add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env, then restart app");
      nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
      nextReason = "cloudinary-missing";
      return;
    }

    const onClock = await isOnClockToday(state);
    if (!onClock) {
      logScreenshot("Skipped: not clocked in today — clock in to start screenshots");
      nextDelay = SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS;
      nextReason = "off-clock";
      return;
    }

    const remaining = bypassThrottleOnce ? 0 : msUntilNextScreenshotAllowed(state.employeeId);
    bypassThrottleOnce = false;
    if (remaining > 0) {
      nextDelay = remaining;
      nextReason = "throttle";
      return;
    }

    const profile = state.getProfile();
    const name = profile?.name || state.userName;
    const employeeId = profile?.id || state.employeeId;

    logScreenshot("Capturing screen…");
    const base64Img = await (window as any).electronAPI.takeScreenshot();
    if (!base64Img) {
      logScreenshot("Capture failed: Electron returned empty image (check screen permission)");
      nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
      nextReason = "empty-capture";
      return;
    }

    if (subscribers === 0) return;

    const res = await fetch(base64Img);
    const blob = await res.blob();
    if (blob.size < MIN_IMAGE_BYTES) {
      logScreenshot("Capture too small — likely blank screen", { bytes: blob.size });
      nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
      nextReason = "blank-capture";
      return;
    }

    logScreenshot("Uploading to Cloudinary…", { bytes: blob.size });
    const file = new File([blob], `screenshot_${Date.now()}.jpg`, { type: "image/jpeg" });
    const uploadResult = await uploadToCloudinary(file, "erp-screenshots");
    if (!uploadResult?.url) {
      logScreenshot("Cloudinary upload returned no URL");
      nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
      nextReason = "upload-failed";
      return;
    }

    logScreenshot("Saving to database…");
    await insertEmployeeScreenshot({
      employeeName: name,
      employeeId,
      imageUrl: uploadResult.url,
    });
    markScreenshotCaptured(employeeId);
    logScreenshot("Saved successfully", { url: uploadResult.url });
    nextDelay = SCREENSHOT_CAPTURE_INTERVAL_MS;
    nextReason = "saved";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Screenshot] Failed:", message, err);
    logScreenshot(`Failed: ${message}`);
    nextDelay = SCREENSHOT_RETRY_ON_FAILURE_MS;
    nextReason = "error";
  } finally {
    endCapture();
    if (subscribers > 0 && activeState) {
      scheduleScreenshot(nextDelay, nextReason);
    }
  }
}

function registerCapture(state: CaptureState) {
  subscribers += 1;
  activeState = state;
  logScreenshot("Scheduler started", {
    user: state.userName,
    employeeId: state.employeeId || "pending",
    electron: !!(window as any).electronAPI?.takeScreenshot,
    cloudinary: isCloudinaryConfigured(),
  });
  ensureWatchdog();
  kickScheduler("register");
}

function unregisterCapture() {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers === 0) {
    logScreenshot("Scheduler stopped");
    activeState = null;
    clearScreenshotTimer();
    endCapture();
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
  }
}

export function useEmployeeScreenshotCapture(
  userName: string,
  userProfile?: EmployeeProfile | null,
  enabled = true,
) {
  const profileRef = useRef(userProfile);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (!enabled || !userName) return;

    if (typeof window === "undefined" || !(window as any).electronAPI?.takeScreenshot) {
      logScreenshot("Disabled: open the Base2Brand ERP desktop app (.exe), not localhost in Chrome");
      return;
    }



    const state: CaptureState = {
      userName,
      employeeId: userProfile?.id,
      getProfile: () => profileRef.current,
    };

    registerCapture(state);

    const onVisible = () => {
      if (document.visibilityState === "visible") kickScheduler("visible");
    };
    document.addEventListener("visibilitychange", onVisible);
    const onClockIn = () => triggerScreenshotAfterClockIn();
    window.addEventListener("b2b:clock-in", onClockIn);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("b2b:clock-in", onClockIn);
      unregisterCapture();
    };
  }, [enabled, userName, userProfile?.id]);
}
