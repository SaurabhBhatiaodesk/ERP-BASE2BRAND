import { useEffect, useState } from "react";
import { Mail, MessageSquare, Loader2, Users } from "lucide-react";
import { fetchProjectTeam, type TeamMember } from "@/lib/database";

function GlassCard({ children, className = "", style = {}, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

const statusDot: Record<string, string> = {
  online: "#10B981",
  busy: "#F59E0B",
  away: "#8891B8",
  offline: "#4B5563",
};

const memberColors = ["#7B5CF5", "#F47B52", "#4C6EF5", "#06B6D4", "#10B981", "#F59E0B"];

export function Team({ organizationId }: { organizationId?: string }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setTeam([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchProjectTeam(organizationId)
      .then(result => { if (!cancelled) setTeam(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your team."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their team.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading your team...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load your team</p>
        <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>
      </div>
    );
  }

  const avgExperience = team.length > 0
    ? team.reduce((sum, m) => sum + (m.yearsExperience ?? 0), 0) / team.length
    : 0;
  const availableNow = team.filter(m => m.presenceStatus === "online").length;
  const roleCount = new Set(team.map(m => m.role).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Your Team</h1>
        <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Meet the dedicated team working on your project</p>
      </div>

      {team.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Users size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Your team hasn't been assigned yet.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Team Size", value: String(team.length), sub: "dedicated members" },
              { label: "Avg Experience", value: `${avgExperience.toFixed(1)}y`, sub: "across all roles" },
              { label: "Available Now", value: String(availableNow), sub: "online and ready" },
              { label: "Roles Represented", value: String(roleCount), sub: "on your engagement" },
            ].map(stat => (
              <GlassCard key={stat.label} className="p-4">
                <p style={{ color: "#E2E4F0", fontSize: 20, fontWeight: 700 }}>{stat.value}</p>
                <p style={{ color: "#C4C8E0", fontSize: 13, fontWeight: 500, marginTop: 1 }}>{stat.label}</p>
                <p style={{ color: "#8891B8", fontSize: 11 }}>{stat.sub}</p>
              </GlassCard>
            ))}
          </div>

          {/* Team grid */}
          <div className="grid grid-cols-3 gap-4">
            {team.map((member, i) => {
              const color = memberColors[i % memberColors.length];
              const dot = member.presenceStatus ? statusDot[member.presenceStatus] : statusDot.offline;
              return (
                <GlassCard
                  key={member.id}
                  className="p-5 transition-all"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `1px solid ${color}30`, color, fontSize: 15, fontWeight: 700 }}
                      >
                        {member.initials}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: dot, borderColor: "#07091A" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>{member.fullName}</p>
                      <p style={{ color, fontSize: 12 }}>{member.role ?? "Team Member"}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-4">
                    {member.availabilityText && (
                      <div className="rounded-lg px-3 py-2" style={{ background: `${dot}10`, border: `1px solid ${dot}20` }}>
                        <p style={{ color: dot, fontSize: 11 }}>{member.availabilityText}</p>
                      </div>
                    )}
                    {member.specialty && <p style={{ color: "#8891B8", fontSize: 11 }}>{member.specialty}</p>}
                  </div>

                  <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex gap-3">
                      <div className="text-center">
                        <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 700 }}>{member.yearsExperience ?? "—"}{member.yearsExperience !== null ? "y" : ""}</p>
                        <p style={{ color: "#8891B8", fontSize: 10 }}>Experience</p>
                      </div>
                      <div className="text-center">
                        <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 700 }}>{member.activeTaskCount}</p>
                        <p style={{ color: "#8891B8", fontSize: 10 }}>Active Tasks</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={member.email ? `mailto:${member.email}` : undefined}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", opacity: member.email ? 1 : 0.4, pointerEvents: member.email ? "auto" : "none" }}
                      >
                        <Mail size={13} />
                      </a>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD" }}>
                        <MessageSquare size={13} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
