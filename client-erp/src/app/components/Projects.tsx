import { useEffect, useState } from "react";
import { Calendar, TrendingUp, DollarSign, Users, CheckCircle, Loader2 } from "lucide-react";
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from "recharts";
import { fetchProjectDetail, type ProjectDetail, type ChangeRequestStatus } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const kanbanColumns: { id: ChangeRequestStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "#8891B8" },
  { id: "in-progress", label: "In Progress", color: "#7B5CF5" },
  { id: "review", label: "In Review", color: "#F59E0B" },
  { id: "approved", label: "Approved", color: "#10B981" },
];

function activityDotColor(type: string): string {
  if (type === "approved") return "#10B981";
  if (type === "completed") return "#4C6EF5";
  if (type === "sprint") return "#7B5CF5";
  return "#F47B52";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoneyK(amount: number): string {
  return amount >= 1000 ? `$${(amount / 1000).toFixed(0)}K` : `$${Math.round(amount)}`;
}

const projectStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  completed: { label: "Completed", color: "#4C6EF5", bg: "rgba(76,110,245,0.12)" },
  planning: { label: "Planning", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

const prioColors: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const statusColors: Record<string, string> = {
  approved: "#10B981",
  "in-progress": "#7B5CF5",
  backlog: "#8891B8",
  review: "#F59E0B",
};

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function Projects({ organizationId }: { organizationId?: string }) {
  const [activeTab, setActiveTab] = useState<"overview" | "changes">("overview");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchProjectDetail(organizationId)
      .then(result => { if (!cancelled) setDetail(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load project."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their project.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading your project...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load your project</p>
        <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>
      </div>
    );
  }

  if (!detail || !detail.project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>No project yet — your Base2Brand team will set one up here once your engagement kicks off.</p>
      </div>
    );
  }

  const { project, projectManagerName, velocityHistory, currentSprint, currentSprintBreakdown, recentActivity, changeRequests } = detail;
  const velocityData = velocityHistory.map(s => ({ sprint: s.label, points: s.velocityPoints ?? 0 }));
  const sprintCompletePct = currentSprintBreakdown.total > 0
    ? Math.round((currentSprintBreakdown.completed / currentSprintBreakdown.total) * 100)
    : 0;
  const budgetUsedPct = project.budgetTotal ? Math.round((project.budgetUsed / project.budgetTotal) * 100) : null;

  return (
    <div className="flex flex-col gap-0 h-full overflow-hidden">
      {/* Project header */}
      <div
        className="px-6 py-5 flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, rgba(123,92,245,0.12) 0%, rgba(76,110,245,0.08) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 style={{ color: "#E2E4F0", fontSize: 20, fontWeight: 700 }}>{project.name}</h1>
              <span
                className="rounded-full px-2 py-0.5"
                style={{
                  background: projectStatusConfig[project.status]?.bg ?? "rgba(255,255,255,0.08)",
                  color: projectStatusConfig[project.status]?.color ?? "#8891B8",
                  fontSize: 11, fontWeight: 600,
                }}
              >
                {projectStatusConfig[project.status]?.label ?? project.status}
              </span>
            </div>
            <p style={{ color: "#8891B8", fontSize: 13 }}>{project.category ?? "Project"}</p>
          </div>
          <div
            className="px-4 py-2 rounded-xl text-center"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <p style={{ color: "#10B981", fontSize: 22, fontWeight: 700 }}>{project.healthScore ?? "—"}</p>
            <p style={{ color: "#8891B8", fontSize: 10 }}>Health Score</p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Project Manager", value: projectManagerName ?? "Unassigned", icon: Users, color: "#7B5CF5" },
            { label: "Start Date", value: formatDate(project.startDate), icon: Calendar, color: "#4C6EF5" },
            { label: "Launch Date", value: formatDate(project.launchDate), icon: Calendar, color: "#10B981" },
            { label: "Current Sprint", value: currentSprint?.label ?? "None active", icon: TrendingUp, color: "#F47B52" },
            { label: "Budget Used", value: budgetUsedPct !== null ? `${budgetUsedPct}% (${formatMoneyK(project.budgetUsed)})` : "—", icon: DollarSign, color: "#F59E0B" },
            { label: "Completion", value: `${project.progressPct}%`, icon: CheckCircle, color: "#10B981" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} style={{ color: item.color }} />
                  <p style={{ color: "#8891B8", fontSize: 10 }}>{item.label}</p>
                </div>
                <p style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600 }}>{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { id: "overview", label: "Project Overview" },
          { id: "changes", label: "Change Requests" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-3 transition-all"
            style={{
              color: activeTab === tab.id ? "#C4B5FD" : "#8891B8",
              borderBottom: activeTab === tab.id ? "2px solid #7B5CF5" : "2px solid transparent",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Sprint velocity chart */}
              <GlassCard className="col-span-2 p-5">
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sprint Velocity</p>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={velocityData}>
                      <defs>
                        <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7B5CF5" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#7B5CF5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="sprint" tick={{ fill: "#8891B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8891B8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0D1030", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E4F0", fontSize: 12 }} />
                      <Area type="monotone" dataKey="points" stroke="#7B5CF5" strokeWidth={2} fill="url(#velGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Current sprint */}
              <GlassCard className="p-5">
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {currentSprint ? `${currentSprint.label} Status` : "No Active Sprint"}
                </p>
                {currentSprint ? (
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Total Tasks", value: String(currentSprintBreakdown.total), color: "#E2E4F0" },
                      { label: "Completed", value: String(currentSprintBreakdown.completed), color: "#10B981" },
                      { label: "In Progress", value: String(currentSprintBreakdown.inProgress), color: "#7B5CF5" },
                      { label: "Blocked", value: String(currentSprintBreakdown.blocked), color: "#EF4444" },
                      { label: "Not Started", value: String(currentSprintBreakdown.notStarted), color: "#8891B8" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span style={{ color: "#8891B8", fontSize: 12 }}>{item.label}</span>
                        <span style={{ color: item.color, fontSize: 14, fontWeight: 700 }}>{item.value}</span>
                      </div>
                    ))}
                    <div className="mt-2">
                      <ProgressBar value={sprintCompletePct} color="#7B5CF5" />
                      <p style={{ color: "#8891B8", fontSize: 11, marginTop: 4 }}>{sprintCompletePct}% complete</p>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "#8891B8", fontSize: 13 }}>No sprint is currently active.</p>
                )}
              </GlassCard>
            </div>

            {/* Recent activity in project */}
            <GlassCard className="p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Updates</p>
              <div className="flex flex-col gap-3">
                {recentActivity.length === 0 && (
                  <p style={{ color: "#8891B8", fontSize: 13 }}>No activity yet.</p>
                )}
                {recentActivity.map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 py-2" style={{ borderBottom: i < recentActivity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: activityDotColor(item.type) }} />
                    <div className="flex-1">
                      <p style={{ color: "#E2E4F0", fontSize: 13 }}>{item.text}</p>
                      <p style={{ color: "#8891B8", fontSize: 11, marginTop: 2 }}>{item.user} · {item.timeLabel}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {activeTab === "changes" && (
          <div className="flex flex-col gap-4">
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Change Request Kanban</p>

            {/* Kanban */}
            <div className="grid grid-cols-4 gap-3">
              {kanbanColumns.map(col => (
                <div key={col.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <p style={{ color: "#8891B8", fontSize: 12, fontWeight: 600 }}>{col.label}</p>
                    <span className="rounded-full px-1.5" style={{ background: "rgba(255,255,255,0.08)", color: "#8891B8", fontSize: 10 }}>
                      {changeRequests.filter(cr => cr.status === col.id).length}
                    </span>
                  </div>
                  <div
                    className="min-h-32 rounded-xl p-2 flex flex-col gap-2"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
                  >
                    {changeRequests
                      .filter(cr => cr.status === col.id)
                      .map(cr => (
                        <div
                          key={cr.id}
                          className="rounded-lg p-3"
                          style={{ background: "rgba(13,16,48,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <p style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{cr.title}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="rounded-full px-1.5 py-0.5"
                              style={{ background: `${prioColors[cr.priority]}18`, color: prioColors[cr.priority], fontSize: 9, fontWeight: 600, textTransform: "capitalize" }}
                            >
                              {cr.priority}
                            </span>
                            <span style={{ color: "#8891B8", fontSize: 10 }}>{cr.requestNumber}</span>
                          </div>
                          <p style={{ color: "#8891B8", fontSize: 10, marginTop: 4 }}>{cr.assignedToName ?? "Unassigned"} · Due {cr.dueLabel}</p>
                          {cr.progressPct > 0 && (
                            <div className="mt-2">
                              <ProgressBar value={cr.progressPct} color={col.color} />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Full CR table */}
            <GlassCard className="p-5">
              <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>All Change Requests</p>
              <div className="flex flex-col gap-2">
                {changeRequests.length === 0 && (
                  <p style={{ color: "#8891B8", fontSize: 13 }}>No change requests yet.</p>
                )}
                {changeRequests.map(cr => (
                  <div key={cr.id} className="flex items-center gap-4 rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: "#8891B8", fontSize: 12, fontFamily: "monospace", minWidth: 60 }}>{cr.requestNumber}</span>
                    <div className="flex-1">
                      <p style={{ color: "#E2E4F0", fontSize: 13 }}>{cr.title}</p>
                      <p style={{ color: "#8891B8", fontSize: 11 }}>Assigned to {cr.assignedToName ?? "Unassigned"}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5" style={{ background: `${prioColors[cr.priority]}18`, color: prioColors[cr.priority], fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>
                      {cr.priority}
                    </span>
                    <span className="rounded-full px-2 py-0.5" style={{ background: `${statusColors[cr.status]}18`, color: statusColors[cr.status], fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>
                      {cr.status.replace("-", " ")}
                    </span>
                    <span style={{ color: "#8891B8", fontSize: 11 }}>{cr.dueLabel}</span>
                    <div style={{ width: 80 }}>
                      <ProgressBar value={cr.progressPct} color={statusColors[cr.status]} />
                      <p style={{ color: "#8891B8", fontSize: 10, marginTop: 2, textAlign: "right" }}>{cr.progressPct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
