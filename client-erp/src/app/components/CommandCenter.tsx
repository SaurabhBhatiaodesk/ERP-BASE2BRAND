import { useEffect, useState } from "react";
import {
  TrendingUp, CheckCircle, Clock, AlertTriangle, DollarSign,
  Flag, Sparkles, ChevronRight, ArrowUpRight, Circle, Loader2, Users, ArrowRight
} from "lucide-react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis
} from "recharts";
import { fetchCommandCenterData, fetchAllClientsOverview, type CommandCenterData, type AllClientsOverview } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: "rgba(13,16,48,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label, value, sub, icon: Icon, color, trend
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
}) {
  return (
    <GlassCard className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1A` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", fontSize: 11, fontWeight: 500 }}
          >
            <ArrowUpRight size={10} />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
        <p style={{ color: "#8891B8", fontSize: 12, marginTop: 2 }}>{label}</p>
      </div>
      <p style={{ color: "#8891B8", fontSize: 11 }}>{sub}</p>
    </GlassCard>
  );
}

function RadialHealth({ score, label, color }: { score: number; label: string; color: string }) {
  const data = [{ name: label, value: score, fill: color }];
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: 90, height: 90, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.05)" }}
              dataKey="value"
              cornerRadius={4}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: "#E2E4F0", fontSize: 16, fontWeight: 700 }}
        >
          {score}
        </div>
      </div>
      <span style={{ color: "#8891B8", fontSize: 11, textAlign: "center" }}>{label}</span>
    </div>
  );
}

const priorityColor: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

/** Maps activity_log's free-text action_type to the Activity Feed's dot color — anything unrecognized falls back to the neutral accent rather than erroring. */
function activityDotColor(type: string): string {
  if (type === "approved") return "#10B981";
  if (type === "completed") return "#4C6EF5";
  if (type === "sprint") return "#7B5CF5";
  return "#F47B52";
}

function healthStandingLabel(score: number | null): string {
  if (score === null) return "Not yet scored";
  if (score >= 90) return "Excellent standing";
  if (score >= 75) return "Good standing";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

function formatMoneyK(amount: number): string {
  return amount >= 1000 ? `$${Math.round(amount / 1000)}K` : `$${Math.round(amount)}`;
}

function formatMilestoneDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const projectStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  completed: { label: "Completed", color: "#4C6EF5", bg: "rgba(76,110,245,0.12)" },
  planning: { label: "Planning", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

/** Admin's landing view when "All Clients" is selected — an aggregate roll-up plus a roster to drill into any one client. */
function AllClientsOverviewView({ onSelectOrganization }: { onSelectOrganization?: (organizationId: string) => void }) {
  const [overview, setOverview] = useState<AllClientsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAllClientsOverview()
      .then(result => { if (!cancelled) setOverview(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load clients overview."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading clients overview...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load clients overview</p>
        {error && <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>}
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div>
        <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Command Center</h1>
        <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>All clients overview for {todayLabel}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <MetricCard label="Total Clients" value={String(overview.totalClients)} sub="organizations onboarded" icon={Users} color="#7B5CF5" />
        <MetricCard label="Active Projects" value={String(overview.activeProjects)} sub={`${overview.completedProjects} completed`} icon={CheckCircle} color="#10B981" />
        <MetricCard label="Pending Approvals" value={String(overview.totalPendingApprovals)} sub="across all clients" icon={Clock} color="#F59E0B" />
        <MetricCard label="Open Support Tickets" value={String(overview.totalOpenTickets)} sub="across all clients" icon={AlertTriangle} color="#EF4444" />
        <MetricCard label="Avg Health Score" value={overview.clients.some(c => c.healthScore !== null) ? `${Math.round(overview.clients.filter(c => c.healthScore !== null).reduce((sum, c) => sum + (c.healthScore ?? 0), 0) / overview.clients.filter(c => c.healthScore !== null).length)}%` : "—"} sub="across scored projects" icon={TrendingUp} color="#4C6EF5" />
      </div>

      <GlassCard className="p-5">
        <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clients</p>
        {overview.clients.length === 0 && <p style={{ color: "#8891B8", fontSize: 13 }}>No clients yet.</p>}
        <div className="flex flex-col gap-2">
          {overview.clients.map(client => {
            const status = client.projectStatus ? projectStatusConfig[client.projectStatus] : null;
            return (
              <button
                key={client.organizationId}
                onClick={() => onSelectOrganization?.(client.organizationId)}
                className="flex items-center gap-4 rounded-lg p-4 text-left transition-all w-full"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(123,92,245,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>{client.organizationName}</p>
                  <p style={{ color: "#8891B8", fontSize: 12, marginTop: 2 }}>{client.projectName ?? "No project yet"}</p>
                </div>
                {status && (
                  <span className="rounded-full px-2 py-0.5 flex-shrink-0" style={{ background: status.bg, color: status.color, fontSize: 10, fontWeight: 600 }}>
                    {status.label}
                  </span>
                )}
                <div className="text-center flex-shrink-0" style={{ width: 70 }}>
                  <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 700 }}>{client.healthScore ?? "—"}</p>
                  <p style={{ color: "#8891B8", fontSize: 10 }}>Health</p>
                </div>
                <div className="text-center flex-shrink-0" style={{ width: 90 }}>
                  <p style={{ color: client.pendingApprovals > 0 ? "#F59E0B" : "#E2E4F0", fontSize: 13, fontWeight: 700 }}>{client.pendingApprovals}</p>
                  <p style={{ color: "#8891B8", fontSize: 10 }}>Approvals</p>
                </div>
                <div className="text-center flex-shrink-0" style={{ width: 70 }}>
                  <p style={{ color: client.openTickets > 0 ? "#EF4444" : "#E2E4F0", fontSize: 13, fontWeight: 700 }}>{client.openTickets}</p>
                  <p style={{ color: "#8891B8", fontSize: 10 }}>Tickets</p>
                </div>
                <ArrowRight size={14} color="#8891B8" style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

export function CommandCenter({
  organizationId, personName, onSelectOrganization, showFinancials = true,
}: {
  organizationId?: string;
  personName?: string;
  onSelectOrganization?: (organizationId: string) => void;
  showFinancials?: boolean;
}) {
  const [aiExpanded, setAiExpanded] = useState(true);
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCommandCenterData(organizationId)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) {
    return <AllClientsOverviewView onSelectOrganization={onSelectOrganization} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#EF4444", fontSize: 14, fontWeight: 600 }}>Couldn't load your dashboard</p>
        <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { projects, primaryProject, actionItems, milestones, activity, aiSummary, support } = data;
  const activeProjectsCount = projects.filter(p => p.status === "active").length;
  const completedProjectsCount = projects.filter(p => p.status === "completed").length;
  const urgentActionCount = actionItems.filter(t => t.priority === "high").length;
  const nextMilestone = milestones.find(m => m.status === "upcoming") ?? null;
  const budgetTotal = primaryProject?.budgetTotal ?? null;
  const budgetUsed = primaryProject?.budgetUsed ?? 0;
  const budgetUsedPct = budgetTotal ? Math.round((budgetUsed / budgetTotal) * 100) : null;
  const overallHealth = primaryProject?.healthScore ?? null;
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto" style={{ background: "transparent" }}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Command Center</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>
            {personName ? `Welcome back, ${personName.split(" ")[0]}.` : "Welcome back."} Here's your project overview for {todayLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981", fontSize: 12 }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: "pulse 2s infinite" }} />
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-4 xl:grid-cols-6">
        <MetricCard
          label="Project Health"
          value={overallHealth !== null ? `${overallHealth}%` : "—"}
          sub={healthStandingLabel(overallHealth)}
          icon={TrendingUp} color="#10B981"
        />
        <MetricCard
          label="Active Projects"
          value={String(activeProjectsCount)}
          sub={`${completedProjectsCount} completed`}
          icon={CheckCircle} color="#7B5CF5"
        />
        <MetricCard
          label="Awaiting Approval"
          value={String(actionItems.length)}
          sub={urgentActionCount > 0 ? `${urgentActionCount} urgent` : "None urgent"}
          icon={Clock} color="#F59E0B"
        />
        <MetricCard
          label="Support Requests"
          value={String(support.openCount)}
          sub={support.nearestSlaDueAt ? `SLA due ${new Date(support.nearestSlaDueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "No open tickets"}
          icon={AlertTriangle} color="#EF4444"
        />
        {showFinancials && (
          <MetricCard
            label="Budget Used"
            value={budgetUsedPct !== null ? `${budgetUsedPct}%` : "—"}
            sub={budgetTotal ? `${formatMoneyK(budgetUsed)} of ${formatMoneyK(budgetTotal)}` : "No budget set"}
            icon={DollarSign} color="#4C6EF5"
          />
        )}
        <MetricCard
          label="Next Milestone"
          value={formatMilestoneDate(nextMilestone?.targetDate ?? null)}
          sub={nextMilestone?.label ?? "None scheduled"}
          icon={Flag} color="#F47B52"
        />
      </div>

      {/* AI Executive Summary */}
      <GlassCard
        style={{
          background: "linear-gradient(135deg, rgba(123,92,245,0.15) 0%, rgba(76,110,245,0.1) 50%, rgba(6,182,212,0.08) 100%)",
          border: "1px solid rgba(123,92,245,0.25)",
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}
              >
                <Sparkles size={18} color="#fff" />
              </div>
              <div>
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>AI Executive Summary</p>
                <p style={{ color: "#8891B8", fontSize: 11 }}>
                  {aiSummary ? `Generated ${new Date(aiSummary.generatedAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}` : "No summary generated yet"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAiExpanded(!aiExpanded)}
              style={{ color: "#8891B8" }}
            >
              <ChevronRight size={16} style={{ transform: aiExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
            </button>
          </div>

          {aiExpanded && !aiSummary && (
            <p style={{ color: "#8891B8", fontSize: 13 }}>
              Your project manager hasn't generated a weekly summary yet — check back soon.
            </p>
          )}

          {aiExpanded && aiSummary && (
            <>
              <p style={{ color: "#C4C8E0", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                {aiSummary.summaryText}
              </p>
              <div className={showFinancials ? "grid grid-cols-5 gap-3" : "grid grid-cols-4 gap-3"}>
                {[
                  { label: "Delivery Confidence", value: aiSummary.deliveryConfidencePct !== null ? `${aiSummary.deliveryConfidencePct}%` : "—", color: "#10B981" },
                  { label: "Health Score", value: aiSummary.healthGrade ?? "—", color: "#7B5CF5" },
                  { label: "Est. Launch", value: formatMilestoneDate(aiSummary.estimatedLaunchDate), color: "#4C6EF5" },
                  ...(showFinancials ? [{ label: "Budget Status", value: aiSummary.budgetStatus ?? "—", color: "#10B981" }] : []),
                  { label: "Risk Level", value: aiSummary.riskLevel ?? "—", color: "#10B981" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <p style={{ color: item.color, fontSize: 16, fontWeight: 700 }}>{item.value}</p>
                    <p style={{ color: "#8891B8", fontSize: 10, marginTop: 3 }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </GlassCard>

      {/* Main grid: Health Center + Action Center */}
      <div className="grid grid-cols-3 gap-4">
        {/* Project Health Center */}
        <GlassCard className="col-span-1 p-5">
          <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Project Health</p>
          {primaryProject ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <RadialHealth score={primaryProject.healthTimeline ?? 0} label="Timeline" color="#7B5CF5" />
                <RadialHealth score={primaryProject.healthBudget ?? 0} label="Budget" color="#4C6EF5" />
                <RadialHealth score={primaryProject.healthQuality ?? 0} label="Quality" color="#10B981" />
                <RadialHealth score={primaryProject.healthCommunication ?? 0} label="Comms" color="#06B6D4" />
                <RadialHealth score={primaryProject.healthRisk ?? 0} label="Risk" color="#F59E0B" />
                <RadialHealth score={primaryProject.healthScore ?? 0} label="Overall" color="#10B981" />
              </div>
              <div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}
              >
                <span style={{ color: "#8891B8", fontSize: 12 }}>Overall Health Score</span>
                <span style={{ color: "#10B981", fontSize: 18, fontWeight: 700 }}>{primaryProject.healthScore ?? "—"} / 100</span>
              </div>
            </>
          ) : (
            <p style={{ color: "#8891B8", fontSize: 13 }}>No active project yet.</p>
          )}
        </GlassCard>

        {/* Client Action Center */}
        <GlassCard className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Client Action Center</p>
            <span
              className="rounded-full px-2 py-0.5"
              style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", fontSize: 11, fontWeight: 600 }}
            >
              {actionItems.length} pending
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {actionItems.length === 0 && (
              <p style={{ color: "#8891B8", fontSize: 13, padding: "8px 0" }}>No open action items — you're all caught up.</p>
            )}
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(123,92,245,0.08)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(123,92,245,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
                }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: priorityColor[item.priority] }}
                />
                <div className="flex-1">
                  <p style={{ color: "#E2E4F0", fontSize: 13 }}>{item.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      background: `${priorityColor[item.priority]}1A`,
                      color: priorityColor[item.priority],
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {item.priority}
                  </span>
                  <span style={{ color: "#8891B8", fontSize: 11 }}>{item.dueLabel}</span>
                  <button
                    className="rounded-md px-2 py-1 text-xs transition-colors"
                    style={{ background: "rgba(123,92,245,0.2)", color: "#C4B5FD" }}
                  >
                    Act
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Timeline + Activity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Project Timeline */}
        <GlassCard className="p-5">
          <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Project Roadmap</p>
          <div className="relative">
            {/* Track line */}
            <div
              className="absolute left-4 top-4 bottom-4"
              style={{ width: 2, background: "rgba(255,255,255,0.06)" }}
            />
            <div className="flex flex-col gap-5">
              {milestones.length === 0 && (
                <p style={{ color: "#8891B8", fontSize: 13 }}>No roadmap milestones set yet.</p>
              )}
              {milestones.map((step) => (
                <div key={step.id} className="flex items-center gap-4 relative">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0"
                    style={{
                      background: step.status === "done"
                        ? "linear-gradient(135deg, #10B981, #059669)"
                        : step.status === "active"
                        ? "linear-gradient(135deg, #7B5CF5, #4C6EF5)"
                        : "rgba(255,255,255,0.06)",
                      border: step.status === "upcoming" ? "1px solid rgba(255,255,255,0.1)" : "none",
                    }}
                  >
                    {step.status === "done" ? (
                      <CheckCircle size={14} color="#fff" />
                    ) : step.status === "active" ? (
                      <div className="w-2 h-2 rounded-full bg-white" style={{ animation: "pulse 1.5s infinite" }} />
                    ) : (
                      <Circle size={10} color="rgba(255,255,255,0.3)" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span
                      style={{
                        color: step.status === "upcoming" ? "#8891B8" : "#E2E4F0",
                        fontSize: 13,
                        fontWeight: step.status === "active" ? 600 : 400,
                      }}
                    >
                      {step.label}
                    </span>
                    {step.status === "done" && (
                      <span style={{ color: "#10B981", fontSize: 11 }}>Completed</span>
                    )}
                    {step.status === "active" && (
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ background: "rgba(123,92,245,0.15)", color: "#C4B5FD", fontSize: 10 }}
                      >
                        In Progress
                      </span>
                    )}
                    {step.status === "upcoming" && (
                      <span style={{ color: "#8891B8", fontSize: 11 }}>Upcoming</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Activity Feed */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Activity Feed</p>
            <button style={{ color: "#7B5CF5", fontSize: 12 }}>View all</button>
          </div>
          <div className="flex flex-col gap-1">
            {activity.length === 0 && (
              <p style={{ color: "#8891B8", fontSize: 13, padding: "8px 0" }}>No activity yet.</p>
            )}
            {activity.map((item, i) => (
              <div key={item.id} className="flex gap-3 py-3" style={{ borderBottom: i < activity.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div className="flex flex-col items-center pt-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activityDotColor(item.type) }} />
                  {i < activity.length - 1 && (
                    <div className="flex-1 w-px mt-1" style={{ background: "rgba(255,255,255,0.05)", minHeight: 20 }} />
                  )}
                </div>
                <div className="flex-1">
                  <p style={{ color: "#E2E4F0", fontSize: 12, lineHeight: 1.5 }}>{item.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ color: "#8891B8", fontSize: 11 }}>{item.timeLabel}</span>
                    <span style={{ color: "#8891B8", fontSize: 11 }}>·</span>
                    <span style={{ color: "#8891B8", fontSize: 11 }}>{item.user}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
