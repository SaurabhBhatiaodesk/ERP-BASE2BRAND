import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { fetchActiveClockSession, fetchTodayOfficeSession, clockOutEmployee, clockInEmployee, EmployeeProfile } from "@/lib/database";

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
      
      if (timeSinceActive > 180) {
        const session = await fetchActiveClockSession(profile.name, profile.id);
        if (session && session.status === "active") {
          const sessionStart = new Date(session.sessionStart || session.clockIn).getTime();
          // Do not retroactively pause if the session was started AFTER the last active time
          // (e.g. they just logged in)
          if (sessionStart > lastActive) {
            return;
          }
          await clockOutEmployee({
            sessionId: session.id,
            employeeName: profile.name,
            employeeId: profile.id,
            reason: "idle",
            forceTimeMs: lastActive + 60000 // Give 1 minute buffer after last active ping
          });
        }
      }
    };
    checkRetroactiveIdle();

    let lastUpdatedDb = 0;
    let lastIdleState = "active";

    const intervalId = setInterval(async () => {
      try {
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

        // Auto-pause to "idle" if idle > 3 mins
        if (time > 180 && lastIdleState === "active") {
          lastIdleState = "idle";
          if (profile) {
            const session = await fetchActiveClockSession(profile.name, profile.id);
            if (session && session.status === "active") {
              await clockOutEmployee({
                sessionId: session.id,
                employeeName: profile.name,
                employeeId: profile.id,
                reason: "idle",
                forceTimeMs: now - Math.floor(time * 1000)
              });
            }
          }
        } 

        // SYNC LOGIC & AUTO-RESUME: Run when active, max once per minute
        if (time < 60 && now - lastUpdatedDb > 60000) {
          lastUpdatedDb = now;
          lastIdleState = "active"; // Reset local state
          
          // 1. Update last_active_at
          await supabase
            .from("employee_profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("email", userEmail);
            
          // 2. Check if we need to auto-resume from a forced idle state
          if (profile) {
            const session = await fetchTodayOfficeSession(profile.name, profile.id);
            if (session && session.status === "paused") {
              const segments = session.segments || [];
              const lastSegment = segments.slice(-1)[0];
              if (lastSegment && lastSegment.kind === "idle") {
                await clockInEmployee({
                  employeeName: profile.name,
                  employeeId: profile.id,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Idle tracker error:", err);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      if (cleanupWebEvents) cleanupWebEvents();
    };
  }, [userEmail]);

  return idleSeconds;
}
