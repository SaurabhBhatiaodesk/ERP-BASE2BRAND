import { useEffect, useRef } from "react";
import {
  fetchActiveClockSession,
  fetchTodayOfficeSession,
  insertEmployeeScreenshot,
  type EmployeeProfile,
} from "@/lib/database";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  SCREENSHOT_CAPTURE_INTERVAL_MS,
  SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS,
  markScreenshotCaptured,
  msUntilNextScreenshotAllowed,
} from "@/lib/screenshotConfig";

const MIN_IMAGE_BYTES = 1500;

type CaptureContext = {
  userName: string;
  getProfile: () => EmployeeProfile | null | undefined;
  isCancelled: () => boolean;
};

let hookInstances = 0;
let nextTimer: ReturnType<typeof setTimeout> | null = null;
let captureInFlight = false;

function clearScreenshotTimer() {
  if (nextTimer) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function scheduleNextCapture(ctx: CaptureContext, delayMs: number) {
  clearScreenshotTimer();
  nextTimer = setTimeout(() => {
    void runCaptureCycle(ctx);
  }, delayMs);
}

async function runCaptureCycle(ctx: CaptureContext) {
  if (ctx.isCancelled() || captureInFlight || hookInstances === 0) return;

  captureInFlight = true;
  let nextDelay = SCREENSHOT_CAPTURE_INTERVAL_MS;

  try {
    const profile = ctx.getProfile();
    const name = profile?.name || ctx.userName;
    const session = await fetchActiveClockSession(name, profile?.id);
    const todaySession = session ? null : await fetchTodayOfficeSession(name, profile?.id);
    const isMeetingBreak =
      todaySession?.status === "paused" &&
      !!todaySession?.notes?.toLowerCase().includes("meeting");
    const activeSession = session || (isMeetingBreak ? todaySession : null);

    if (!activeSession) {
      nextDelay = SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS;
      return;
    }

    const remaining = msUntilNextScreenshotAllowed();
    if (remaining > 0) {
      nextDelay = remaining;
      return;
    }

    if (typeof window === "undefined" || !(window as any).electronAPI?.takeScreenshot) return;

    const base64Img = await (window as any).electronAPI.takeScreenshot();
    if (!base64Img || ctx.isCancelled()) return;

    const res = await fetch(base64Img);
    const blob = await res.blob();
    if (blob.size < MIN_IMAGE_BYTES) {
      console.warn("Screenshot skipped: capture too small (blank screen?)");
      nextDelay = SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS;
      return;
    }

    const file = new File([blob], `screenshot_${Date.now()}.jpg`, { type: "image/jpeg" });
    const uploadResult = await uploadToCloudinary(file, "erp-screenshots");
    if (uploadResult?.url) {
      await insertEmployeeScreenshot({
        employeeName: name,
        employeeId: profile?.id,
        imageUrl: uploadResult.url,
      });
      markScreenshotCaptured();
      nextDelay = SCREENSHOT_CAPTURE_INTERVAL_MS;
    }
  } catch (err) {
    console.error("Background screenshot failed:", err);
    nextDelay = SCREENSHOT_RETRY_WHEN_OFF_CLOCK_MS;
  } finally {
    captureInFlight = false;
    if (!ctx.isCancelled() && hookInstances > 0) {
      scheduleNextCapture(ctx, nextDelay);
    }
  }
}

function startScreenshotScheduler(ctx: CaptureContext) {
  clearScreenshotTimer();
  scheduleNextCapture(ctx, msUntilNextScreenshotAllowed());
}

function stopScreenshotScheduler() {
  clearScreenshotTimer();
}

export function useEmployeeScreenshotCapture(
  userName: string,
  userProfile?: EmployeeProfile | null,
  enabled = true,
) {
  const profileRef = useRef(userProfile);
  const cancelledRef = useRef(false);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (!enabled || !userName) return;
    if (typeof window === "undefined" || !(window as any).electronAPI?.takeScreenshot) return;

    cancelledRef.current = false;
    hookInstances += 1;

    const ctx: CaptureContext = {
      userName,
      getProfile: () => profileRef.current,
      isCancelled: () => cancelledRef.current,
    };

    if (hookInstances === 1) {
      startScreenshotScheduler(ctx);
    }

    return () => {
      cancelledRef.current = true;
      hookInstances = Math.max(0, hookInstances - 1);
      if (hookInstances === 0) {
        stopScreenshotScheduler();
      }
    };
  }, [enabled, userName]);
}
