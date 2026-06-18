import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useElectronIdleTracker(userEmail: string) {
  const [idleSeconds, setIdleSeconds] = useState(0);

  useEffect(() => {
    // Only run if we are inside the Electron wrapper and have a user logged in
    // @ts-ignore
    if (!window.electronAPI || !userEmail) {
      if (!window.electronAPI) setIdleSeconds(-1);
      return;
    }

    let lastUpdated = 0;

    const intervalId = setInterval(async () => {
      try {
        // @ts-ignore
        const time = await window.electronAPI.getSystemIdleTime();
        setIdleSeconds(time);
        
        // For testing, log it occasionally
        if (time > 0 && time % 10 === 0) {
          console.log(`[Electron Tracker] System Idle Time: ${time} seconds`);
        }

        // SYNC LOGIC: If system is active (idle < 60s), ping DB every 1 minute
        const now = Date.now();
        if (time < 60 && now - lastUpdated > 60000) {
          lastUpdated = now;
          await supabase
            .from("employee_profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("email", userEmail);
        }
      } catch (err) {
        console.error("Failed to fetch system idle time from Electron:", err);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [userEmail]);

  return idleSeconds;
}
