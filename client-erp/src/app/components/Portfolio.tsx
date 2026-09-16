import { useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { fetchPortfolioProjects, type PortfolioProject } from "@/lib/database";

function GlassCard({ children, className = "", style = {}, onMouseEnter, onMouseLeave }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

/** No `color` column on `projects` (it's a purely visual accent) — cycle a fixed palette by list position, same as every other page's health-score colors. */
const PROJECT_COLORS = ["#7B5CF5", "#4C6EF5", "#06B6D4", "#10B981", "#F59E0B", "#F47B52"];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  completed: { label: "Completed", color: "#4C6EF5", bg: "rgba(76,110,245,0.12)" },
  planning: { label: "Planning", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

function formatMoneyK(amount: number): string {
  return amount >= 1000 ? `$${(amount / 1000).toFixed(0)}K` : `$${Math.round(amount)}`;
}

function formatDate(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function Portfolio({ organizationId }: { organizationId?: string }) {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPortfolioProjects(organizationId)
      .then(result => { if (!cancelled) setProjects(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load portfolio."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading your portfolio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load your portfolio</p>
        <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>
      </div>
    );
  }

  const activeCount = projects.filter(p => p.status === "active").length;
  const completedCount = projects.filter(p => p.status === "completed").length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budgetTotal ?? 0), 0);
  const usedBudget = projects.reduce((sum, p) => sum + p.budgetUsed, 0);
  const utilizedPct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Portfolio</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>
            {organizationId ? "All active and completed projects across your account" : "Every project across every client"}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: "Total Value", value: formatMoneyK(totalBudget), color: "#7B5CF5" },
            { label: "Active", value: String(activeCount), color: "#10B981" },
            { label: "Completed", value: String(completedCount), color: "#4C6EF5" },
          ].map(stat => (
            <GlassCard key={stat.label} className="px-4 py-3 text-center" style={{ minWidth: 90 }}>
              <p style={{ color: stat.color, fontSize: 18, fontWeight: 700 }}>{stat.value}</p>
              <p style={{ color: "#8891B8", fontSize: 11 }}>{stat.label}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Portfolio Budget Overview */}
      {projects.length > 0 && (
        <GlassCard className="p-5" style={{ background: "linear-gradient(135deg, rgba(123,92,245,0.12), rgba(76,110,245,0.08))", border: "1px solid rgba(123,92,245,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Portfolio Budget Utilization</p>
            <span style={{ color: "#10B981", fontSize: 13, fontWeight: 600 }}>
              {formatMoneyK(usedBudget)} / {formatMoneyK(totalBudget)}
            </span>
          </div>
          <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${utilizedPct}%`,
                background: "linear-gradient(90deg, #7B5CF5, #4C6EF5)",
              }}
            />
          </div>
          <p style={{ color: "#8891B8", fontSize: 12 }}>{utilizedPct}% utilized across all projects</p>
        </GlassCard>
      )}

      {/* Project Cards */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p style={{ color: "#8891B8", fontSize: 13 }}>
            {organizationId
              ? "No projects yet — your Base2Brand team will add one here once your engagement kicks off."
              : "No client projects synced yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {projects.map((project, i) => {
            const st = statusConfig[project.status];
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
            return (
              <GlassCard
                key={project.id}
                className="p-5 cursor-pointer transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${color}40`;
                  e.currentTarget.style.background = `rgba(13,16,48,0.9)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.background = "rgba(13,16,48,0.7)";
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}20` }}
                    >
                      <TrendingUp size={18} style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <p style={{ color: "#E2E4F0", fontSize: 15, fontWeight: 600 }}>{project.name}</p>
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 600 }}
                        >
                          {st.label}
                        </span>
                        {project.organizationName && (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", fontSize: 10, fontWeight: 600 }}
                          >
                            {project.organizationName}
                          </span>
                        )}
                        {project.tags.map(tag => (
                          <span key={tag} className="rounded px-2 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", fontSize: 10 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p style={{ color: "#8891B8", fontSize: 12, marginBottom: 12 }}>
                        {project.category ?? "Project"} · Due {formatDate(project.launchDate, project.status === "completed" ? "Delivered" : "TBD")}
                      </p>
                      <ProgressBar value={project.progressPct} color={color} />
                      <div className="flex items-center justify-between mt-2">
                        <span style={{ color: "#8891B8", fontSize: 11 }}>{project.progressPct}% complete</span>
                        <span style={{ color: "#8891B8", fontSize: 11 }}>Milestone: {project.currentMilestone ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>
                        {project.budgetTotal ? `${formatMoneyK(project.budgetUsed)} / ${formatMoneyK(project.budgetTotal)}` : "—"}
                      </p>
                      <p style={{ color: "#8891B8", fontSize: 11 }}>Budget</p>
                    </div>
                    <div
                      className="px-3 py-1.5 rounded-lg text-center"
                      style={{ background: (project.healthScore ?? 0) >= 90 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }}
                    >
                      <p style={{ color: (project.healthScore ?? 0) >= 90 ? "#10B981" : "#F59E0B", fontSize: 16, fontWeight: 700 }}>{project.healthScore ?? "—"}</p>
                      <p style={{ color: "#8891B8", fontSize: 10 }}>Health</p>
                    </div>
                    {project.teamInitials.length > 0 && (
                      <div className="flex -space-x-2">
                        {project.teamInitials.map((initials, ti) => (
                          <div
                            key={`${initials}-${ti}`}
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: `${color}30`, border: "2px solid #07091A", color, fontSize: 9, fontWeight: 700 }}
                          >
                            {initials}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
