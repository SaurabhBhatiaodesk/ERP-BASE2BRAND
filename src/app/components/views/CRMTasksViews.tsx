import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Plus, Filter, Building2, Clock, MoreHorizontal, Layers, CheckSquare,
  Calendar, GitBranch, Users, Save, X, Timer, Search
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Avatar, Badge } from "../ui";
import { TaskStagePills } from "../TaskStagePills";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useEmployeeProfiles, useLeads, useProjectTasks, useProjects } from "@/hooks/useSupabaseData";
import {
  addProjectTask,
  clockRangeForDate,
  clockSessionsToAttendanceWindows,
  createLead,
  fetchEmployeeHistoricalSessions,
  fetchTeamClockSessionsByDate,
  findProfileForUser,
  filterTasksForUser,
  getEmployeeProjects,
  isPersonalTaskRole,
  updateProjectTask,
  updateProjectTaskStatus,
  taskDateToDateInput,
  resolveTaskDate,
  type AppTask,
  type AttendanceTimeWindow,
  type EmployeeProfile,
} from "@/lib/database";
import {
  isValidEmail,
  isValidName,
  isValidPhone,
  isPositiveNumber,
} from "@/lib/validation";
import { getSprintSummary, formatTaskManagementSubtitle } from "@/lib/sprint";
import {
  applyOptimisticTaskStatusMove,
  computeTaskStageTotals,
  effectiveStatusEnteredAt,
  formatStageDuration,
  formatStageEnteredAt,
  getVisibleStageEntries,
  shortStageLabel,
  taskWorkStageSeconds,
} from "@/lib/taskStageTime";

const inputCls = "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5";

function formatIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function parseDueToIso(due: string) {
  if (!due || due === "—") return formatIso();
  const withYear = new Date(`${due} ${new Date().getFullYear()}`);
  if (!Number.isNaN(withYear.getTime())) return withYear.toISOString().slice(0, 10);
  const parsed = new Date(due);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return formatIso();
}

