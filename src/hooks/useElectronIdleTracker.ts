import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { fetchActiveClockSession, fetchTodayOfficeSession, clockOutEmployee, clockInEmployee, EmployeeProfile } from "@/lib/database";

// Idle threshold: 3 minutes of no activity → mark idle
const IDLE_THRESHOLD_SECS = 180;

// How often to ping DB with last_active_at (30 seconds)
const ACTIVE_PING_INTERVAL_MS = 30_000;

export function useElectronIdleTracker(userEmail: string, userProfile?: EmployeeProfile | null) {
  const [idleSeconds, setIdleSeconds] = useState(0);
  const profileRef = useRef(userProfile);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (!userEmail) return;

    let isElectron = false;
    let lastActivityTime = Date.now();
    let cleanupWebEvents: (() => void) | null = null;

    // @ts-ignore
    if (window.electronAPI) {
      isElectron = true;
    } else {
      // Web fallback: listen to DOM events to track activity
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

    // ONE-TIME RETROACTIVE IDLE CHECK on mount / wake
    const checkRetroactiveIdle = async () => {
      const profile = profileRef.current;
      if (!profile || !profile.last_active_at) return;

      const lastActive = new Date(profile.last_active_at).getTime();
      const timeSinceActive = Math.floor((Date.now() - lastActive) / 1000);

      if (timeSinceActive > IDLE_THRESHOLD_SECS) {
        const session = await fetchActiveClockSession(profile.name, profile.id);
        if (session && session.status === "active") {
          const sessionStart = new Date(session.sessionStart || session.clockIn).getTime();
          // Do not retroactively pause if the session was started AFTER the last active time
          if (sessionStart > lastActive) return;
          await clockOutEmployee({
            sessionId: session.id,
            employeeName: profile.name,
            employeeId: profile.id,
            reason: "idle",
            forceTimeMs: lastActive + 60000,
          });
        }
      }
    };
    checkRetroactiveIdle();

    // State machine:
    //   "active"  → currently working, or within idle threshold
    //   "idle"    → marked idle in DB (clockOutEmployee called)
    //   "locked"  → a DB operation is in progress (mutex)
    let state: "active" | "idle" | "locked" = "active";
    let lastActivePingMs = 0;        // last time we pinged DB with last_active_at
    let lastResumeMs = 0;            // last time we called clockInEmployee for resume

    const intervalId = setInterval(async () => {
      try {
        // ─── 1. Get current idle time ───────────────────────────────────────
        let time = 0;
        if (isElectron) {
          // @ts-ignore
          time = await window.electronAPI.getSystemIdleTime();
        } else {
          time = Math.floor((Date.now() - lastActivityTime) / 1000);
        }

        setIdleSeconds(time);
        const now = Date.now();
        const profile = profileRef.current;

        // ─── 2. IDLE DETECTION: active → idle ──────────────────────────────
        // Only trigger once per idle period (mutex via "locked" state)
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
                dbCallMade = true;
              } else {
                // No active session found – still mark as idle locally
                dbCallMade = true;
              }
            }
            // If profile was null, don't set state to idle (retry next tick)
          } finally {
            state = dbCallMade ? "idle" : "active";
          }
        }

        // ─── 3. ACTIVE DETECTION: idle → resume ────────────────────────────
        // As soon as user is active again (time < threshold), try to resume
        if (time < IDLE_THRESHOLD_SECS && state === "idle") {
          if (now - lastResumeMs > 5000) {
            state = "locked";
            lastResumeMs = now;
            try {
              if (profile) {
                const session = await fetchTodayOfficeSession(profile.name, profile.id);
                if (session && session.status === "paused") {
                  const segments = session.segments || [];
                  // Sort segments by startedAt to get the true last one
                  const sorted = [...segments].sort((a, b) =>
                    new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
                  );
                  const lastSegment = sorted.slice(-1)[0];
                  // Auto-resume if paused by idle (kind=idle NEW, or kind=break with idle label LEGACY)
                  const isIdlePause =
                    lastSegment &&
                    (lastSegment.kind === "idle" ||
                      (lastSegment.kind === "break" &&
                        (lastSegment.label.toLowerCase().includes("idle") ||
                          lastSegment.label === "System Idle")));
                  // Also check session notes for "idle" keyword (legacy)
                  const isIdleNotes =
                    session.notes?.toLowerCase().includes("idle") ||
                    session.notes?.toLowerCase().includes("system idle");
                  if (isIdlePause || isIdleNotes) {
                    await clockInEmployee({
                      employeeName: profile.name,
                      employeeId: profile.id,
                    });
                  }
                }
              }
            } finally {
              state = "active";
            }
          }
        }

        // ─── 4. ACTIVE PING: update last_active_at every 30s ───────────────
        // Ping whenever user is active (time < threshold) AND state is active or idle
        // (not locked — we don't want concurrent DB calls)
        if (time < IDLE_THRESHOLD_SECS && state !== "locked" && now - lastActivePingMs > ACTIVE_PING_INTERVAL_MS) {
          lastActivePingMs = now;
          await supabase
            .from("employee_profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("email", userEmail);
        }
      } catch (err) {
        // Reset state on error to prevent getting stuck in "locked"
        if (state === "locked") state = "active";
        console.error("Idle tracker error:", err);
      }
    }, 5000); // Check every 5 seconds (not every 1 second — reduces race conditions)

    return () => {
      clearInterval(intervalId);
      if (cleanupWebEvents) cleanupWebEvents();
    };
  }, [userEmail]);

  return idleSeconds;
}
