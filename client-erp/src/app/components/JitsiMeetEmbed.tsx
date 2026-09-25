import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiMeetAPI;
  }
}

type JitsiMeetAPI = {
  dispose: () => void;
  addListener: (event: string, handler: () => void) => void;
};

let scriptPromise: Promise<void> | null = null;

/** Loads Jitsi's IFrame API script once and reuses it for every embed on the page. */
function loadJitsiScript(): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { scriptPromise = null; reject(new Error("Couldn't load the meeting — check your connection and try again.")); };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * True in-page embed via Jitsi's official IFrame API (meet.jit.si) — unlike
 * Google Meet, which refuses to be framed at all (X-Frame-Options: SAMEORIGIN),
 * this actually renders the live call inside our own page, full-screen overlay.
 */
export function JitsiMeetEmbed({ roomName, title, displayName, onClose }: {
  roomName: string;
  title: string;
  displayName: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    loadJitsiScript()
      .then(() => {
        if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI("meet.jit.si", {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true },
        });
        apiRef.current = api;
        api.addListener("videoConferenceLeft", onClose);
        api.addListener("readyToClose", onClose);
        setLoading(false);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Couldn't load the meeting."));

    return () => {
      disposed = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ zIndex: 100, background: "#000" }}>
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: "#0B0E28", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>{title}</p>
        <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: "#8891B8" }}>
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={26} color="#8891B8" className="animate-spin" />
            <p style={{ color: "#8891B8", fontSize: 13 }}>Connecting to the meeting...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't join the meeting</p>
            <p style={{ color: "#8891B8", fontSize: 13 }}>{error}</p>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