function parseEstHours(est: string) {
  const num = parseInt(est.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(num) ? "4" : String(num);
}

function resolveTaskAssigneeId(
  task: AppTask,
  assigneeIdOverride?: string | null,
  profiles?: EmployeeProfile[],
) {
  if (task.assigneeId?.trim()) return task.assigneeId.trim();
  if (assigneeIdOverride?.trim()) return assigneeIdOverride.trim();
  if (profiles && task.assignee) {
    const exact = profiles.filter(
      p => p.name.trim().toLowerCase() === task.assignee.trim().toLowerCase()
    );
    if (exact.length === 1) return exact[0].id.trim();
  }
  return null;
}

function taskMatchesAssignee(task: AppTask, assigneeId?: string, assigneeName?: string) {
  if (assigneeId?.trim()) return task.assigneeId?.trim() === assigneeId.trim();
  if (!assigneeName?.trim()) return false;
  return task.assignee.trim().toLowerCase() === assigneeName.trim().toLowerCase();
}

function taskStageTotalsForKanban(
  task: AppTask,
  targetDate: string,
  attendanceWindows: AttendanceTimeWindow[],
  assigneeIdOverride?: string | null,
  profiles?: EmployeeProfile[],
) {
  const assigneeId = resolveTaskAssigneeId(task, assigneeIdOverride, profiles);
  return computeTaskStageTotals(task.stageHistory, task.status, effectiveStatusEnteredAt(task), {
    targetDate,
    assigneeId,
    attendanceSessions: attendanceWindows,
  });
}

function TaskStageBreakdown({
  task,
  compact = false,
  attendanceSessions,
  targetDate,
  assigneeIdOverride,
  profiles,
  stageTotals,
}: {
  task: AppTask;
  compact?: boolean;
  attendanceSessions?: AttendanceTimeWindow[];
  targetDate?: string;
  assigneeIdOverride?: string | null;
  profiles?: EmployeeProfile[];
  stageTotals?: Record<string, number>;
}) {
  const enteredAt = effectiveStatusEnteredAt(task);
  const assigneeId = resolveTaskAssigneeId(task, assigneeIdOverride, profiles);
  const todayIso = targetDate ?? new Date().toLocaleDateString("en-CA");
  const totals = stageTotals ?? taskStageTotalsForKanban(
    task,
    todayIso,
    attendanceSessions || [],
    assigneeIdOverride,
    profiles,
  );

  if (compact) {
    return (
      <div className="min-h-[14px] mb-2">
        <TaskStagePills
          status={task.status}
          history={task.stageHistory}
          statusEnteredAt={enteredAt}
          compact
          assigneeId={assigneeId}
          attendanceSessions={attendanceSessions}
          targetDate={todayIso}
          totals={totals}
        />
      </div>
    );
  }

  const rows = getVisibleStageEntries(task.status, totals, task.stageHistory);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Timer size={14} className="text-amber-400" />
        <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Stage Time Tracking</p>
      </div>
      <p className="text-[10px] text-[#a8b5d1] font-['Plus_Jakarta_Sans']">
        Time is saved automatically when the card moves between columns.
      </p>
      <div className="space-y-2">
        {rows.map(entry => (
          <div key={entry.status} className="flex items-center justify-between text-xs">
            <span className="text-[#a8b5d1] font-['Plus_Jakarta_Sans']">{entry.label}</span>
            <span className={`font-['Geist_Mono'] ${entry.isCurrent ? "text-amber-300" : "text-[#6b7fa8]"}`}>
              {formatStageDuration(entry.seconds)}
              {entry.isCurrent ? <><span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span></> : ""}
            </span>
          </div>
        ))}
      </div>
      <TaskStagePills
        status={task.status}
        history={task.stageHistory}
        statusEnteredAt={enteredAt}
        assigneeId={assigneeId}
        attendanceSessions={attendanceSessions}
        targetDate={todayIso}
        totals={totals}
      />
      {task.stageHistory.length > 0 && (
        <div className="pt-2 border-t border-amber-500/10 space-y-1.5 max-h-36 overflow-y-auto">
          {[...task.stageHistory].reverse().slice(0, 8).map(row => (
            <div key={row.id} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
              {shortStageLabel(row.to_status)}
              {row.exited_at
                ? ` · ${formatStageDuration(row.duration_seconds || 0)}`
                : " · current"}
              {" · "}
              {formatStageEnteredAt(row.entered_at)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TaskColumn = "todo" | "in-progress" | "ready-for-testing" | "review" | "done";

const KANBAN_TASK = "KANBAN_TASK";
const COL_LABELS: Record<TaskColumn, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  "ready-for-testing": "Ready for QA",
  review: "Review",
  done: "Done",
};
const COL_COLORS: Record<TaskColumn, string> = {
  todo: "text-slate-400",
  "in-progress": "text-indigo-400",
  "ready-for-testing": "text-violet-400",
  review: "text-amber-400",
  done: "text-emerald-400",
};

const KANBAN_GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/** CEO / Team Leader — full pipeline including Review */
const LEADERSHIP_KANBAN_COLUMNS: TaskColumn[] = [
  "todo",
  "in-progress",
  "ready-for-testing",
  "review",
  "done",
];
const EMPLOYEE_KANBAN_COLUMNS: TaskColumn[] = ["todo", "in-progress", "ready-for-testing"];

/** CEO / Team Leader — full board (all columns) */
function isKanbanLeadershipRole(role: string) {
  return role === "ceo" || role === "teamlead";
}

function getKanbanColumnsForRole(role: string): TaskColumn[] {
  if (isKanbanLeadershipRole(role)) return LEADERSHIP_KANBAN_COLUMNS;
  return EMPLOYEE_KANBAN_COLUMNS;
}

function getKanbanColumnLabel(col: TaskColumn) {
  return COL_LABELS[col];
}

function getTaskStatusOptionsForRole(role: string, currentStatus?: string) {
  const options = getKanbanColumnsForRole(role).map(value => ({
    value,
    label: getKanbanColumnLabel(value),
  }));
  if (currentStatus && !options.some(o => o.value === currentStatus)) {
    const col = currentStatus as TaskColumn;
    options.unshift({
      value: col,
      label: COL_LABELS[col] || currentStatus,
    });
  }
  return options;
}

export type TaskView = "kanban" | "list" | "calendar" | "timeline" | "workload";

type TaskFilters = {
  assignee: string;
  priority: string;
  status: string;
  projectId: string;
  search: string;
};

const emptyTaskFilters: TaskFilters = {
  assignee: "",
  priority: "",
  status: "",
  projectId: "",
  search: "",
};

const LEAD_STAGES = ["Awareness", "Qualification", "Discovery", "Proposal", "Negotiation", "Won"];

const emptyLeadForm = {
  company: "",
  contact: "",
  title: "",
  email: "",
  phone: "",
  industry: "",
  location: "",
  value: "",
  temp: "warm",
  stage: "Discovery",
  notes: "",
};

export function CRMView() {
  const { data: leads, loading, error, refresh } = useLeads();
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadDone, setLeadDone] = useState(false);

  const hotCount = leads.filter(l => l.temp === "hot").length;
  const warmCount = leads.filter(l => l.temp === "warm").length;
  const coldCount = leads.filter(l => l.temp === "cold").length;

  function validateLeadForm() {
    if (!isValidName(leadForm.company)) return "Enter company name.";
    if (!isValidName(leadForm.contact)) return "Enter contact person name.";
    if (!leadForm.email.trim()) return "Email is required.";
    if (!isValidEmail(leadForm.email)) return "Enter a valid email address.";
    if (leadForm.phone.trim() && !isValidPhone(leadForm.phone)) {
      return "Enter valid phone (10–15 digits).";
    }
    if (leadForm.value.trim() && !isPositiveNumber(leadForm.value)) {
      return "Deal value must be a positive number.";
    }
    return "";
  }

  async function handleAddLead() {
    const validationError = validateLeadForm();
    if (validationError) {
      setLeadError(validationError);
      return;
    }

    setLeadSaving(true);
    setLeadError("");
    try {
      await createLead(leadForm);
      refresh();
      setLeadDone(true);
      setTimeout(() => {
        setLeadDone(false);
        setShowLeadForm(false);
        setLeadForm(emptyLeadForm);
      }, 1500);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Failed to add lead");
    } finally {
      setLeadSaving(false);
    }
  }

  function openLeadForm() {
    setLeadForm(emptyLeadForm);
    setLeadError("");
    setLeadDone(false);
    setShowLeadForm(true);
  }

  if (loading) return <DataLoading label="Loading leads from Supabase..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">CRM Pipeline</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">{leads.length} active leads <span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span> from Supabase</p>
        </div>
        <button
          onClick={openLeadForm}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs transition-colors"
        >
          <Plus size={13} /> Add Lead
        </button>
      </div>

      {showLeadForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !leadSaving && setShowLeadForm(false)}>
          <div
            className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {leadDone ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-400 text-xl">✓</span>
                </div>
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Lead added successfully!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center">
                      <Building2 size={16} className="text-indigo-400" />
                    </div>
                    <p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Add New Lead</p>
                  </div>
                  <button
                    onClick={() => setShowLeadForm(false)}
                    disabled={leadSaving}
                    className="p-1.5 hover:bg-white/[0.05] rounded-lg text-[#6b7fa8] hover:text-white transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Company Name *</label>
                      <input
                        value={leadForm.company}
                        onChange={e => setLeadForm({ ...leadForm, company: e.target.value })}
                        placeholder="e.g. TechCorp Solutions"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Contact Person *</label>
                      <input
                        value={leadForm.contact}
                        onChange={e => setLeadForm({ ...leadForm, contact: e.target.value })}
                        placeholder="Contact name"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email *</label>
                      <input
                        type="email"
                        value={leadForm.email}
                        onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="contact@company.com"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input
                        value={leadForm.phone}
                        onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+91 98001 12345"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Deal Value (₹)</label>
                      <input
                        type="number"
                        min="1"
                        value={leadForm.value}
                        onChange={e => setLeadForm({ ...leadForm, value: e.target.value })}
                        placeholder="e.g. 1200000"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Stage</label>
                      <select
                        value={leadForm.stage}
                        onChange={e => setLeadForm({ ...leadForm, stage: e.target.value })}
                        className={inputCls}
                      >
                        {LEAD_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Temperature</label>
                      <select
                        value={leadForm.temp}
                        onChange={e => setLeadForm({ ...leadForm, temp: e.target.value })}
                        className={inputCls}
                      >
                        <option value="hot">Hot</option>
                        <option value="warm">Warm</option>
                        <option value="cold">Cold</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Industry</label>
                      <select
                        value={leadForm.industry}
                        onChange={e => setLeadForm({ ...leadForm, industry: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">Select industry</option>
                        {["SaaS", "Fintech", "E-commerce", "Healthcare", "Education", "Manufacturing", "Retail", "Other"].map(i => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={leadForm.notes}
                      onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                      rows={3}
                      placeholder="Requirements, context, next steps..."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>

                {leadError && (
                  <p className="mt-4 text-xs text-red-400 font-['Plus_Jakarta_Sans']">{leadError}</p>
                )}

                <button
                  onClick={handleAddLead}
                  disabled={leadSaving}
                  className="w-full mt-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans']"
                >
                  {leadSaving ? "Saving..." : "Add Lead"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { stage: "Aware", count: 24 },
              { stage: "Qualify", count: 18 },
              { stage: "Discover", count: 14 },
              { stage: "Proposal", count: 9 },
              { stage: "Negotiate", count: 5 },
              { stage: "Won", count: 3 },
            ]} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
              <XAxis dataKey="stage" tick={{ fill: "#6b7fa8", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 10, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11, color: "#e2e8f7" }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {[
            { label: "Hot Leads", value: hotCount, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Warm Leads", value: warmCount, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Cold Leads", value: coldCount, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Total Leads", value: leads.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-[rgba(99,102,241,0.1)] rounded-xl p-4`}>
              <div className={`text-2xl font-bold ${s.color} font-['Plus_Jakarta_Sans']`}>{s.value}</div>
              <div className="text-xs text-[#6b7fa8] font-['Geist_Mono'] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(99,102,241,0.1)]">
          <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Active Leads</h3>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-[#a8b5d1] text-xs hover:border-indigo-500/30 transition-colors">
              <Filter size={11} /> Filter
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(99,102,241,0.08)]">
              {["Company", "Deal Value", "Stage", "Temperature", "Contact", "Days in Stage"].map(h => (
                <th key={h} className="text-left text-[10px] font-['Geist_Mono'] text-[#6b7fa8] px-5 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr><td colSpan={6}><DataEmpty message="No leads in database yet." /></td></tr>
            ) : leads.map((lead) => (
              <tr key={lead.id ?? lead.name} className="border-b border-[rgba(99,102,241,0.06)] hover:bg-white/[0.02] transition-colors cursor-pointer">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
                      <Building2 size={12} className="text-indigo-400" />
                    </div>
                    <span className="text-sm text-white font-semibold font-['Plus_Jakarta_Sans']">{lead.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-sm font-['Geist_Mono'] text-emerald-400 font-semibold">{lead.value}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">{lead.stage}</span>
                </td>
                <td className="px-5 py-3.5"><Badge label={lead.temp} variant={lead.temp as "hot" | "warm" | "cold"} /></td>
                <td className="px-5 py-3.5 text-xs text-[#a8b5d1]">{lead.contact}</td>
                <td className="px-5 py-3.5 text-xs font-['Geist_Mono'] text-[#6b7fa8]">{lead.days}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  onTaskClick,
  attendanceSessions,
  targetDate,
  assigneeIdOverride,
  profiles,
  liveTick,
}: {
  task: AppTask;
  onTaskClick?: (task: AppTask) => void;
  attendanceSessions?: AttendanceTimeWindow[];
  targetDate: string;
  assigneeIdOverride?: string | null;
  profiles?: EmployeeProfile[];
  liveTick?: number;
}) {
  const stageTotals = useMemo(
    () => taskStageTotalsForKanban(task, targetDate, attendanceSessions || [], assigneeIdOverride, profiles),
    [task, targetDate, attendanceSessions, assigneeIdOverride, profiles, liveTick],
  );
  const trackedSeconds = taskWorkStageSeconds(stageTotals);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: KANBAN_TASK,
      item: { taskId: task.taskId },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [task.taskId]
  );

  return (
    <div
      ref={node => { drag(node); }}
      onClick={() => !isDragging && onTaskClick?.(task)}
      className={`bg-[#0d1326] border border-[rgba(99,102,241,0.1)] rounded-lg p-3.5 hover:border-indigo-500/30 transition-[border-color,box-shadow] cursor-grab active:cursor-grabbing group ${
        isDragging ? "opacity-50 border-indigo-500/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge label={task.priority} variant={task.priority as "urgent" | "high" | "medium" | "low"} />
        <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <MoreHorizontal size={13} className="text-[#6b7fa8]" />
        </button>
      </div>
      <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] leading-snug mb-2">{task.title}</p>
      {task.workNotes && (
        <p className="text-[10px] text-[#a8b5d1] font-['Plus_Jakarta_Sans'] leading-snug mb-2 line-clamp-2">
          {task.workNotes}
        </p>
      )}
      <p className="text-[10px] text-indigo-400 font-['Geist_Mono'] mb-2">{task.project}</p>
      {trackedSeconds > 0 && (
        <p className="text-[10px] text-emerald-400 font-['Geist_Mono'] mb-2">
          {formatStageDuration(trackedSeconds)} worked
        </p>
      )}
      <TaskStageBreakdown
        task={task}
        compact
        attendanceSessions={attendanceSessions}
        targetDate={targetDate}
        assigneeIdOverride={assigneeIdOverride}
        profiles={profiles}
        stageTotals={stageTotals}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar initials={task.assignee.split(" ").map(n => n[0]).join("")} size="sm" />
          <span className="text-[10px] text-[#6b7fa8] truncate max-w-[80px]">{task.assignee.split(" ")[0]}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
          <Clock size={9} />{task.due}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  label,
  tasks,
  onAddCard,
  onMoveTask,
  onTaskClick,
  getColId,
  attendanceSessions,
  targetDate,
  assigneeIdOverride,
  profiles,
  liveTick,
}: {
  col: any;
  label: string;
  tasks: AppTask[];
  onAddCard?: (col: any) => void;
  onMoveTask: (task: AppTask, col: any) => void;
  onTaskClick?: (task: AppTask) => void;
  getColId?: (t: AppTask) => string;
  attendanceSessions?: AttendanceTimeWindow[];
  targetDate: string;
  assigneeIdOverride?: string | null;
  profiles?: EmployeeProfile[];
  liveTick?: number;
}) {
  const getCol = getColId || ((t: AppTask) => t.status);
  const colTasks = tasks.filter(t => getCol(t) === col);

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: KANBAN_TASK,
      drop: (item: { taskId: string }) => {
        const dropped = tasks.find(t => t.taskId === item.taskId);
        if (dropped && getCol(dropped) !== col) onMoveTask(dropped, col);
      },
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [col, onMoveTask, tasks]
  );

  return (
    <div className="flex flex-col bg-[#080c1f] border border-[rgba(99,102,241,0.1)] rounded-xl overflow-hidden min-h-0">
      <div className="p-3.5 border-b border-[rgba(99,102,241,0.08)] flex items-center justify-between shrink-0">
        <span className={`text-xs font-semibold font-['Plus_Jakarta_Sans'] ${COL_COLORS[col as TaskColumn] || "text-[#a8b5d1]"}`}>{label}</span>
        <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] bg-[#131a35] px-1.5 py-0.5 rounded-md">{colTasks.length}</span>
      </div>
      <div
        ref={node => { drop(node); }}
        className={`flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-hide min-h-[120px] transition-colors ${
          isOver ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/30" : ""
        }`}
      >
        {colTasks.map(task => (
          <KanbanCard
            key={task.taskId}
            task={task}
            onTaskClick={onTaskClick}
            attendanceSessions={attendanceSessions}
            targetDate={targetDate}
            assigneeIdOverride={assigneeIdOverride}
            profiles={profiles}
            liveTick={liveTick}
          />
        ))}
        <button
          type="button"
          onClick={() => onAddCard?.(col)}
          className="w-full py-2 border border-dashed border-[rgba(99,102,241,0.15)] rounded-lg text-[10px] text-[#6b7fa8] hover:border-indigo-500/30 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={10} /> Add card
        </button>
      </div>
    </div>
  );
}

export function KanbanView({
  tasks,
  columns,
  getColumnLabel,
  onAddCard,
  onMoveTask,
  onTaskClick,
  getColId,
  attendanceSessions,
  targetDate,
  assigneeIdOverride,
  profiles,
  liveTick,
}: {
  tasks: AppTask[];
  columns: any[];
  getColumnLabel?: (col: any) => string;
  onAddCard?: (col: any) => void;
  onMoveTask: (task: AppTask, col: any) => void;
  onTaskClick?: (task: AppTask) => void;
  getColId?: (t: AppTask) => string;
  attendanceSessions?: AttendanceTimeWindow[];
  targetDate: string;
  assigneeIdOverride?: string | null;
  profiles?: EmployeeProfile[];
  liveTick?: number;
}) {
  const todayIso = targetDate;
  const labelFor = getColumnLabel ?? (col => COL_LABELS[col as TaskColumn] || col);
  const gridClass = KANBAN_GRID_COLS[columns.length] || "grid-cols-4";
  const wideBoard = columns.length >= 5;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={wideBoard ? "overflow-x-auto pb-2" : ""}>
      <div
        className={`grid ${gridClass} gap-4 h-[calc(100vh-280px)] overflow-hidden ${
          wideBoard ? "min-w-[1120px]" : ""
        }`}
      >
        {columns.map(col => (
          <KanbanColumn
            key={col}
            col={col}
            label={labelFor(col)}
            tasks={tasks}
            onAddCard={onAddCard}
            onMoveTask={onMoveTask}
            onTaskClick={onTaskClick}
            getColId={getColId}
            attendanceSessions={attendanceSessions}
            targetDate={todayIso}
            assigneeIdOverride={assigneeIdOverride}
            profiles={profiles}
            liveTick={liveTick}
          />
        ))}
      </div>
      </div>
    </DndProvider>
  );
}

export function ListView({
  tasks,
  onTaskClick,
}: {
  tasks: AppTask[];
  onTaskClick?: (task: AppTask) => void;
}) {
  const [sort, setSort] = useState<string>("due");
  const statusOrder: Record<string, number> = {
    todo: 0,
    "in-progress": 1,
    "ready-for-testing": 2,
    review: 3,
    done: 4,
  };
  const prioOrder: Record<string, number> = { "urgent": 0, "high": 1, "medium": 2, "low": 3 };
  const sorted = [...tasks].sort((a, b) => {
    if (sort === "due") return a.dueDay - b.dueDay;
    if (sort === "priority") return prioOrder[a.priority] - prioOrder[b.priority];
    if (sort === "status") return statusOrder[a.status] - statusOrder[b.status];
    return a.assignee.localeCompare(b.assignee);
  });
  const cols = ["Title", "Project", "Assignee", "Priority", "Status", "Due", "Est."];
  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[rgba(99,102,241,0.08)] bg-[#080c1f]">
            {cols.map(h => (
              <th key={h} onClick={() => setSort(h.toLowerCase())}
                className={`text-left text-[10px] font-['Geist_Mono'] px-4 py-3 uppercase tracking-wider cursor-pointer transition-colors select-none ${sort === h.toLowerCase() ? "text-indigo-400" : "text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>
                {h} {sort === h.toLowerCase() && "↑"}
              </th>
            ))}
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(task => (
            <tr
              key={task.taskId}
              onClick={() => onTaskClick?.(task)}
              className="border-b border-[rgba(99,102,241,0.06)] hover:bg-indigo-500/5 transition-colors cursor-pointer group"
            >
              <td className="px-4 py-3 max-w-[220px]">
                <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{task.title}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-[10px] font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">{task.project}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Avatar initials={task.assignee.split(" ").map(n => n[0]).join("")} size="sm" />
                  <span className="text-xs text-[#a8b5d1]">{task.assignee.split(" ")[0]}</span>
                </div>
              </td>
              <td className="px-4 py-3"><Badge label={task.priority} variant={task.priority as "urgent" | "high" | "medium" | "low"} /></td>
              <td className="px-4 py-3">
                <Badge
                  label={COL_LABELS[task.status as TaskColumn] || task.status}
                  variant={task.status as TaskColumn}
                />
              </td>
              <td className={`px-4 py-3 text-xs font-['Geist_Mono'] ${task.dueDay <= 23 && task.status !== "done" ? "text-red-400" : "text-[#6b7fa8]"}`}>{task.due}</td>
              <td className="px-4 py-3 text-xs font-['Geist_Mono'] text-[#6b7fa8]">{task.est}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onTaskClick?.(task);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/[0.05] rounded"
                >
                  <MoreHorizontal size={13} className="text-[#6b7fa8]" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarView({
  tasks,
  onTaskClick,
}: {
  tasks: AppTask[];
  onTaskClick?: (task: AppTask) => void;
}) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const startOffset = 3;
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const tasksByDay: Record<number, typeof tasks> = {};
  tasks.forEach(t => {
    if (!tasksByDay[t.dueDay]) tasksByDay[t.dueDay] = [];
    tasksByDay[t.dueDay].push(t);
  });
  const prioColor: Record<string, string> = {
    urgent: "bg-red-500/80", high: "bg-orange-500/80", medium: "bg-indigo-500/80", low: "bg-slate-500/80"
  };
  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[rgba(99,102,241,0.1)]">
        {weekDays.map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider border-r border-[rgba(99,102,241,0.06)] last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-28 border-r border-b border-[rgba(99,102,241,0.06)] bg-[#080c1f]/40" />
        ))}
        {days.map(day => {
          const dayTasks = tasksByDay[day] || [];
          const isToday = day === 23;
          return (
            <div key={day} className={`h-28 border-r border-b border-[rgba(99,102,241,0.06)] last:border-r-0 p-2 flex flex-col ${isToday ? "bg-indigo-500/5" : "hover:bg-white/[0.01]"} transition-colors`}>
              <span className={`text-xs font-['Geist_Mono'] mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-indigo-600 text-white font-bold" : "text-[#6b7fa8]"}`}>{day}</span>
              <div className="space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.taskId}
                    onClick={() => onTaskClick?.(t)}
                    className={`${prioColor[t.priority]} rounded px-1.5 py-0.5 text-[9px] text-white font-['Plus_Jakarta_Sans'] truncate cursor-pointer hover:opacity-90`}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[9px] font-['Geist_Mono'] text-[#6b7fa8] pl-1">+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineGanttView({
  tasks,
  onTaskClick,
}: {
  tasks: AppTask[];
  onTaskClick?: (task: AppTask) => void;
}) {
  const dayStart = 18;
  const dayCount = 14;
  const days = Array.from({ length: dayCount }, (_, i) => dayStart + i);
  const prioBar: Record<string, string> = {
    urgent: "bg-red-500", high: "bg-orange-500", medium: "bg-indigo-500", low: "bg-slate-500"
  };
  const assignees = Array.from(new Set(tasks.map(t => t.assignee)));

  const getBarRange = (task: AppTask) => {
    const due = task.dueDay > 0 ? task.dueDay : 23;
    const start = task.startDay > 0 ? task.startDay : Math.max(due - 2, dayStart);
    const barStart = Math.max(start - dayStart, 0);
    const barEnd = Math.min(Math.max(due - dayStart + 1, barStart + 1), dayCount);
    return { barStart, barWidth: Math.max(barEnd - barStart, 1) };
  };
  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
      <div className="flex border-b border-[rgba(99,102,241,0.1)] bg-[#080c1f]">
        <div className="w-52 shrink-0 px-5 py-3 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Task</div>
        <div className="flex-1 grid border-l border-[rgba(99,102,241,0.08)]" style={{ gridTemplateColumns: `repeat(${dayCount}, 1fr)` }}>
          {days.map(d => (
            <div key={d} className={`py-3 text-center text-[10px] font-['Geist_Mono'] border-r border-[rgba(99,102,241,0.06)] last:border-r-0 ${d === 23 ? "text-indigo-400 font-bold" : "text-[#6b7fa8]"}`}>
              {d}
            </div>
          ))}
        </div>
      </div>
      {assignees.map(assignee => {
        const assigneeTasks = tasks.filter(t => t.assignee === assignee);
        const initials = assignee.split(" ").map(n => n[0]).join("");
        return (
          <div key={assignee}>
            <div className="flex items-center gap-2 px-5 py-2 bg-[#0a1020] border-b border-[rgba(99,102,241,0.06)]">
              <Avatar initials={initials} size="sm" />
              <span className="text-xs font-semibold text-[#a8b5d1] font-['Plus_Jakarta_Sans']">{assignee}</span>
            </div>
            {assigneeTasks.map(task => {
              const { barStart, barWidth } = getBarRange(task);
              return (
                <div
                  key={task.taskId}
                  onClick={() => onTaskClick?.(task)}
                  className="flex items-center border-b border-[rgba(99,102,241,0.04)] hover:bg-indigo-500/5 transition-colors group cursor-pointer"
                >
                  <div className="w-52 shrink-0 px-5 py-2.5 flex items-center gap-2">
                    <Badge label={task.priority} variant={task.priority as "urgent" | "high" | "medium" | "low"} />
                    <span className="text-xs text-[#a8b5d1] group-hover:text-white truncate font-['Plus_Jakarta_Sans'] transition-colors">{task.title}</span>
                  </div>
                  <div className="flex-1 relative h-10 border-l border-[rgba(99,102,241,0.08)]"
                    style={{ display: "grid", gridTemplateColumns: `repeat(${dayCount}, 1fr)` }}>
                    {days.map(d => (
                      <div key={d} className={`border-r border-[rgba(99,102,241,0.04)] last:border-r-0 ${d === 23 ? "bg-indigo-500/5" : ""}`} />
                    ))}
                    <div
                      className={`absolute top-2 bottom-2 ${prioBar[task.priority]} rounded-md flex items-center px-2 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none`}
                      style={{
                        left: `${(barStart / dayCount) * 100}%`,
                        width: `${(barWidth / dayCount) * 100}%`,
                      }}
                      title={`${task.title} · Due ${task.due}`}
                    >
                      <span className="text-[9px] text-white font-['Geist_Mono'] truncate">{task.status === "done" ? "✓ " : ""}{task.title}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="px-5 py-2 flex items-center gap-2 border-t border-[rgba(99,102,241,0.08)]">
        <span className="w-2 h-2 bg-indigo-400 rounded-full" />
        <span className="text-[10px] font-['Geist_Mono'] text-indigo-400">Today — May 23</span>
      </div>
    </div>
  );
}

export function WorkloadView({
  tasks,
  onTaskClick,
  sprintSubtitle,
}: {
  tasks: AppTask[];
  onTaskClick?: (task: AppTask) => void;
  sprintSubtitle?: string;
}) {
  const assignees = Array.from(new Set(tasks.map(t => t.assignee)));
  const workloadData = assignees.map(a => {
    const myTasks = tasks.filter(t => t.assignee === a);
    return {
      name: a.split(" ")[0],
      fullName: a,
      initials: a.split(" ").map(n => n[0]).join(""),
      total: myTasks.length,
      urgent: myTasks.filter(t => t.priority === "urgent").length,
      high: myTasks.filter(t => t.priority === "high").length,
      medium: myTasks.filter(t => t.priority === "medium").length,
      low: myTasks.filter(t => t.priority === "low").length,
      done: myTasks.filter(t => t.status === "done").length,
      estHours: myTasks.reduce((sum, t) => sum + parseInt(t.est), 0),
      tasks: myTasks,
    };
  });

  return (
    <div className="space-y-4">
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">Estimated Hours per Person</h3>
        <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mb-5">{sprintSubtitle ?? <>Sprint <span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span> from Supabase</>}</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={workloadData.map(w => ({ name: w.name, hours: w.estHours, tasks: w.total }))} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
            <XAxis dataKey="name" tick={{ fill: "#a8b5d1", fontSize: 11, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7fa8", fontSize: 11, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11, color: "#e2e8f7" }}
              formatter={(v: number, name: string) => [name === "hours" ? `${v}h` : v, name === "hours" ? "Est. Hours" : "Tasks"]} />
            <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} name="hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {workloadData.map(w => {
          const overloaded = w.estHours > 18;
          return (
            <div key={w.fullName} className={`bg-[#0d1326] border rounded-xl p-4 ${overloaded ? "border-amber-500/25" : "border-[rgba(99,102,241,0.12)]"}`}>
              <div className="flex items-center gap-3 mb-4">
                <Avatar initials={w.initials} size="md" />
                <div>
                  <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{w.fullName}</p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{w.total} tasks · {w.estHours}h est.</p>
                </div>
                {overloaded && <span className="ml-auto text-[10px] font-['Geist_Mono'] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Overloaded</span>}
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mb-1">
                  <span>Workload</span>
                  <span className={overloaded ? "text-amber-400" : "text-indigo-400"}>{Math.round((w.estHours / 40) * 100)}% of 40h</span>
                </div>
                <div className="h-2 bg-[#131a35] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${overloaded ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"}`}
                    style={{ width: `${Math.min((w.estHours / 40) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  { label: "Urgent", count: w.urgent, color: "text-red-400 bg-red-500/10" },
                  { label: "High", count: w.high, color: "text-orange-400 bg-orange-500/10" },
                  { label: "Med", count: w.medium, color: "text-indigo-400 bg-indigo-500/10" },
                  { label: "Done", count: w.done, color: "text-emerald-400 bg-emerald-500/10" },
                ].map(p => (
                  <div key={p.label} className={`${p.color} rounded-lg py-1.5`}>
                    <div className={`text-sm font-bold font-['Plus_Jakarta_Sans'] ${p.color.split(" ")[0]}`}>{p.count}</div>
                    <div className="text-[9px] font-['Geist_Mono'] opacity-70">{p.label}</div>
                  </div>
                ))}
              </div>
              {w.tasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[rgba(99,102,241,0.08)] space-y-1">
                  {w.tasks.map(t => (
                    <button
                      key={t.taskId}
                      type="button"
                      onClick={() => onTaskClick?.(t)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] text-[#a8b5d1] hover:text-white hover:bg-indigo-500/10 transition-colors truncate font-['Plus_Jakarta_Sans']"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TasksView({
  userName = "",
  userEmail = "",
  userRole = "",
  initialTaskId,
  initialStatus,
  initialProjectId,
  fixedProjectId,
  embedded = false,
  onNavConsumed,
}: {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  initialTaskId?: string;
  initialStatus?: TaskColumn;
  initialProjectId?: string;
  fixedProjectId?: string;
  embedded?: boolean;
  onNavConsumed?: () => void;
}) {
  const { data: tasks, loading, error, refresh } = useProjectTasks();
  const { data: projects } = useProjects();
  const { data: profiles } = useEmployeeProfiles();
  const targetDate = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const [clockSessions, setClockSessions] = useState<Awaited<ReturnType<typeof fetchTeamClockSessionsByDate>>>([]);
  const [view, setView] = useState<TaskView>("kanban");
  const [kanbanGrouping, setKanbanGrouping] = useState<"status" | "assignee">("status");
  const [dragTasks, setDragTasks] = useState<AppTask[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<AppTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    title: "",
    projectId: "",
    assignee: "",
    assigneeId: "",
    status: "todo" as TaskColumn,
    priority: "medium",
    due: formatIso(),
    taskDate: formatIso(),
    est: "4",
    workNotes: "",
  });
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters);
  const filterRef = useRef<HTMLDivElement>(null);
  const [liveTick, setLiveTick] = useState(0);

  const personalView = isPersonalTaskRole(userRole);
  const currentProfile = useMemo(
    () => findProfileForUser(profiles, userName, userEmail),
    [profiles, userName, userEmail]
  );

  const refreshClockSessions = useCallback(async () => {
    try {
      const { start, end } = clockRangeForDate(targetDate);
      if (personalView && currentProfile?.id) {
        const rows = await fetchEmployeeHistoricalSessions(currentProfile.id, start, end);
        setClockSessions(rows);
        return;
      }
      const rows = await fetchTeamClockSessionsByDate(targetDate);
      setClockSessions(rows);
    } catch {
      /* keep last known sessions */
    }
  }, [targetDate, personalView, currentProfile?.id]);

  useEffect(() => {
    void refreshClockSessions();
    const refreshId = window.setInterval(() => void refreshClockSessions(), 30_000);
    const tickId = window.setInterval(() => setLiveTick(t => t + 1), 15_000);
    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(tickId);
    };
  }, [refreshClockSessions]);

  const attendanceWindows = useMemo(
    () => clockSessionsToAttendanceWindows(clockSessions),
    [clockSessions],
  );

  const kanbanColumns = useMemo(() => getKanbanColumnsForRole(userRole), [userRole]);
  const getKanbanLabel = useCallback(
    (col: TaskColumn) => getKanbanColumnLabel(col),
    []
  );

  const availableProjects = useMemo(() => {
    if (isKanbanLeadershipRole(userRole)) return projects;
    if (!userName) return projects;
    if (personalView) return getEmployeeProjects(projects, userName, currentProfile?.id);
    return projects;
  }, [projects, userName, personalView, userRole, currentProfile?.id]);

  const assignees = useMemo(
    () => profiles.filter(p => p.dept !== "Executive" && p.name !== "CEO Admin"),
    [profiles]
  );

  const scopedTasks = useMemo(() => {
    if (!personalView || !userName) return tasks;
    return filterTasksForUser(tasks, userName, currentProfile?.id);
  }, [tasks, userName, personalView, currentProfile?.id]);

  const displayTasks = dragTasks ?? scopedTasks;

  const taskAssignees = useMemo(
    () => [...new Set(scopedTasks.map(t => t.assignee).filter(Boolean))].sort(),
    [scopedTasks]
  );

  const taskProjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    scopedTasks.forEach(t => {
      if (t.projectId) seen.set(t.projectId, t.project);
    });
    return Array.from(seen.entries());
  }, [scopedTasks]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v.trim() !== "").length;
  }, [filters]);

  const filteredTasks = useMemo(() => {
    let result = displayTasks;
    if (fixedProjectId) result = result.filter(t => t.projectId === fixedProjectId);
    if (filters.assignee) result = result.filter(t => t.assignee === filters.assignee);
    if (filters.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters.status) result = result.filter(t => t.status === filters.status);
    if (!fixedProjectId && filters.projectId) {
      result = result.filter(t => t.projectId === filters.projectId);
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const isExactAssigneeName = taskAssignees.some(a => a.toLowerCase() === q || a.toLowerCase().split(' ')[0] === q);
      
      if (isExactAssigneeName) {
        result = result.filter(t => t.assignee.toLowerCase().includes(q));
      } else {
        result = result.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q) ||
          t.project.toLowerCase().includes(q)
        );
      }
    }
    return result;
  }, [displayTasks, filters, fixedProjectId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter]);

  useEffect(() => {
    if (!dragTasks) return;
    const stillPending = dragTasks.some(dt => {
      const server = scopedTasks.find(s => s.taskId === dt.taskId);
      return !server || server.status !== dt.status;
    });
    if (!stillPending) setDragTasks(null);
  }, [scopedTasks, dragTasks]);

  const handleMoveTask = useCallback(async (task: AppTask, newCol: any) => {
    if (kanbanGrouping === "assignee") {
      const newAssignee = newCol;
      if (task.assignee === newAssignee) return;
      const p = assignees.find(a => a.name === newAssignee);
      if (!p) return;

      setDragTasks(prev => {
        const base = prev ?? scopedTasks;
        return base.map(t => (t.taskId === task.taskId ? { ...t, assignee: newAssignee, assigneeId: p.id } : t));
      });
      try {
        await updateProjectTaskStatus({
          projectId: task.projectId,
          taskId: task.taskId,
          title: task.title,
          assignee: newAssignee,
          assigneeId: p.id,
          movedById: currentProfile?.id,
        } as any);
        refresh();
      } catch {
        setDragTasks(null);
      }
      return;
    }

    const newStatus = newCol as TaskColumn;
    if (task.status === newStatus) return;
    if (!kanbanColumns.includes(newStatus)) return;

    if (newStatus === "in-progress") {
      const taskAssigneeId = resolveTaskAssigneeId(task, currentProfile?.id, profiles);
      const isAnotherInProgress = tasks.some(
        t =>
          t.status === "in-progress" &&
          t.taskId !== task.taskId &&
          taskMatchesAssignee(t, taskAssigneeId || undefined, task.assignee)
      ) || (dragTasks || []).some(
        t =>
          t.status === "in-progress" &&
          t.taskId !== task.taskId &&
          taskMatchesAssignee(t, taskAssigneeId || undefined, task.assignee)
      );
      if (isAnotherInProgress) {
        alert(`${task.assignee || "This user"} already has a task In Progress. Please complete it first.`);
        return;
      }
    }

    setDragTasks(prev => {
      const base = prev ?? scopedTasks;
      return base.map(t =>
        t.taskId === task.taskId ? applyOptimisticTaskStatusMove(t, newStatus, currentProfile?.id) : t
      );
    });
    try {
      await updateProjectTaskStatus({
        projectId: task.projectId,
        taskId: task.taskId,
        title: task.title,
        status: newStatus,
        movedById: currentProfile?.id,
      });
      refresh();
    } catch {
      setDragTasks(null);
    }
  }, [scopedTasks, dragTasks, refresh, kanbanColumns, currentProfile?.id, kanbanGrouping, assignees, profiles, tasks]);

  const formStatusOptions = useMemo(
    () => getTaskStatusOptionsForRole(userRole, editingTask?.status),
    [userRole, editingTask?.status]
  );

  const openNewTask = (status: TaskColumn = kanbanColumns[0]) => {
    const defaultProject = fixedProjectId || availableProjects[0]?.id || "";
    const defaultProfile =
      assignees.find(p => p.id === currentProfile?.id) ||
      findProfileForUser(assignees, userName, userEmail) ||
      (personalView ? currentProfile : assignees[0]) ||
      currentProfile;
    setEditingTask(null);
    setForm({
      title: "",
      projectId: defaultProject,
      assignee: defaultProfile?.name || userName || "",
      assigneeId: defaultProfile?.id || currentProfile?.id || "",
      status,
      priority: "medium",
      due: formatIso(),
      est: "4",
      workNotes: "",
      taskDate: formatIso(),
    });
    setFormError("");
    setShowForm(true);
  };

  const openEditTask = useCallback((task: AppTask) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      projectId: task.projectId,
      assignee: task.assignee,
      assigneeId: task.assigneeId,
      status: task.status as TaskColumn,
      priority: task.priority,
      due: parseDueToIso(task.due),
      taskDate: taskDateToDateInput(resolveTaskDate(task)),
      est: parseEstHours(task.est),
      workNotes: task.workNotes || "",
    });
    setFormError("");
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (initialStatus) setView("kanban");
  }, [initialStatus]);

  useEffect(() => {
    if (!initialTaskId || loading) return;
    const task = scopedTasks.find(t => t.taskId === initialTaskId);
    if (task) {
      openEditTask(task);
      onNavConsumed?.();
    }
  }, [initialTaskId, scopedTasks, loading, openEditTask, onNavConsumed]);

  useEffect(() => {
    if (!initialProjectId) return;
    setFilters(f => ({ ...f, projectId: initialProjectId }));
    onNavConsumed?.();
  }, [initialProjectId, onNavConsumed]);

  useEffect(() => {
    if (!fixedProjectId) return;
    setFilters(f => ({ ...f, projectId: fixedProjectId }));
  }, [fixedProjectId]);

  const editingTaskLive = useMemo(() => {
    if (!editingTask) return null;
    return scopedTasks.find(t => t.taskId === editingTask.taskId) || editingTask;
  }, [editingTask, scopedTasks]);

  const sprintSummary = useMemo(
    () => getSprintSummary(scopedTasks, {
      userName: personalView ? userName : undefined,
      userId: personalView ? currentProfile?.id : undefined,
      projects,
    }),
    [scopedTasks, userName, currentProfile?.id, personalView, projects]
  );

  const taskSubtitle = useMemo(
    () => formatTaskManagementSubtitle(
      sprintSummary,
      filteredTasks.length,
      activeFilterCount > 0 ? scopedTasks.length : undefined
    ),
    [sprintSummary, filteredTasks.length, activeFilterCount, scopedTasks.length]
  );

  const workloadSprintSubtitle = useMemo(
    () => `${sprintSummary.label} · ${sprintSummary.rangeLabel}`,
    [sprintSummary]
  );

  const handleSaveTask = async () => {
    if (!form.title.trim()) {
      setFormError("Task title is required.");
      return;
    }
    if (!form.projectId) {
      setFormError("Please select a project.");
      return;
    }
    if (!form.assigneeId && !form.assignee) {
      setFormError("Please select an assignee.");
      return;
    }
    if (form.status === "done" && !form.workNotes.trim()) {
      setFormError("Please write what work you did (Work Description).");
      return;
    }
    if (form.status === "done" && (!form.est || Number(form.est) <= 0)) {
      setFormError("Please enter hours worked.");
      return;
    }

    if (form.status === "in-progress") {
      const isAnotherInProgress = tasks.some(
        t =>
          t.status === "in-progress" &&
          t.taskId !== editingTask?.taskId &&
          taskMatchesAssignee(t, form.assigneeId, form.assignee)
      );
      if (isAnotherInProgress) {
        setFormError(`${form.assignee || "This user"} already has a task In Progress. Please complete it first.`);
        return;
      }
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingTask) {
        await updateProjectTask({
          projectId: editingTask.projectId,
          taskId: editingTask.taskId,
          originalTitle: editingTask.title,
          title: form.title,
          assignee: form.assignee,
          assigneeId: form.assigneeId,
          status: form.status,
          priority: form.priority,
          due: form.due,
          taskDate: form.taskDate,
          est: form.est,
          workNotes: form.workNotes,
          movedById: currentProfile?.id,
        });
      } else {
        await addProjectTask({
          projectId: form.projectId,
          title: form.title,
          assignee: form.assignee,
          assigneeId: form.assigneeId,
          status: form.status,
          priority: form.priority,
          due: form.due,
          taskDate: form.taskDate,
          est: form.est,
          workNotes: form.workNotes,
        });
      }
      refresh();
      setShowForm(false);
      setEditingTask(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DataLoading label="Loading tasks from projects..." />;
  if (error) return <DataError message={error} />;

  const viewOptions: { id: TaskView; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: "kanban",   label: "Kanban",   icon: Layers },
    { id: "list",     label: "List",     icon: CheckSquare },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "timeline", label: "Timeline", icon: GitBranch },
    { id: "workload", label: "Workload", icon: Users },
  ];

  const showFilterEmpty = filteredTasks.length === 0 && activeFilterCount > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Task Management</h1>
            <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">
              {taskSubtitle} <span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span> from Supabase
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#6b7fa8] font-['Geist_Mono']">
            {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in this project
          </p>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" size={14} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#6b7fa8] focus:outline-none focus:border-indigo-500/50 w-48 transition-colors"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 bg-[#131a35] border rounded-lg text-xs transition-colors ${
                activeFilterCount > 0
                  ? "border-indigo-500/40 text-indigo-300"
                  : "border-[rgba(99,102,241,0.15)] text-[#a8b5d1] hover:border-indigo-500/30"
              }`}
            >
              <Filter size={12} /> Filter
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-['Geist_Mono'] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Filter Tasks</p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilters(emptyTaskFilters)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-['Plus_Jakarta_Sans']"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Search</label>
                  <input
                    value={filters.search}
                    onChange={e => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Title, assignee, project..."
                    className={inputCls}
                  />
                </div>
                {!personalView && (
                  <div>
                    <label className={labelCls}>Assignee</label>
                    <select
                      value={filters.assignee}
                      onChange={e => setFilters({ ...filters, assignee: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">All assignees</option>
                      {taskAssignees.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={filters.priority}
                    onChange={e => setFilters({ ...filters, priority: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">All priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">All statuses</option>
                    {getTaskStatusOptionsForRole(userRole).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {!fixedProjectId && (
                  <div>
                    <label className={labelCls}>Project</label>
                    <select
                      value={filters.projectId}
                      onChange={e => setFilters({ ...filters, projectId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">All projects</option>
                      {taskProjectOptions.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => openNewTask(kanbanColumns[0])}
            className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors ${
              embedded ? "px-4 py-2 text-sm" : "px-3 py-2 text-xs"
            }`}
          >
            <Plus size={embedded ? 15 : 13} /> Add Task
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#080c1f] border border-[rgba(99,102,241,0.1)] rounded-xl p-1 w-fit">
          {viewOptions.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-['Plus_Jakarta_Sans'] transition-all ${view === v.id ? "bg-indigo-600 text-white shadow-sm" : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"}`}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>

        {view === "kanban" && !personalView && (userRole === "manager" || userRole === "teamlead" || userRole === "admin") && (
          <div className="flex items-center gap-1 bg-[#080c1f] border border-[rgba(99,102,241,0.1)] rounded-xl p-1">
            <span className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] px-2 uppercase tracking-wider">Group By</span>
            <button onClick={() => setKanbanGrouping("status")} className={`px-3 py-1.5 rounded-lg text-[11px] font-['Plus_Jakarta_Sans'] font-semibold transition-all ${kanbanGrouping === "status" ? "bg-indigo-600/20 text-indigo-300" : "text-[#6b7fa8] hover:text-white"}`}>Status</button>
            <button onClick={() => setKanbanGrouping("assignee")} className={`px-3 py-1.5 rounded-lg text-[11px] font-['Plus_Jakarta_Sans'] font-semibold transition-all ${kanbanGrouping === "assignee" ? "bg-indigo-600/20 text-indigo-300" : "text-[#6b7fa8] hover:text-white"}`}>Employee</button>
          </div>
        )}
      </div>

      {view === "kanban"   && (
        showFilterEmpty
          ? <DataEmpty message="No tasks match your filters." />
          : kanbanGrouping === "assignee" ? (
            <KanbanView
              tasks={filteredTasks}
              columns={taskAssignees}
              getColumnLabel={(col: any) => col}
              getColId={(t: AppTask) => t.assignee}
              onMoveTask={handleMoveTask}
              onTaskClick={openEditTask}
              attendanceSessions={attendanceWindows}
              targetDate={targetDate}
              assigneeIdOverride={currentProfile?.id}
              profiles={profiles}
              liveTick={liveTick}
            />
          ) : (
            <KanbanView
              tasks={filteredTasks}
              columns={kanbanColumns}
              getColumnLabel={getKanbanLabel}
              onAddCard={openNewTask}
              onMoveTask={handleMoveTask}
              onTaskClick={openEditTask}
              attendanceSessions={attendanceWindows}
              targetDate={targetDate}
              assigneeIdOverride={currentProfile?.id}
              profiles={profiles}
              liveTick={liveTick}
            />
          )
      )}
      {view === "list"     && (
        showFilterEmpty
          ? <DataEmpty message="No tasks match your filters." />
          : filteredTasks.length === 0
            ? (
              <div className="text-center py-12">
                <DataEmpty message="No tasks in this project yet." />
                <button
                  type="button"
                  onClick={() => openNewTask(kanbanColumns[0])}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-semibold"
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )
            : <ListView tasks={filteredTasks} onTaskClick={openEditTask} />
      )}
      {view === "calendar" && (
        showFilterEmpty
          ? <DataEmpty message="No tasks match your filters." />
          : filteredTasks.length === 0
            ? (
              <div className="text-center py-12">
                <DataEmpty message="No tasks in this project yet." />
                <button type="button" onClick={() => openNewTask("todo")} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-semibold">
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )
            : <CalendarView tasks={filteredTasks} onTaskClick={openEditTask} />
      )}
      {view === "timeline" && (
        showFilterEmpty
          ? <DataEmpty message="No tasks match your filters." />
          : filteredTasks.length === 0
            ? (
              <div className="text-center py-12">
                <DataEmpty message="No tasks in this project yet." />
                <button type="button" onClick={() => openNewTask("todo")} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-semibold">
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )
            : <TimelineGanttView tasks={filteredTasks} onTaskClick={openEditTask} />
      )}
      {view === "workload" && (
        showFilterEmpty
          ? <DataEmpty message="No tasks match your filters." />
          : filteredTasks.length === 0
            ? (
              <div className="text-center py-12">
                <DataEmpty message="No tasks in this project yet." />
                <button type="button" onClick={() => openNewTask("todo")} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-semibold">
                  <Plus size={14} /> Add Task
                </button>
              </div>
            )
            : <WorkloadView tasks={filteredTasks} onTaskClick={openEditTask} sprintSubtitle={workloadSprintSubtitle} />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditingTask(null); }}>
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4 font-['Plus_Jakarta_Sans']">
              {editingTask ? "Edit Task" : "New Task"}
            </h3>
            {formError && <p className="mb-3 text-xs text-rose-400">{formError}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Task Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Fix login bug"
                  className={inputCls}
                  autoFocus
                />
              </div>
              {!fixedProjectId && (
                <div>
                  <label className={labelCls}>Project *</label>
                  {editingTask ? (
                    <input value={editingTask.project} readOnly className={`${inputCls} opacity-70 cursor-not-allowed`} />
                  ) : (
                    <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} className={inputCls}>
                      <option value="">Select project</option>
                      {availableProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Assignee *</label>
                  {personalView && !editingTask ? (
                    <input value={form.assignee} readOnly className={`${inputCls} opacity-70 cursor-not-allowed`} />
                  ) : (
                    <select
                      value={form.assigneeId}
                      onChange={e => {
                        const profile = assignees.find(p => p.id === e.target.value);
                        setForm({
                          ...form,
                          assigneeId: e.target.value,
                          assignee: profile?.name || "",
                        });
                      }}
                      className={inputCls}
                    >
                      <option value="">Select assignee</option>
                      {assignees.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskColumn })} className={inputCls}>
                    {formStatusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Due Date</label>
                  <input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Task Date *</label>
                  <input
                    type="date"
                    value={form.taskDate}
                    onChange={e => setForm({ ...form, taskDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] -mt-2">
                Task Date controls Today&apos;s Tasks on dashboard. Set tomorrow to carry incomplete work forward.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div />
              </div>
              <div>
                <label className={labelCls}>
                  {form.status === "done" ? "Hours Worked *" : "Estimated Hours"}
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={form.est}
                  onChange={e => setForm({ ...form, est: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Work Description {form.status === "done" ? "*" : ""}
                </label>
                <textarea
                  value={form.workNotes}
                  onChange={e => setForm({ ...form, workNotes: e.target.value })}
                  rows={4}
                  placeholder="e.g. Fixed invoice status bug on JDP dashboard, tested payment flow, updated API response..."
                  className={`${inputCls} resize-none`}
                />
                <p className="text-[10px] text-emerald-400/80 mt-1.5 font-['Plus_Jakarta_Sans']">
                  {form.status === "done"
                    ? "Required when Done — also appears in Time Reports."
                    : "Optional now — hours + notes appear in Time Reports in any status."}
                </p>
              </div>
              {editingTaskLive && (
                <TaskStageBreakdown
                  task={editingTaskLive}
                  attendanceSessions={attendanceWindows}
                  targetDate={targetDate}
                  assigneeIdOverride={currentProfile?.id}
                  profiles={profiles}
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} className="px-4 py-2 text-xs text-[#6b7fa8] hover:text-white">Cancel</button>
              <button type="button" onClick={handleSaveTask} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl">
                <Save size={13} /> {saving ? "Saving..." : editingTask ? "Update Task" : "Save Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
