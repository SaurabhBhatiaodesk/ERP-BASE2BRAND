import { useEffect, useState } from "react";
import { Bell, CheckCircle, Clock, AlertTriangle, Sparkles, CreditCard, Package, Loader2 } from "lucide-react";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem, type NotificationType } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  deliverable: { icon: Package, color: "#7B5CF5" },
  invoice: { icon: CreditCard, color: "#F59E0B" },
  task: { icon: CheckCircle, color: "#10B981" },
  ai_summary: { icon: Sparkles, color: "#4C6EF5" },
  meeting: { icon: Clock, color: "#06B6D4" },
  support_ticket: { icon: AlertTriangle, color: "#EF4444" },
};

function iconFor(type: NotificationType | null) {
  return typeConfig[type ?? "task"] ?? { icon: Bell, color: "#8891B8" };
}

export function Notifications({ personId }: { personId: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchNotifications(personId)
      .then(result => { if (!cancelled) setNotifications(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load notifications."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personId]);

  const handleMarkRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationRead(id).catch(() => { /* best-effort; the list will resync on next visit */ });
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    void markAllNotificationsRead(personId).catch(() => { /* best-effort */ });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Notifications</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Project updates, approvals, and alerts</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="rounded-lg px-3 py-1.5" style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", fontSize: 12 }}>
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading notifications...</p>
        </div>
      )}

      {!loading && error && (
        <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Bell size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>You're all caught up — no notifications yet.</p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <GlassCard className="overflow-hidden">
          {notifications.map((n, i) => {
            const { icon: Icon, color } = iconFor(n.type);
            return (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className="flex items-start gap-4 p-4 cursor-pointer transition-all"
                style={{
                  background: n.read ? "transparent" : "rgba(123,92,245,0.05)",
                  borderBottom: i < notifications.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "transparent" : "rgba(123,92,245,0.05)"; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</p>
                    {!n.read && <div className="w-2 h-2 rounded-full" style={{ background: "#7B5CF5" }} />}
                  </div>
                  {n.description && <p style={{ color: "#8891B8", fontSize: 12, marginTop: 2 }}>{n.description}</p>}
                  <p style={{ color: "#8891B8", fontSize: 11, marginTop: 4 }}>{n.timeLabel}</p>
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}
