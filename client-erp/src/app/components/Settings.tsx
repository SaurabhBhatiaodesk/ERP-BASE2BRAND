import { useEffect, useState } from "react";
import { Bell, Shield, Loader2 } from "lucide-react";
import { fetchClientSettings, updateClientSettings, type ClientSettings, type CurrentPersonContext } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{ width: 36, height: 20, background: checked ? "#7B5CF5" : "rgba(255,255,255,0.12)" }}
    >
      <div
        className="absolute rounded-full transition-all"
        style={{ width: 16, height: 16, top: 2, left: checked ? 18 : 2, background: "#fff" }}
      />
    </button>
  );
}

export function Settings({ context }: { context: CurrentPersonContext }) {
  const { person, organization } = context;
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchClientSettings(person.id)
      .then(result => { if (!cancelled) setSettings(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [person.id]);

  const patch = (partial: Partial<ClientSettings>) => {
    setSettings(prev => (prev ? { ...prev, ...partial } : prev));
    void updateClientSettings(person.id, partial).catch(() => { /* best-effort; refetch on next visit will correct drift */ });
  };

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Settings</h1>
        <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Account, notifications, and security preferences</p>
      </div>

      {/* Profile card */}
      <GlassCard
        className="p-5 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg, rgba(123,92,245,0.1), rgba(76,110,245,0.07))", border: "1px solid rgba(123,92,245,0.2)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #4C6EF5, #7B5CF5)", color: "#fff", fontSize: 20, fontWeight: 700 }}
        >
          {person.initials || person.fullName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1">
          <p style={{ color: "#E2E4F0", fontSize: 16, fontWeight: 700 }}>{person.fullName}</p>
          <p style={{ color: "#8891B8", fontSize: 13 }}>{person.email ?? "—"}</p>
          <p style={{ color: "#C4B5FD", fontSize: 12, marginTop: 2 }}>
            {person.role || (person.kind === "admin" ? "Admin" : "Client")}
            {organization ? ` · ${organization.name}` : ""}
            {organization?.planName ? ` · ${organization.planName}` : ""}
          </p>
        </div>
      </GlassCard>

      {loading || !settings ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading preferences...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Notifications */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(76,110,245,0.18)" }}>
                <Bell size={15} style={{ color: "#4C6EF5" }} />
              </div>
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Notifications</p>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { key: "emailNotifications" as const, label: "Email Notifications" },
                { key: "inAppAlerts" as const, label: "In-App Alerts" },
                { key: "smsAlerts" as const, label: "SMS Alerts" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between rounded-lg px-3 py-2.5">
                  <span style={{ color: "#C4C8E0", fontSize: 13 }}>{item.label}</span>
                  <Toggle checked={settings[item.key]} onChange={v => patch({ [item.key]: v })} />
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Security */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.18)" }}>
                <Shield size={15} style={{ color: "#10B981" }} />
              </div>
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Security</p>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5">
              <div>
                <p style={{ color: "#C4C8E0", fontSize: 13 }}>Two-Factor Authentication</p>
                <p style={{ color: "#8891B8", fontSize: 11, marginTop: 1 }}>Extra verification step at sign-in</p>
              </div>
              <Toggle checked={settings.twoFactorEnabled} onChange={v => patch({ twoFactorEnabled: v })} />
            </div>
          </GlassCard>

          {/* Appearance */}
          {/* <GlassCard className="p-5 col-span-2">
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Appearance</p>
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5">
              <span style={{ color: "#C4C8E0", fontSize: 13 }}>Theme</span>
              <div className="flex gap-2">
                {["dark", "light"].map(t => (
                  <button
                    key={t}
                    onClick={() => patch({ theme: t })}
                    className="rounded-lg px-3 py-1.5 capitalize"
                    style={{
                      background: settings.theme === t ? "rgba(123,92,245,0.2)" : "rgba(255,255,255,0.05)",
                      border: settings.theme === t ? "1px solid rgba(123,92,245,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      color: settings.theme === t ? "#C4B5FD" : "#8891B8",
                      fontSize: 12,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard> */}
        </div>
      )}
    </div>
  );
}
