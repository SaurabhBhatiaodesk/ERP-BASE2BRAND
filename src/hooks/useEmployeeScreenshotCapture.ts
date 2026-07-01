import { useEffect, useRef } from "react";
import {
  fetchActiveClockSession,
  fetchTodayOfficeSession,
  insertEmployeeScreenshot,
  type EmployeeProfile,
} from "@/lib/database";
import { uploadToCloudinary } from "@/lib/cloudinary";

const CAPTURE_INTERVAL_MS = 10 * 60 * 1000;
const INITIAL_DELAY_MS = 10_000;
const MIN_IMAGE_BYTES = 1500;

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
    if (typeof window === "undefined" || !(window as any).electronAPI?.takeScreenshot) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const captureScreenshot = async () => {
      try {
        const profile = profileRef.current;
        const name = profile?.name || userName;
        const session = await fetchActiveClockSession(name, profile?.id);
        const todaySession =
          session ? null : await fetchTodayOfficeSession(name, profile?.id);
        const isMeetingBreak =
          todaySession?.status === "paused" &&
          !!todaySession?.notes?.toLowerCase().includes("meeting");
        const activeSession = session || (isMeetingBreak ? todaySession : null);
        if (!activeSession) return;

        const base64Img = await (window as any).electronAPI.takeScreenshot();
        if (!base64Img || cancelled) return;

        const res = await fetch(base64Img);
        const blob = await res.blob();
        if (blob.size < MIN_IMAGE_BYTES) {
          console.warn("Screenshot skipped: capture too small (blank screen?)");
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
        }
      } catch (err) {
        console.error("Background screenshot failed:", err);
      }
    };

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      void captureScreenshot();
      intervalId = setInterval(() => void captureScreenshot(), CAPTURE_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, userName]);
}
