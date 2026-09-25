import { useEffect, useState } from "react";
import { TrendingUp, Loader2, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { fetchAnalyticsData, type AnalyticsData, type DeliverableStatus, type TaskStatus } from "@/lib/database";

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

const PROJECT_COLORS = ["#7B5CF5", "#4C6EF5", "#06B6D4", "#10B981", "#F59E0B", "#F47B52"];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  completed: { label: "Completed", color: "#4C6EF5", bg: "rgba(76,110,245,0.12)" },
  planning: { label: "Planning", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

const deliverableStatusLabels: Record<DeliverableStatus, { label: string; color: string }> = {
  pending: { label: "Awaiting Review", color: "#F59E0B" },
  review: { label: "In Review", color: "#4C6EF5" },
  approved: { label: "Approved", color: "#10B981" },
  changes: { label: "Changes Requested", color: "#EF4444" },
};

const taskStatusLabels: Record<TaskStatus, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "#8891B8" },
  in_progress: { label: "In Progress", color: "#7B5CF5" },
  blocked: { label: "Blocked", color: "#EF4444" },
  completed: { label: "Completed", color: "#10B981" },
};

function healthColor(score: number | null): string {
  if (score === null) return "#8891B8";
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

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

export function Analytics({ organizationId, showFinancials = true }: { organizationId?: string; showFinancials?: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAnalyticsData(organizationId)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load analytics</p>
        {error && <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>}
      </div>
    );
  }

  const { projects, deliverablesByStatus, tasksByStatus } = data;
  const activeCount = projects.filter(p => p.status === "active").length;
  const completedCount = projects.filter(p => p.status === "completed").length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budgetTotal ?? 0), 0);
  const usedBudget = projects.reduce((sum, p) => sum + p.budgetUsed, 0);
  const utilizedPct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;
  const scoredProjects = projects.filter(p => p.healthScore !== null);
  const avgHealth = scoredProjects.length > 0
    ? Math.round(scoredProjects.reduce((sum, p) => sum + (p.healthScore ?? 0), 0) / scoredProjects.length)
    : null;

  const healthChartData = projects.map(p => ({ name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name, score: p.healthScore ?? 0 }));
  const budgetChartData = projects
    .filter(p => p.budgetTotal)
    .map(p => ({
      name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
      pct: p.budgetTotal ? Math.round((p.budgetUsed / p.budgetTotal) * 100) : 0,
    }));

  const deliverablesChartData = (Object.keys(deliverablesByStatus) as DeliverableStatus[])
    .map(status => ({ name: deliverableStatusLabels[status].label, value: deliverablesByStatus[status], color: deliverableStatusLabels[status].color }))
    .filter(d => d.value > 0);
  const totalDeliverables = deliverablesChartData.reduce((sum, d) => sum + d.value, 0);

  const tasksChartData = (Object.keys(tasksByStatus) as TaskStatus[])
    .map(status => ({ name: taskStatusLabels[status].label, value: tasksByStatus[status], color: taskStatusLabels[status].color }));
  const totalTasks = tasksChartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Analytics</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>
            {organizationId ? "Performance and delivery analytics across your projects" : "Performance and delivery analytics across every client"}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            ...(showFinancials ? [{ label: "Total Value", value: formatMoneyK(totalBudget), color: "#7B5CF5" }] : []),
            { label: "Active", value: String(activeCount), color: "#10B981" },
            { label: "Completed", value: String(completedCount), color: "#4C6EF5" },
            { label: "Avg Health", value: avgHealth !== null ? `${avgHealth}` : "—", color: healthColor(avgHealth) },
          ].map(stat => (
            <GlassCard key={stat.label} className="px-4 py-3 text-center" style={{ minWidth: 90 }}>
              <p style={{ color: stat.color, fontSize: 18, fontWeight: 700 }}>{stat.value}</p>
              <p style={{ color: "#8891B8", fontSize: 11 }}>{stat.label}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <BarChart3 size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>
            {organizationId
              ? "No projects yet — your Base2Brand team will add one here once your engagement kicks off."
              : "No client projects synced yet."}
          </p>
        </div>
      ) : (
        <>
          {/* Budget Utilization */}
          {showFinancials && (
            <GlassCard className="p-5" style={{ background: "linear-gradient(135deg, rgba(123,92,245,0.12), rgba(76,110,245,0.08))", border: "1px solid rgba(123,92,245,0.2)" }}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Budget Utilization Across Projects</p>
                <span style={{ color: "#10B981", fontSize: 13, fontWeight: 600 }}>
                  {formatMoneyK(usedBudget)} / {formatMoneyK(totalBudget)}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${utilizedPct}%`, background: "linear-gradient(90deg, #7B5CF5, #4C6EF5)" }} />
              </div>
              <p style={{ color: "#8891B8", fontSize: 12 }}>{utilizedPct}% utilized across all projects</p>
            </GlassCard>
          )}

          {/* Charts row 1: health + budget per project */}
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Health Score by Project</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthChartData} barSize={22}>
                    <XAxis dataKey="name" tick={{ fill: "#8891B8", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#8891B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0D1030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E4F0", fontSize: 12 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {healthChartData.map((d, i) => <Cell key={i} fill={healthColor(d.score)} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {showFinancials && (
              <GlassCard className="p-5">
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Budget Used by Project</p>
                {budgetChartData.length === 0 ? (
                  <div className="flex items-center justify-center" style={{ height: 220 }}>
                    <p style={{ color: "#8891B8", fontSize: 13 }}>No budgets set yet.</p>
                  </div>
                ) : (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetChartData} barSize={22}>
                        <XAxis dataKey="name" tick={{ fill: "#8891B8", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#8891B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ background: "#0D1030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E4F0", fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Used"]} />
                        <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                          {budgetChartData.map((d, i) => <Cell key={i} fill={d.pct >= 90 ? "#EF4444" : "#7B5CF5"} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>
            )}
          </div>

          {/* Charts row 2: deliverables + tasks distribution */}
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Deliverables Status</p>
              {totalDeliverables === 0 ? (
                <div className="flex items-center justify-center" style={{ height: 200 }}>
                  <p style={{ color: "#8891B8", fontSize: 13 }}>No deliverables yet.</p>
                </div>
              ) : (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deliverablesChartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {deliverablesChartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0D1030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E4F0", fontSize: 12 }} />
                      <Legend formatter={(value) => <span style={{ color: "#8891B8", fontSize: 11 }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Task Status Breakdown</p>
              {totalTasks === 0 ? (
                <div className="flex items-center justify-center" style={{ height: 200 }}>
                  <p style={{ color: "#8891B8", fontSize: 13 }}>No tasks yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 justify-center" style={{ height: 200 }}>
                  {tasksChartData.map(d => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: "#8891B8", fontSize: 12 }}>{d.name}</span>
                        <span style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600 }}>{d.value}</span>
                      </div>
                      <ProgressBar value={totalTasks > 0 ? (d.value / totalTasks) * 100 : 0} color={d.color} />
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Project list */}
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
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                        <TrendingUp size={18} style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <p style={{ color: "#E2E4F0", fontSize: 15, fontWeight: 600 }}>{project.name}</p>
                          <span className="rounded-full px-2 py-0.5" style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 600 }}>
                            {st.label}
                          </span>
                          {project.organizationName && (
                            <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", fontSize: 10, fontWeight: 600 }}>
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
                      {showFinancials && (
                        <div className="text-right">
                          <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>
                            {project.budgetTotal ? `${formatMoneyK(project.budgetUsed)} / ${formatMoneyK(project.budgetTotal)}` : "—"}
                          </p>
                          <p style={{ color: "#8891B8", fontSize: 11 }}>Budget</p>
                        </div>
                      )}
                      <div className="px-3 py-1.5 rounded-lg text-center" style={{ background: (project.healthScore ?? 0) >= 90 ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }}>
                        <p style={{ color: (project.healthScore ?? 0) >= 90 ? "#10B981" : "#F59E0B", fontSize: 16, fontWeight: 700 }}>{project.healthScore ?? "—"}</p>
                        <p style={{ color: "#8891B8", fontSize: 10 }}>Health</p>
                      </div>
                      {project.teamInitials.length > 0 && (
                        <div className="flex -space-x-2">
                          {project.teamInitials.map((initials, ti) => (
                            <div key={`${initials}-${ti}`} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${color}30`, border: "2px solid #07091A", color, fontSize: 9, fontWeight: 700 }}>
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
        </>
      )}
    </div>
  );
}
