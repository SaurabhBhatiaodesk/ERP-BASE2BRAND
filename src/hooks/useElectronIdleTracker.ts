import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveClockSession,
  fetchTodayOfficeSession,
  clockOutEmployee,
  clockInEmployee,
  isIdlePausedSession,
  EmployeeProfile,
} from "@/lib/database";

import { IDLE_THRESHOLD_SECS } from "@/lib/idleConfig";

export { IDLE_THRESHOLD_SECS };
const ACTIVE_PING_INTERVAL_MS = 30_000;
const CLOCK_SESSION_CHANGED = "clock-session-changed";

function notifyClockSessionChanged() {
  window.dispatchEvent(new CustomEvent(CLOCK_SESSION_CHANGED));
}

export function useElectronIdleTracker(userEmail: string, userProfile?: EmployeeProfile | null) {
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [idleTrackingPaused, setIdleTrackingPaused] = useState(false);
  const profileRef = useRef(userProfile);
  const pausedRef = useRef(idleTrackingPaused);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    pausedRef.current = idleTrackingPaused;
  }, [idleTrackingPaused]);

  useEffect(() => {
    if (!userEmail) return;

    let isElectron = false;
    let lastActivityTime = Date.now();
    let cleanupWebEvents: (() => void) | null = null;

    // @ts-ignore
    if (window.electronAPI) {
      isElectron = true;
    } else {
      const resetIdle = () => {
        lastActivityTime = Date.now();
      };
      window.addEventListener("mousemove", resetIdle);
      window.addEventListener("keydown", resetIdle);
      window.addEventListener("click", resetIdle);
      window.addEventListener("scroll", resetIdle);

      cleanupWebEvents = () => {
        window.removeEventListener("mousemove", resetIdle);
        window.removeEventListener("keydown", resetIdle);
        window.removeEventListener("click", resetIdle);
        window.removeEventListener("scroll", resetIdle);
      };
    }

    const readIdleSeconds = async () => {
      if (isElectron) {
        // @ts-ignore
        return (await window.electronAPI.getSystemIdleTime()) as number;
      }
      return Math.floor((Date.now() - lastActivityTime) / 1000);
    };

    let state: "active" | "idle" | "locked" = "active";
    let lastActivePingMs = 0;
    let lastResumeMs = 0;

    const bootstrapIdleSync = async () => {
      const profile = profileRef.current;
      if (!profile) return;

      const time = await readIdleSeconds();
      setIdleSeconds(time);

      const session = await fetchTodayOfficeSession(profile.name, profile.id);
      if (!session) {
        state = "active";
        return;
      }

      if (session.status === "paused" && isIdlePausedSession(session)) {
        if (time < IDLE_THRESHOLD_SECS) {
          state = "locked";
          try {
            await clockInEmployee({
              employeeName: profile.name,
              employeeId: profile.id,
            });
            lastActivePingMs = Date.now();
            notifyClockSessionChanged();
            state = "active";
          } catch {
            state = "idle";
          }
        } else {
          state = "idle";
        }
        return;
      }

      if (session.status === "active" && time >= IDLE_THRESHOLD_SECS) {
        const lastActive = profile.last_active_at
          ? new Date(profile.last_active_at).getTime()
          : 0;
        const sessionStart = new Date(session.sessionStart || session.clockIn).getTime();
        if (!lastActive || sessionStart <= lastActive) {
          await clockOutEmployee({
            sessionId: session.id,
            employeeName: profile.name,
            employeeId: profile.id,
            reason: "idle",
            forceTimeMs: lastActive ? lastActive + 60_000 : Date.now() - time * 1000,
          });
          notifyClockSessionChanged();
        }
        state = "idle";
        return;
      }

      state = "active";
    };

    bootstrapIdleSync();

    const intervalId = setInterval(async () => {
      try {
        if (pausedRef.current) return;
        const time = await readIdleSeconds();
        setIdleSeconds(time);
        const now = Date.now();
        const profile = profileRef.current;

        if (time >= IDLE_THRESHOLD_SECS && state === "active") {
          state = "locked";
          let dbCallMade = false;
          try {
            if (profile) {
              const session = await fetchActiveClockSession(profile.name, profile.id);
              if (session && session.status === "active") {
                const idleStartedMs = now - time * 1000;
                await clockOutEmployee({
                  sessionId: session.id,
                  employeeName: profile.name,
                  employeeId: profile.id,
                  reason: "idle",
                  forceTimeMs: idleStartedMs,
                });
                notifyClockSessionChanged();
                dbCallMade = true;
              } else {
                dbCallMade = true;
              }
            }
          } finally {
            state = dbCallMade ? "idle" : "active";
          }
        }

        if (time < IDLE_THRESHOLD_SECS && state === "idle") {
          if (now - lastResumeMs > 5000) {
            state = "locked";
            lastResumeMs = now;
            try {
              if (profile) {
                const session = await fetchTodayOfficeSession(profile.name, profile.id);
                if (session && isIdlePausedSession(session)) {
                  await clockInEmployee({
                    employeeName: profile.name,
                    employeeId: profile.id,
                  });
                  notifyClockSessionChanged();
                }
              }
            } finally {
              state = "active";
            }
          }
        }

        if (time < IDLE_THRESHOLD_SECS && state !== "locked" && now - lastActivePingMs > ACTIVE_PING_INTERVAL_MS) {
          lastActivePingMs = now;
          await supabase
            .from("employee_profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("email", userEmail);
        }
      } catch (err) {
        if (state === "locked") state = "active";
        console.error("Idle tracker error:", err);
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
      if (cleanupWebEvents) cleanupWebEvents();
    };
  }, [userEmail]);

  const togglePaused = useCallback(() => {
    setIdleTrackingPaused(prev => {
      const next = !prev;
      if (next) {
        // Pausing means "treat me as active regardless of literal system
        // idle time" — if the tracker had already auto-clocked them out for
        // being idle, resume immediately instead of leaving them stuck
        // clocked out until they touch the mouse/keyboard.
        void (async () => {
          const profile = profileRef.current;
          if (!profile) return;
          try {
            const session = await fetchTodayOfficeSession(profile.name, profile.id);
            if (session && isIdlePausedSession(session)) {
              await clockInEmployee({ employeeName: profile.name, employeeId: profile.id });
              notifyClockSessionChanged();
            }
          } catch (err) {
            console.error("Idle tracker resume-on-pause error:", err);
          }
        })();
      }
      return next;
    });
  }, []);

  return { idleSeconds, idleTrackingPaused, togglePaused };
}
