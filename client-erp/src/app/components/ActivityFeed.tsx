import { useEffect, useState } from "react";
import { Activity, Loader2, CheckCircle, Sparkles, Flag, Circle } from "lucide-react";
import { fetchActivityFeed, type ActivityFeedEntry } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

function iconFor(type: string) {
  if (type === "approved") return { icon: CheckCircle, color: "#10B981" };
  if (type === "completed") return { icon: Flag, color: "#4C6EF5" };
  if (type === "sprint") return { icon: Sparkles, color: "#7B5CF5" };
  return { icon: Circle, color: "#F47B52" };
}

export function ActivityFeed({ organizationId }: { organizationId?: string }) {
  const [activity, setActivity] = useState<ActivityFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setActivity([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchActivityFeed(organizationId)
      .then(result => { if (!cancelled) setActivity(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their activity.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Activity Feed</h1>
        <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Everything happening across your projects</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading activity...</p>
        </div>
      )}

      {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

      {!loading && !error && activity.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Activity size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>No activity yet.</p>
        </div>
      )}

      {!loading && !error && activity.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex flex-col gap-3">
            {activity.map((item, i) => {
              const { icon: Icon, color } = iconFor(item.type);
              return (
                <div key={item.id} className="flex items-start gap-3 py-2" style={{ borderBottom: i < activity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ color: "#E2E4F0", fontSize: 13 }}>{item.text}</p>
                    <p style={{ color: "#8891B8", fontSize: 11, marginTop: 2 }}>{item.user} · {item.projectName} · {item.timeLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
