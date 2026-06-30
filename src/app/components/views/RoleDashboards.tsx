import React, { useState, useEffect, useId, useMemo, useCallback } from "react";
import {
  Users, Activity, Clock, AlertTriangle, Target, CheckSquare,
  Zap, GitBranch, Layers, Star, TrendingUp, DollarSign, PieChart,
  Coffee, Utensils, Briefcase, LogOut, X, MapPin,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
} from "recharts";
import { Avatar, Badge } from "../ui";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useEmployeeProfiles, useProjectTasks, useProjects, useTimesheets, useLeaveRequests } from "@/hooks/useSupabaseData";
import {
  CLOCK_OUT_OPTIONS,
  CLOCK_SESSIONS_SETUP_MSG,
  clockInEmployee,
  clockOutEmployee,
  fetchActiveClockSession,
  fetchTodayOfficeSession,
  fetchTodayAttendanceSeconds,
  fetchWeekAttendanceHours,
  submitLeaveRequest,
  updateLeaveStatus,
  type ClockOutReason,
  filterTasksForUser,
  isClockSessionsTableReady,
  isEmployeeDashboardTask,
  isTaskDueToday,
  namesMatch,
  parseTaskDueDate,
  sortTodayTasks,
  type AppTask,
  type ClockSessionRecord,
  type TimesheetEntry,
  insertEmployeeScreenshot,
} from "@/lib/database";
import { uploadToCloudinary } from "@/lib/cloudinary";
function parseEstHours(est: string) {
  const num = parseFloat(String(est || "").replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function prioritySeverity(p: string) {
  if (p === "urgent") return "Critical";
  if (p === "high") return "High";
  if (p === "medium") return "Medium";
  return "Low";
}

function taskStatusLabel(s: string) {
  if (s === "done") return "Resolved";
  if (s === "in-progress") return "In Progress";
  if (s === "review") return "Review";
  if (s === "ready-for-testing") return "Ready for QA";
  return "Open";
}

function severityBadgeVariant(severity: string): "red" | "yellow" | "blue" | "green" {
  if (severity === "Critical") return "red";
  if (severity === "High") return "yellow";
  if (severity === "Medium") return "blue";
  return "green";
}

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function entryDateIso(date: string): string | null {
  if (!date || date === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalDate(d);
}

function formatDueLabel(due: string) {
  if (!due || due === "—") return "—";
  const dueDate = parseTaskDueDate(due);
  if (!dueDate) return due;
  if (isTaskDueToday(due)) return "Today";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  dueDate.setHours(12, 0, 0, 0);
  if (dueDate.getTime() < today.getTime()) {
    return `${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · overdue`;
  }
  return dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function taskPriorityLabel(p: string) {
  const map: Record<string, string> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
  return map[p] || p;
}

function taskPriorityVariant(p: string): "red" | "yellow" | "blue" | "green" {
  if (p === "urgent" || p === "high") return "red";
  if (p === "medium") return "yellow";
  return "blue";
}

function sortDashboardTasks(tasks: AppTask[]) {
  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });
}

function filterTimesheetsForUser(entries: TimesheetEntry[], userName: string) {
  if (!userName) return entries;
  return entries.filter(e => namesMatch(e.employee, userName));
}

function secondsToHours(seconds: number) {
  return Math.round((seconds / 3600) * 10000) / 10000;
}

function formatWeekDuration(hours: number) {
  if (hours <= 0) return "0h";
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins}m`;
  }
  return `${Math.round(hours * 10) / 10}h`;
}

function hasWorkedHours(hours: number) {
  return hours >= 1 / 3600;
}

function buildWeekHoursFromProfile(weeklyHours: { day: string; h: number }[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return days.map(day => ({
    day,
    h: weeklyHours.find(w => w.day === day)?.h ?? 0,
  }));
}

function buildWeekHoursFromTimesheets(entries: TimesheetEntry[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const now = new Date();
  const monday = new Date(now);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  return days.map((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const iso = formatLocalDate(date);
    const h = entries
      .filter(e => entryDateIso(e.date) === iso)
      .reduce((sum, e) => sum + e.hours, 0);
    return { day, h: Math.round(h * 10) / 10 };
  });
}

export function TeamLeaderDashboard() {
  const { data: profiles, loading: pLoading, error: pError } = useEmployeeProfiles();
  const { data: tasks, loading: tLoading, error: tError } = useProjectTasks();
  const { data: projects, loading: prLoading, error: prError } = useProjects();

  const loading = pLoading || tLoading || prLoading;
  const error = pError || tError || prError;

  const safeProfiles = profiles ?? [];
  const safeTasks = tasks ?? [];
  const safeProjects = projects ?? [];

  const teamProfiles = safeProfiles.filter(p => p.appRole !== "ceo");
  const teamMembersCount = teamProfiles.length;

  // Sprint Progress: done tasks percentage across the whole system (leadership view).
  const sprintProgress = safeTasks.length
    ? Math.max(0, Math.min(100, Math.round((safeTasks.filter(t => t.status === "done").length / safeTasks.length) * 100)))
    : 0;

  // Pending Approvals: tasks currently in "review".
  const pendingApprovalsCount = safeTasks.filter(t => t.status === "review").length;

  // Delayed Projects: project end date is before today and progress not completed.
  const todayNoon = new Date();
  todayNoon.setHours(12, 0, 0, 0);
  const delayedProjectsCount = safeProjects.filter(p => {
    const end = parseTaskDueDate(p.end);
    const progressNum = Number(p.progress) || 0;
    return Boolean(end) && end!.getTime() < todayNoon.getTime() && progressNum < 100;
  }).length;

  const teamData = useMemo(() => {
    const riskThreshold = 75;

    return [...teamProfiles]
      .map(profile => {
        const assigned = safeTasks.filter(t => t.assigneeId === profile.id);
        const open = assigned.filter(t => t.status !== "done").length;
        return {
          name: profile.name,
          score: profile.score,
          tasks: open,
          status: profile.score >= riskThreshold ? "On Track" : "At Risk",
        };
      })
      .sort((a, b) => {
        const aRisk = a.status === "At Risk" ? 1 : 0;
        const bRisk = b.status === "At Risk" ? 1 : 0;
        return aRisk - bRisk || b.score - a.score || b.tasks - a.tasks;
      })
      .slice(0, 5);
  }, [teamProfiles, safeTasks]);

  const kanbanCols = useMemo(() => {
    type Col = { id: string; label: string; color: string; status: string };
    const cols: Col[] = [
      { id: "todo", label: "To Do", color: "bg-[#6b7fa8]", status: "todo" },
      { id: "inprog", label: "In Progress", color: "bg-indigo-500", status: "in-progress" },
      { id: "review", label: "In Review", color: "bg-amber-500", status: "review" },
      { id: "done", label: "Done", color: "bg-emerald-500", status: "done" },
    ];

    const dueTs = (due: string) => parseTaskDueDate(due)?.getTime() ?? Number.POSITIVE_INFINITY;

    return cols.map(col => {
      const colTasks = safeTasks
        .filter(t => t.status === col.status)
        .sort((a, b) => dueTs(a.due) - dueTs(b.due) || a.createdAt.localeCompare(b.createdAt))
        .slice(0, 3)
        .map(t => t.title);

      return { ...col, tasks: colTasks };
    });
  }, [safeTasks]);

  const summaryCards = [
    { label: "Team Members", value: String(teamMembersCount), icon: Users, color: "text-indigo-400" },
    { label: "Sprint Progress", value: `${sprintProgress}%`, icon: Activity, color: "text-emerald-400" },
    { label: "Pending Approvals", value: String(pendingApprovalsCount), icon: Clock, color: "text-amber-400" },
    { label: "Delayed Projects", value: String(delayedProjectsCount), icon: AlertTriangle, color: "text-red-400" },
  ];

  if (loading) {
    return <DataLoading label="Loading team dashboard from Supabase..." />;
  }
  if (error) {
    return <DataError message={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Team Performance</h3>
          <div className="space-y-3">
            {teamData.map(m => (
              <div key={m.name} className="flex items-center gap-3">
                <Avatar initials={m.name.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m.name}</span>
                    <span className={`text-[10px] font-['Geist_Mono'] ${m.status === "At Risk" ? "text-red-400" : "text-emerald-400"}`}>{m.score}%</span>
                  </div>
                  <div className="h-1.5 bg-[#131a35] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${m.score > 85 ? "bg-emerald-500" : m.score > 75 ? "bg-indigo-500" : "bg-amber-500"}`} style={{ width: `${m.score}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{m.tasks}t</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Mini Kanban</h3>
          <div className="grid grid-cols-2 gap-3">
            {kanbanCols.map(col => (
              <div key={col.id}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${col.color}`} />
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase">{col.label}</span>
                </div>
                <div className="space-y-1.5">
                  {col.tasks.map(t => (
                    <div key={t} className="bg-[#131a35] border border-[rgba(99,102,241,0.1)] rounded-lg px-2.5 py-1.5">
                      <p className="text-[11px] text-[#a8b5d1] font-['Plus_Jakarta_Sans']">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type EmployeeNavigateOptions = { projectId?: string };

export function LeavesView({ userName }: { userName?: string }) {
  const { data: profiles } = useEmployeeProfiles();
  const { data: leaves, refresh: refreshLeaves, loading } = useLeaveRequests();
  const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const [viewTab, setViewTab] = useState<"my" | "team">("my");
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [viewingLeave, setViewingLeave] = useState<typeof leaves[0] | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveData, setLeaveData] = useState({
    type: "Casual Leave",
    startDate: "",
    endDate: "",
    days: 1,
    reason: "",
    startTime: "09:00",
    endTime: "17:00",
    halfDayType: "First Half",
    reportingOfficer: "",
  });

  const reportingOfficers = useMemo(() => {
    return profiles.filter(p => {
      const role = (p.role || "").toLowerCase();
      return role.includes("ceo") || role.includes("manager") || role.includes("lead") || role.includes("head") || p.appRole === "ceo" || p.appRole === "hr";
    });
  }, [profiles]);

  // Set default reporting officer when profiles load
  useEffect(() => {
    if (reportingOfficers.length > 0 && !leaveData.reportingOfficer) {
      setLeaveData(prev => ({ ...prev, reportingOfficer: reportingOfficers[0].name }));
    }
  }, [reportingOfficers, leaveData.reportingOfficer]);

  const myProfile = useMemo(
    () => profiles.find(p => namesMatch(p.name, userName || "")),
    [profiles, userName]
  );

  const myLeaves = useMemo(
    () => leaves.filter(l => l.employeeId === myProfile?.id),
    [leaves, myProfile?.id]
  );

  const teamLeaves = useMemo(() => {
    if (!myProfile) return [];
    return leaves.filter(l => {
      if (l.employeeId === myProfile.id) return false;
      if (l.reportingOfficer === myProfile.name || l.reportingTo === myProfile.name) return true;
      if (l.reason.includes(`(Reporting To: ${myProfile.name})`)) return true;
      const emp = profiles.find(p => p.id === l.employeeId);
      if (emp && emp.manager === myProfile.name) return true;
      return false;
    });
  }, [leaves, myProfile, profiles]);

  const isManagerOrTL = useMemo(() => {
    if (!myProfile) return false;
    const r = (myProfile.role || "").toLowerCase();
    if (r.includes("manager") || r.includes("lead") || r.includes("ceo") || r.includes("head") || myProfile.appRole === "ceo") return true;
    return teamLeaves.length > 0;
  }, [myProfile, teamLeaves]);

  const displayedLeaves = useMemo(() => {
    const source = viewTab === "my" ? myLeaves : teamLeaves;
    return source.filter(l => filterStatus === "All" || l.status === filterStatus);
  }, [viewTab, myLeaves, teamLeaves, filterStatus]);

  const handleUpdateTeamLeave = async (id: string, status: "Approved" | "Rejected", leaveDetails?: { employeeId: string; employeeName: string; leaveType: string }) => {
    try {
      await updateLeaveStatus(id, status, leaveDetails);
      refreshLeaves();
    } catch (e) {
      console.error("Failed to update team leave:", e);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    setLeaveLoading(true);
    setLeaveError("");
    try {
      let finalReason = leaveData.reason;

      const formatTime = (time24: string) => {
        const [h, m] = time24.split(':');
        let hours = parseInt(h);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours.toString().padStart(2, '0')}:${m} ${ampm}`;
      };

      if (leaveData.type === "Short Leave") {
        finalReason += `\n(Time: ${formatTime(leaveData.startTime)} - ${formatTime(leaveData.endTime)})`;
      } else if (leaveData.type === "Half Day") {
        finalReason += `\n(Type: ${leaveData.halfDayType})`;
      }
      finalReason += `\n(Reporting To: ${leaveData.reportingOfficer})`;

      await submitLeaveRequest({
        employeeId: myProfile.id,
        employeeName: myProfile.name,
        leaveType: leaveData.type,
        startDate: leaveData.startDate,
        endDate: (leaveData.type === "Short Leave" || leaveData.type === "Half Day") ? leaveData.startDate : leaveData.endDate,
        days: leaveData.type === "Half Day" ? 0.5 : leaveData.type === "Short Leave" ? 0 : leaveData.days,
        reason: finalReason,
        reportingOfficer: leaveData.reportingOfficer,
        reportingTo: leaveData.reportingOfficer,
      });
      setShowLeaveMenu(false);
      setLeaveData({ type: "Casual Leave", startDate: "", endDate: "", days: 1, reason: "", startTime: "09:00", endTime: "17:00", halfDayType: "First Half", reportingOfficer: reportingOfficers[0]?.name || "" });
      refreshLeaves();
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Failed to apply for leave");
    } finally {
      setLeaveLoading(false);
    }
  };

  if (loading) return <DataLoading label="Loading leave requests..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
            {viewTab === "team" ? "Team Leave Requests" : "My Leave Requests"}
          </h2>
          {isManagerOrTL && (
            <div className="flex p-1 bg-[#131a35] rounded-xl border border-[rgba(99,102,241,0.08)]">
              <button
                onClick={() => setViewTab("my")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewTab === "my" ? "bg-indigo-600 text-white" : "text-[#6b7fa8] hover:text-white"}`}
              >
                My Leaves
              </button>
              <button
                onClick={() => setViewTab("team")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewTab === "team" ? "bg-indigo-600 text-white" : "text-[#6b7fa8] hover:text-white"}`}
              >
                Team Leaves
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowLeaveMenu(true)}
          className="px-4 py-2 text-sm font-semibold font-['Plus_Jakarta_Sans'] transition-all text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl whitespace-nowrap"
        >
          + Apply Leave
        </button>
      </div>

      <div className="flex gap-2">
        {(["All", "Pending", "Approved", "Rejected"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-['Plus_Jakarta_Sans'] transition-all ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-[#131a35] text-[#6b7fa8] border border-[rgba(99,102,241,0.08)] hover:text-white"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        {displayedLeaves.length === 0 ? (
          <DataEmpty message={`No ${filterStatus !== "All" ? filterStatus.toLowerCase() + " " : ""}leave requests.`} />
        ) : (
          <div className="space-y-3">
            {displayedLeaves.map(l => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-4 bg-[#131a35] rounded-xl border border-[rgba(99,102,241,0.08)]">
                {viewTab === "team" && (
                  <Avatar initials={l.employeeName.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
                )}
                <div className="flex-1 min-w-0">
                  {viewTab === "team" ? (
                    <p className="text-sm font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{l.employeeName}</p>
                  ) : (
                    <p className="text-sm font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{l.leaveType}</p>
                  )}
                  <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8] mt-1">
                    {viewTab === "team" && <span className="mr-1">{l.leaveType} ·</span>}
                    {l.days}d from {l.startDate} to {l.endDate}
                  </p>
                  {l.reason && <p className="text-xs text-[#6b7fa8]/80 mt-1.5 italic truncate">"{l.reason}"</p>}
                </div>
                <Badge variant={l.status === "Approved" ? "green" : l.status === "Pending" ? "yellow" : "red"}>
                  {l.status}
                </Badge>
                {viewTab === "team" && (
                  <div className="flex items-center gap-2 ml-4">
                    {l.status === "Pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => void handleUpdateTeamLeave(l.id, "Approved", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType })} className="text-[10px] font-['Geist_Mono'] text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">Approve</button>
                        <button onClick={() => void handleUpdateTeamLeave(l.id, "Rejected", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType })} className="text-[10px] font-['Geist_Mono'] text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">Reject</button>
                      </div>
                    )}
                    <button onClick={() => setViewingLeave(l)} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] border border-[rgba(99,102,241,0.2)] px-2.5 py-1 rounded-lg hover:text-white hover:bg-white/5 transition-colors">View</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setViewingLeave(null)}>
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,102,241,0.1)]">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Leave Request Details</h3>
              <button type="button" onClick={() => setViewingLeave(null)} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Employee</p>
                <p className="text-sm text-white font-semibold">{viewingLeave.employeeName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Leave Type</p>
                  <p className="text-sm text-white">{viewingLeave.leaveType}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Status</p>
                  <Badge variant={viewingLeave.status === "Approved" ? "green" : viewingLeave.status === "Pending" ? "yellow" : "red"}>{viewingLeave.status}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Start Date</p>
                  <p className="text-sm text-white">{viewingLeave.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">End Date</p>
                  <p className="text-sm text-white">{viewingLeave.endDate}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Duration</p>
                <p className="text-sm text-white">{viewingLeave.days} Day(s)</p>
              </div>
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Detailed Reason</p>
                <div className="bg-[#131a35] rounded-xl p-3 border border-[rgba(99,102,241,0.08)]">
                  <p className="text-sm text-[#e2e8f7] whitespace-pre-wrap">{viewingLeave.reason || "No reason provided."}</p>
                </div>
              </div>
              
              {viewingLeave.status === "Pending" && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { void handleUpdateTeamLeave(viewingLeave.id, "Approved", { employeeId: viewingLeave.employeeId, employeeName: viewingLeave.employeeName, leaveType: viewingLeave.leaveType }); setViewingLeave(null); }} className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 py-2.5 rounded-xl text-sm font-semibold transition-colors">Approve</button>
                  <button onClick={() => { void handleUpdateTeamLeave(viewingLeave.id, "Rejected", { employeeId: viewingLeave.employeeId, employeeName: viewingLeave.employeeName, leaveType: viewingLeave.leaveType }); setViewingLeave(null); }} className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2.5 rounded-xl text-sm font-semibold transition-colors">Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLeaveMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !leaveLoading && setShowLeaveMenu(false)}>
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,102,241,0.1)]">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Apply for Leave</h3>
              <button type="button" onClick={() => setShowLeaveMenu(false)} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>
            <form onSubmit={handleLeaveSubmit} className="p-5 space-y-4">
              {leaveError && <p className="text-xs text-rose-400">{leaveError}</p>}
              <div>
                <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Leave Type</label>
                <select
                  value={leaveData.type}
                  onChange={e => setLeaveData({ ...leaveData, type: e.target.value })}
                  className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                >
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="WFH">Work From Home (WFH)</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Short Leave">Short Leave</option>
                  <option value="Urgent Leave">Urgent Leave</option>
                </select>
              </div>
              
              {(leaveData.type === "Short Leave" || leaveData.type === "Half Day") ? (
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveData.startDate}
                    onChange={e => setLeaveData({ ...leaveData, startDate: e.target.value })}
                    className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Start Date *</label>
                      <input
                        type="date"
                        required
                        value={leaveData.startDate}
                        onChange={e => setLeaveData({ ...leaveData, startDate: e.target.value })}
                        className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">End Date *</label>
                      <input
                        type="date"
                        required
                        value={leaveData.endDate}
                        onChange={e => setLeaveData({ ...leaveData, endDate: e.target.value })}
                        className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Number of Days</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={leaveData.days}
                      onChange={e => setLeaveData({ ...leaveData, days: parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </>
              )}

              {leaveData.type === "Short Leave" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={leaveData.startTime}
                      onChange={e => setLeaveData({ ...leaveData, startTime: e.target.value })}
                      className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">End Time *</label>
                    <input
                      type="time"
                      required
                      value={leaveData.endTime}
                      onChange={e => setLeaveData({ ...leaveData, endTime: e.target.value })}
                      className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}

              {leaveData.type === "Half Day" && (
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Half Day Type *</label>
                  <select
                    value={leaveData.halfDayType}
                    onChange={e => setLeaveData({ ...leaveData, halfDayType: e.target.value })}
                    className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                  >
                    <option value="First Half">First Half</option>
                    <option value="Second Half">Second Half</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Reporting Officer *</label>
                <select
                  required
                  value={leaveData.reportingOfficer}
                  onChange={e => setLeaveData({ ...leaveData, reportingOfficer: e.target.value })}
                  className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50"
                >
                  <option value="" disabled>Select Reporting Officer</option>
                  {reportingOfficers.map(officer => (
                    <option key={officer.id} value={officer.name}>
                      {officer.name} ({officer.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5">Reason for Leave *</label>
                <textarea
                  required
                  value={leaveData.reason}
                  onChange={e => setLeaveData({ ...leaveData, reason: e.target.value })}
                  placeholder="Explain the detailed reason for this leave request..."
                  className="w-full bg-[#131a35] text-white text-sm border border-[rgba(99,102,241,0.12)] rounded-xl px-4 py-3 outline-none focus:border-indigo-500/50 resize-none h-28"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={leaveLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-50"
                >
                  {leaveLoading ? "Submitting..." : "Submit Leave Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeeDashboard({
  userName = "",
  onNavigate,
}: {
  userName?: string;
  onNavigate?: (view: string, options?: EmployeeNavigateOptions) => void;
}) {
  const { data: tasks, loading: tLoading, error: tError, refresh: refreshTasks } = useProjectTasks();
  const { data: timesheets, loading: tsLoading, error: tsError, refresh: refreshTimesheets } = useTimesheets();
  const { data: profiles, loading: pLoading, error: pError } = useEmployeeProfiles();
  const [activeClock, setActiveClock] = useState<ClockSessionRecord | null>(null);
  const [todaySession, setTodaySession] = useState<ClockSessionRecord | null>(null);
  const [showClockOutMenu, setShowClockOutMenu] = useState(false);
  const [todayAttendanceSeconds, setTodayAttendanceSeconds] = useState(0);
  const [weekHours, setWeekHours] = useState<{ day: string; h: number }[]>([
    { day: "Mon", h: 0 },
    { day: "Tue", h: 0 },
    { day: "Wed", h: 0 },
    { day: "Thu", h: 0 },
    { day: "Fri", h: 0 },
  ]);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockError, setClockError] = useState("");
  const [clockSetupNeeded, setClockSetupNeeded] = useState(false);
  const [tick, setTick] = useState(0);
  const [attendanceFetchTime, setAttendanceFetchTime] = useState(Date.now());

  const myProfile = useMemo(
    () => profiles.find(p => namesMatch(p.name, userName)),
    [profiles, userName]
  );

  const refreshClockState = useCallback(async () => {
    if (!userName) return;
    const [session, today, todaySeconds, week] = await Promise.all([
      fetchActiveClockSession(userName, myProfile?.id),
      fetchTodayOfficeSession(userName, myProfile?.id),
      fetchTodayAttendanceSeconds(userName, myProfile?.id),
      fetchWeekAttendanceHours(userName, myProfile?.id),
    ]);
    const now = Date.now();
    setActiveClock(session);
    setTodaySession(today);
    setTodayAttendanceSeconds(todaySeconds);
    setAttendanceFetchTime(now);
    setWeekHours(week);
    setClockSetupNeeded(!isClockSessionsTableReady());
  }, [userName, myProfile?.id]);

  useEffect(() => {
    if (!userName || pLoading) return;
    let cancelled = false;
    refreshClockState().catch(() => {
      if (!cancelled) setActiveClock(null);
    });
    return () => { cancelled = true; };
  }, [userName, myProfile?.id, pLoading, refreshClockState]);

  const isMeetingBreak = todaySession?.status === "paused" && !!todaySession?.notes?.toLowerCase().includes("meeting");

  useEffect(() => {
    const activeOrMeetingSession = activeClock || (isMeetingBreak ? todaySession : null);
    if (!activeOrMeetingSession) return;
    const id = setInterval(() => {
      setTick(t => t + 1);

      // Auto-close check at 1 AM
      const clockInDate = new Date(activeOrMeetingSession.clockIn);
      const now = new Date();
      if (
        (clockInDate.getDate() !== now.getDate() ||
         clockInDate.getMonth() !== now.getMonth() ||
         clockInDate.getFullYear() !== now.getFullYear()) &&
        now.getHours() >= 1
      ) {
        refreshClockState();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [activeClock, todaySession, isMeetingBreak, refreshClockState]);

  const activeOrMeetingSessionId = activeClock?.id || (isMeetingBreak ? todaySession?.id : null);

  useEffect(() => {
    if (!activeOrMeetingSessionId || !userName) return;

    const captureScreenshot = async () => {
      try {
        if (!(window as any).electronAPI?.takeScreenshot) return;
        const base64Img = await (window as any).electronAPI.takeScreenshot();
        if (!base64Img) return;

        const res = await fetch(base64Img);
        const blob = await res.blob();
        const file = new File([blob], `screenshot_${Date.now()}.jpg`, { type: 'image/jpeg' });

        const uploadResult = await uploadToCloudinary(file, "erp-screenshots");
        if (uploadResult?.url) {
          await insertEmployeeScreenshot({
            employeeName: userName,
            employeeId: myProfile?.id,
            imageUrl: uploadResult.url,
          });
        }
      } catch (err) {
        console.error("Background screenshot failed:", err);
      }
    };

    // Capture immediately (after 10s delay to let system load)
    const initialTimeout = setTimeout(captureScreenshot, 10000);
    // Then every 10 minutes
    const captureInterval = setInterval(captureScreenshot, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(captureInterval);
    };
  }, [activeOrMeetingSessionId, userName, myProfile?.id]);

  const assigneeName = myProfile?.name || userName;

  const allMyTasks = useMemo(
    () =>
      assigneeName || myProfile?.id
        ? filterTasksForUser(tasks, assigneeName, myProfile?.id)
        : tasks,
    [tasks, assigneeName, myProfile?.id]
  );

  const myTasks = useMemo(
    () => sortTodayTasks(allMyTasks.filter(isEmployeeDashboardTask)),
    [allMyTasks]
  );

  const todayTaskStats = useMemo(() => {
    const total = myTasks.length;
    const done = myTasks.filter(t => t.status === "done").length;
    return { done, total };
  }, [myTasks]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshTasks();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshTasks]);

  // `tick` bumps every second while clocked in so the timer re-renders live.
  let totalSeconds = todayAttendanceSeconds;
  const activeOrMeetingSession = activeClock || (isMeetingBreak ? todaySession : null);

  if (activeOrMeetingSession) {
    totalSeconds += Math.max(0, Math.floor((Date.now() - attendanceFetchTime) / 1000));
  }
  void tick;

  const displayWeekHours = useMemo(() => {
    const todayIndex = (new Date().getDay() + 6) % 7;
    if (todayIndex > 4) return weekHours;
    const todayName = ["Mon", "Tue", "Wed", "Thu", "Fri"][todayIndex];
    const todayHours = secondsToHours(totalSeconds);
    return weekHours.map(d =>
      d.day === todayName ? { ...d, h: todayHours } : d
    );
  }, [weekHours, totalSeconds, tick]);

  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  const { done: doneCount, total: totalCount } = todayTaskStats;
  const focusScore =
    totalCount > 0
      ? Math.round((doneCount / totalCount) * 100)
      : (myProfile?.score ?? 0);

  const totalWeekHours = displayWeekHours.reduce((sum, d) => sum + d.h, 0);
  const activeDays = displayWeekHours.filter(d => hasWorkedHours(d.h)).length;
  const avgDay = activeDays > 0 ? totalWeekHours / activeDays : 0;
  const maxBarHours = Math.max(
    1 / 60,
    ...displayWeekHours.map(d => (hasWorkedHours(d.h) ? d.h : 0)),
    1 / 60
  );
  const attendance = Math.min(100, Math.round((activeDays / 5) * 100));

  const onBreak = todaySession?.status === "paused";
  const breakLabel = todaySession?.notes?.replace(/^Break:\s*/, "") || "On break";

  const handleClockIn = useCallback(async () => {
    if (!userName) return;
    setClockLoading(true);
    setClockError("");
    try {
      await clockInEmployee({
        employeeName: myProfile?.name || userName,
        employeeId: myProfile?.id,
      });
      setShowClockOutMenu(false);
      await refreshClockState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clock action failed";
      const needsSetup = msg === CLOCK_SESSIONS_SETUP_MSG || /clock_sessions/i.test(msg);
      setClockSetupNeeded(needsSetup);
      setClockError(needsSetup ? CLOCK_SESSIONS_SETUP_MSG : msg);
    } finally {
      setClockLoading(false);
    }
  }, [userName, myProfile, refreshClockState]);

  const handleClockOut = useCallback(async (reason: ClockOutReason) => {
    if (!userName || !activeClock) return;
    setClockLoading(true);
    setClockError("");
    try {
      await clockOutEmployee({
        sessionId: activeClock.id,
        employeeName: myProfile?.name || userName,
        employeeId: myProfile?.id,
        reason,
      });
      setShowClockOutMenu(false);
      await refreshClockState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clock action failed";
      const needsSetup = msg === CLOCK_SESSIONS_SETUP_MSG || /clock_sessions/i.test(msg);
      setClockSetupNeeded(needsSetup);
      setClockError(needsSetup ? CLOCK_SESSIONS_SETUP_MSG : msg);
    } finally {
      setClockLoading(false);
    }
  }, [activeClock, userName, myProfile, refreshClockState]);

  const clockOutIcons: Record<ClockOutReason, React.ReactNode> = {
    lunch: <Utensils size={16} />,
    tea: <Coffee size={16} />,
    personal: <Briefcase size={16} />,
    meeting: <MapPin size={16} />,
    end_day: <LogOut size={16} />,
  };

  const loading = tLoading || tsLoading || pLoading;
  const error = tError || tsError || pError;

  if (loading) return <DataLoading label="Loading your dashboard from Supabase..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#6b7fa8] text-sm font-['Geist_Mono']">
          {userName ? `${userName}'s dashboard` : "My dashboard"} · office attendance & overview
        </p>
      </div>
      {clockSetupNeeded && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 font-['Plus_Jakarta_Sans']">
          {CLOCK_SESSIONS_SETUP_MSG}
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5 flex items-center gap-5">
          <div className="text-center">
            <p className="text-3xl font-bold font-['Geist_Mono'] text-white">{hh}:{mm}:{ss}</p>
            <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-1">
              {activeClock
                ? "Office · Clocked In"
                : onBreak
                  ? `On Break · ${breakLabel}`
                  : "Office · Clocked Out"}
            </p>
            <p className="text-[9px] font-['Geist_Mono'] text-[#6b7fa8]/80 mt-0.5">
              Office attendance (not project timer)
            </p>
            {clockError && (
              <p className="text-[10px] text-rose-400 mt-1 font-['Plus_Jakarta_Sans'] max-w-[200px]">{clockError}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {activeClock ? (
              <button
                type="button"
                onClick={() => setShowClockOutMenu(true)}
                disabled={clockLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold font-['Plus_Jakarta_Sans'] transition-all disabled:opacity-60 bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
              >
                {clockLoading ? "Saving..." : "Step Out"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={clockLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold font-['Plus_Jakarta_Sans'] transition-all disabled:opacity-60 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
              >
                {clockLoading ? "Saving..." : onBreak ? "Resume Work" : "Clock In"}
              </button>
            )}
          </div>
        </div>



        {showClockOutMenu && activeClock && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => !clockLoading && setShowClockOutMenu(false)}
          >
            <div
              className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,102,241,0.1)]">
                <div>
                  <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Why stepping out?</h3>
                  <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">Timer will pause until you resume</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClockOutMenu(false)}
                  className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                {CLOCK_OUT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={clockLoading}
                    onClick={() => void handleClockOut(opt.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors disabled:opacity-50 ${
                      opt.id === "end_day"
                        ? "bg-red-500/10 border border-red-500/20 hover:bg-red-500/15"
                        : "bg-[#131a35] border border-[rgba(99,102,241,0.08)] hover:bg-[#1a2440]"
                    }`}
                  >
                    <span className={opt.id === "end_day" ? "text-red-400" : "text-indigo-400"}>
                      {clockOutIcons[opt.id]}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold font-['Plus_Jakarta_Sans'] ${opt.id === "end_day" ? "text-red-300" : "text-white"}`}>
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{opt.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {[
          { label: "Focus Score", value: `${focusScore}%`, icon: Target, color: "text-indigo-400" },
          {
            label: "Tasks Done",
            value: totalCount > 0 ? `${doneCount}/${totalCount}` : "—",
            hint: "today",
            icon: CheckSquare,
            color: "text-emerald-400",
          },
        ].map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
            {"hint" in c && c.hint ? (
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-1">{c.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => onNavigate?.("projects")}
              className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] hover:text-indigo-300 transition-colors"
            >
              Today&apos;s Tasks →
            </button>
            <span className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">open in Projects & Work</span>
          </div>
          <p className="text-[10px] text-indigo-400/70 font-['Plus_Jakarta_Sans'] mb-4">
            Created today · assigned to you · tap to open project
          </p>
          {tLoading ? (
            <DataLoading label="Loading today's tasks..." />
          ) : tError ? (
            <DataError message={tError} />
          ) : myTasks.length === 0 ? (
            <DataEmpty message="No tasks added today. Check Projects & Work for all your work." />
          ) : (
            <div className="space-y-2">
              {myTasks.map(t => {
                const done = t.status === "done";
                return (
                  <button
                    key={t.taskId}
                    type="button"
                    onClick={() => onNavigate?.("projectworkspace", { projectId: t.projectId })}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      done ? "border-[rgba(99,102,241,0.06)] opacity-50" : "border-[rgba(99,102,241,0.12)] hover:border-indigo-500/30"
                    } bg-[#131a35]`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 ${
                        done ? "border-emerald-500 bg-emerald-500/20" : "border-[#6b7fa8]"
                      }`}
                    >
                      {done && <span className="text-[8px] text-emerald-400">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-['Plus_Jakarta_Sans'] ${done ? "line-through text-[#6b7fa8]" : "text-[#e2e8f7]"}`}>
                        {t.title}
                      </p>
                      <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-0.5">
                        Due {formatDueLabel(t.due)} · {t.project}
                      </p>
                    </div>
                    <Badge variant={taskPriorityVariant(t.priority)}>{taskPriorityLabel(t.priority)}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <button
            type="button"
            onClick={() => onNavigate?.("timesheet")}
            className="text-sm font-semibold text-white mb-1 font-['Plus_Jakarta_Sans'] hover:text-indigo-300 transition-colors"
          >
            Office Hours (This Week) →
          </button>
          <p className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-4">
            From Clock In/Out · see Time Reports for full history
          </p>
          <div className="flex items-end gap-2 h-32">
            {displayWeekHours.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
                  {formatWeekDuration(d.h)}
                </span>
                <div
                  className="w-full bg-indigo-600/80 rounded-t-md min-h-[4px]"
                  style={{
                    height: hasWorkedHours(d.h)
                      ? `${Math.max((d.h / maxBarHours) * 100, 12)}%`
                      : "4px",
                  }}
                />
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{d.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-[rgba(99,102,241,0.08)]">
            {[
              { l: "Total", v: formatWeekDuration(totalWeekHours) },
              { l: "Avg/Day", v: formatWeekDuration(avgDay) },
              { l: "Attendance", v: `${attendance}%` },
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">{s.v}</p>
                <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type DevHubNavigateOptions = {
  taskId?: string;
  projectId?: string;
  status?: "todo" | "in-progress" | "ready-for-testing" | "review" | "done";
};

const SPRINT_STATUS_MAP: Record<string, DevHubNavigateOptions["status"]> = {
  Done: "done",
  "In Progress": "in-progress",
  Review: "review",
  "Ready for QA": "ready-for-testing",
  "To Do": "todo",
};

export function DevDashboard({
  userName = "",
  onNavigate,
}: {
  userName?: string;
  onNavigate?: (view: string, options?: DevHubNavigateOptions) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const { data: tasks, loading: tLoading, error: tError } = useProjectTasks();
  const { data: projects, loading: pLoading, error: pError } = useProjects();
  const { data: timesheets, loading: tsLoading, error: tsError } = useTimesheets();

  const loading = tLoading || pLoading || tsLoading;
  const error = tError || pError || tsError;

  const myTasks = React.useMemo(() => {
    if (!userName) return tasks;
    return filterTasksForUser(tasks, userName);
  }, [tasks, userName]);

  const sprintData = React.useMemo(() => {
    const done = myTasks.filter(t => t.status === "done").length;
    const inProgress = myTasks.filter(t => t.status === "in-progress").length;
    const readyForQa = myTasks.filter(t => t.status === "ready-for-testing").length;
    const inReview = myTasks.filter(t => t.status === "review").length;
    const todo = myTasks.filter(t => t.status === "todo").length;
    return [
      { name: "Done", value: done, fill: "#10b981" },
      { name: "In Progress", value: inProgress, fill: "#6366f1" },
      { name: "Review", value: inReview, fill: "#f59e0b" },
      { name: "Ready for QA", value: readyForQa, fill: "#8b5cf6" },
      { name: "To Do", value: todo, fill: "#131a35" },
    ].filter(s => s.value > 0 || myTasks.length === 0);
  }, [myTasks]);

  const bugs = React.useMemo(() => {
    const priorityTasks = myTasks
      .filter(t => t.priority === "urgent" || t.priority === "high" || t.priority === "medium")
      .sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
      })
      .slice(0, 6)
      .map((t, i) => ({
        taskId: t.taskId,
        projectId: t.projectId,
        id: t.taskId.slice(-6).toUpperCase() || `T${i + 1}`,
        title: t.title,
        severity: prioritySeverity(t.priority),
        assignee: t.assignee.split(" ")[0],
        status: taskStatusLabel(t.status),
      }));
    return priorityTasks;
  }, [myTasks]);

  const stats = React.useMemo(() => {
    const doneHours = myTasks
      .filter(t => t.status === "done")
      .reduce((sum, t) => sum + parseEstHours(t.est), 0);
    const openBugs = myTasks.filter(
      t => (t.priority === "urgent" || t.priority === "high") && t.status !== "done"
    ).length;
    const prsOpen = myTasks.filter(t => t.status === "review").length;
    const myProjects = userName ? projects.filter(p =>
      p.team.some(m => namesMatch(m, userName)) || namesMatch(p.lead, userName)
    ) : projects;
    const coverage =
      myProjects.length > 0
        ? Math.round(myProjects.reduce((sum, p) => sum + p.progress, 0) / myProjects.length)
        : myTasks.length > 0
          ? Math.round((myTasks.filter(t => t.status === "done").length / myTasks.length) * 100)
          : 0;
    const weekHours = timesheets
      .filter(e => !userName || e.employee.toLowerCase() === userName.toLowerCase())
      .reduce((sum, e) => sum + e.hours, 0);

    return {
      velocity: `${doneHours || weekHours}h`,
      openBugs: String(openBugs),
      prsOpen: String(prsOpen),
      coverage: `${coverage}%`,
      totalTasks: myTasks.length,
    };
  }, [myTasks, projects, timesheets, userName]);

  if (loading) return <DataLoading label="Loading Dev Hub from Supabase..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[#6b7fa8] text-sm font-['Geist_Mono']">
          {userName ? `${userName}'s sprint` : "Team sprint"} · {stats.totalTasks} tasks <span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span> from Supabase
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Sprint Velocity", value: stats.velocity, color: "text-indigo-400", icon: Zap, view: "timesheet" as const },
          { label: "Open Bugs", value: stats.openBugs, color: "text-red-400", icon: AlertTriangle, view: "projects" as const },
          { label: "PRs Open", value: stats.prsOpen, color: "text-amber-400", icon: GitBranch, view: "projects" as const, status: "review" as const },
          { label: "Project Progress", value: stats.coverage, color: "text-emerald-400", icon: Activity, view: "projects" as const },
        ]).map(c => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate?.(c.view, c.status ? { status: c.status } : undefined)}
            className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4 text-left hover:border-indigo-500/30 hover:bg-[#111829] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span></div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <button
            type="button"
            onClick={() => onNavigate?.("projects")}
            className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans'] hover:text-indigo-300 transition-colors"
          >
            Projects & Work →
          </button>
          {myTasks.length === 0 ? (
            <DataEmpty message="No tasks yet. Open a project from Projects & Work." />
          ) : (
            <>
              <svg width="0" height="0" style={{ position: "absolute" }}>
                <defs>
                  <radialGradient id={`${uid}devPieGrad`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#06091a" stopOpacity={0} />
                  </radialGradient>
                </defs>
              </svg>
              <ResponsiveContainer width="100%" height={200}>
                <RPieChart>
                  <Pie data={sprintData.length ? sprintData : [{ name: "Empty", value: 1, fill: "#131a35" }]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {(sprintData.length ? sprintData : [{ name: "Empty", value: 1, fill: "#131a35" }]).map((entry, i) => (
                      <Cell key={`dev-sprint-${i}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2 flex-wrap">
                {sprintData.map(s => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => onNavigate?.("projects", { status: SPRINT_STATUS_MAP[s.name] })}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                    <span className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] hover:text-indigo-300">{s.name} ({s.value})</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Priority Tasks</h3>
          <div className="space-y-2">
            {bugs.length === 0 ? (
              <DataEmpty message="No priority tasks. All clear!" />
            ) : bugs.map(b => (
              <button
                key={b.taskId}
                type="button"
                onClick={() => onNavigate?.("projects", { projectId: b.projectId, taskId: b.taskId })}
                className="w-full flex items-center gap-3 p-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)] hover:border-indigo-500/30 hover:bg-[#171f3d] transition-colors cursor-pointer text-left"
              >
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] w-14 shrink-0">{b.id}</span>
                <p className="flex-1 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{b.title}</p>
                <Badge variant={severityBadgeVariant(b.severity)}>{b.severity}</Badge>
                <span className={`text-[10px] font-['Geist_Mono'] shrink-0 ${b.status === "Resolved" ? "text-emerald-400" : b.status === "In Progress" || b.status === "In Review" ? "text-indigo-400" : "text-red-400"}`}>{b.status}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DesignDashboard() {
  const projects = [
    { name: "ERP Dashboard UI", revisions: 4, status: "Pending Approval", client: "Internal", due: "May 26" },
    { name: "Brand Identity v3", revisions: 2, status: "Approved", client: "TechCorp", due: "May 24" },
    { name: "Mobile App Screens", revisions: 7, status: "Revision Requested", client: "FinEdge", due: "May 27" },
    { name: "Social Media Kit", revisions: 1, status: "In Progress", client: "GreenLeaf", due: "May 30" },
    { name: "Landing Page Redesign", revisions: 3, status: "Pending Approval", client: "Internal", due: "May 28" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Projects", value: "8", icon: Layers, color: "text-indigo-400" },
          { label: "Pending Reviews", value: "3", icon: Clock, color: "text-amber-400" },
          { label: "Avg Revisions", value: "3.4", icon: Activity, color: "text-violet-400" },
          { label: "Approved This Week", value: "5", icon: Star, color: "text-emerald-400" },
        ].map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span></div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Project Approval Tracker</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-3 px-3 py-2">
            {["Project", "Client", "Revisions", "Due", "Status"].map(h => (
              <span key={h} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          {projects.map(p => (
            <div key={p.name} className="grid grid-cols-5 gap-3 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)] items-center">
              <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{p.name}</p>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{p.client}</p>
              <p className="text-xs font-['Geist_Mono'] text-[#a8b5d1]">{p.revisions}x</p>
              <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">{p.due}</p>
              <Badge variant={p.status === "Approved" ? "green" : p.status === "Revision Requested" ? "red" : p.status === "In Progress" ? "blue" : "yellow"}>
                {p.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketingDashboard() {
  const uid = useId().replace(/:/g, "");
  const campaignData = [
    { month: "Jan", leads: 42, spend: 28 }, { month: "Feb", leads: 58, spend: 35 },
    { month: "Mar", leads: 71, spend: 40 }, { month: "Apr", leads: 89, spend: 52 },
    { month: "May", leads: 103, spend: 61 },
  ];
  const platforms = [
    { name: "Google Ads", value: 38, fill: "#6366f1" },
    { name: "Meta Ads", value: 27, fill: "#8b5cf6" },
    { name: "LinkedIn", value: 21, fill: "#06b6d4" },
    { name: "Others", value: 14, fill: "#131a35" },
  ];
  const campaigns = [
    { name: "B2B SaaS Q2", channel: "LinkedIn", leads: 34, cpl: "₹840", status: "Active" },
    { name: "Brand Awareness", channel: "Meta", leads: 28, cpl: "₹420", status: "Active" },
    { name: "Dev Tools Launch", channel: "Google", leads: 19, cpl: "₹1,240", status: "Paused" },
    { name: "Retargeting Wave 3", channel: "Meta", leads: 22, cpl: "₹380", status: "Active" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Leads This Month", value: "103", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Total Ad Spend", value: "₹61K", icon: DollarSign, color: "text-indigo-400" },
          { label: "Avg CPL", value: "₹592", icon: Target, color: "text-violet-400" },
          { label: "Conversion Rate", value: "6.8%", icon: Activity, color: "text-amber-400" },
        ].map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span></div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Lead Generation Trend</h3>
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <linearGradient id={`${uid}mktLeads`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={campaignData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "#6b7fa8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="leads" stroke="#6366f1" fill={`url(#${uid}mktLeads)`} strokeWidth={2} name="Leads" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Ad Spend by Platform</h3>
          <ResponsiveContainer width="100%" height={180}>
            <RPieChart>
              <Pie data={platforms} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={3}>
                {platforms.map((entry, i) => <Cell key={`mkt-platform-${i}`} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            {platforms.map(p => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{p.name} {p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Active Campaigns</h3>
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.name} className="flex items-center gap-4 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
              <p className="flex-1 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{c.name}</p>
              <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] w-16">{c.channel}</span>
              <span className="text-xs font-['Geist_Mono'] text-indigo-400 w-12">{c.leads} leads</span>
              <span className="text-xs font-['Geist_Mono'] text-[#a8b5d1] w-16">{c.cpl}/lead</span>
              <Badge variant={c.status === "Active" ? "green" : "yellow"}>{c.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RevenueKPIView() {
  const deptProfit = [
    { dept: "Development", revenue: 42, cost: 28, profit: 14 },
    { dept: "Design", revenue: 18, cost: 11, profit: 7 },
    { dept: "Marketing", revenue: 31, cost: 19, profit: 12 },
    { dept: "HR/Ops", revenue: 5, cost: 8, profit: -3 },
  ];
  const kpis = [
    { name: "Kavya Nair", role: "Senior Designer", revenue: "₹8.2L", score: 97, roi: "+192%", trend: "up" },
    { name: "Arjun Mehta", role: "Lead Developer", revenue: "₹12.4L", score: 88, roi: "+156%", trend: "up" },
    { name: "Priya Sharma", role: "Dev Lead", revenue: "₹11.1L", score: 94, roi: "+178%", trend: "up" },
    { name: "Rahul Gupta", role: "Marketing Exec", revenue: "₹3.4L", score: 71, roi: "+42%", trend: "down" },
    { name: "Amit Kumar", role: "Full Stack Dev", revenue: "₹9.8L", score: 82, roi: "+134%", trend: "up" },
    { name: "Sneha Reddy", role: "HR Manager", revenue: "₹2.1L", score: 79, roi: "+28%", trend: "down" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: "₹96L", icon: DollarSign, color: "text-emerald-400" },
          { label: "Net Profit", value: "₹30L", icon: TrendingUp, color: "text-indigo-400" },
          { label: "Profit Margin", value: "31.2%", icon: PieChart, color: "text-violet-400" },
          { label: "Revenue/Employee", value: "₹2.74L", icon: Users, color: "text-amber-400" },
        ].map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span></div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Department Profitability (₹L)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptProfit} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
              <XAxis dataKey="dept" tick={{ fill: "#6b7fa8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }} />
              <Bar key="bar-revenue" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar key="bar-cost" dataKey="cost" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Employee KPI Scorecards</h3>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 200 }}>
            {kpis.map(k => (
              <div key={k.name} className="flex items-center gap-3 px-3 py-2.5 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                <Avatar initials={k.name.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{k.name}</p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{k.role}</p>
                </div>
                <span className="text-xs font-['Geist_Mono'] text-[#a8b5d1]">{k.revenue}</span>
                <span className={`text-xs font-['Geist_Mono'] ${k.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>{k.roi}</span>
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold font-['Geist_Mono']"
                  style={{ borderColor: k.score > 85 ? "#10b981" : k.score > 75 ? "#6366f1" : "#f59e0b", color: k.score > 85 ? "#10b981" : k.score > 75 ? "#6366f1" : "#f59e0b" }}>
                  {k.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HRMSView() {
  const [tab, setTab] = useState("overview");
  const { data: dbLeaves, refresh: refreshDbLeaves } = useLeaveRequests();
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const [viewingLeave, setViewingLeave] = useState<typeof dbLeaves[0] | null>(null);
  const { data: profiles } = useEmployeeProfiles();

  const totalEmployees = profiles.length;
  const todayStr = new Date().toISOString().split("T")[0];
  const onLeaveToday = dbLeaves.filter(l => 
    l.status === "Approved" && 
    l.startDate <= todayStr && 
    l.endDate >= todayStr
  ).length;

  const filteredDbLeaves = useMemo(() => {
    return dbLeaves.filter(l => leaveFilterStatus === "All" || l.status === leaveFilterStatus);
  }, [dbLeaves, leaveFilterStatus]);

  const handleUpdateLeave = async (id: string, status: "Approved" | "Rejected", leaveDetails?: { employeeId: string; employeeName: string; leaveType: string }) => {
    try {
      await updateLeaveStatus(id, status, leaveDetails);
      refreshDbLeaves();
    } catch (e) {
      console.error("Failed to update leave:", e);
    }
  };

  const tabs = [{ id: "overview", label: "Overview" }, { id: "leave", label: "Leave Requests" }];
  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-['Plus_Jakarta_Sans'] transition-all ${tab === t.id ? "bg-indigo-600 text-white" : "text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Employees", value: totalEmployees.toString(), icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10" },
              { label: "On Leave Today", value: onLeaveToday.toString(), icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" }
            ].map(s => (
              <div key={s.label} className="bg-[#0f1528]/80 backdrop-blur-xl border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)] hover:border-indigo-500/40 transition-all duration-300 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${s.bg}`}>
                    <s.icon size={16} className={s.color} />
                  </div>
                  <p className="text-xs text-[#8b99b8] font-['Plus_Jakarta_Sans'] font-medium">{s.label}</p>
                </div>
                <p className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "leave" && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Leave Requests</h3>
            <div className="flex items-center gap-3">
              <button onClick={refreshDbLeaves} className="text-xs text-[#6b7fa8] hover:text-white transition-colors">Refresh</button>
            </div>
          </div>
          
          <div className="flex gap-2 mb-4">
            {(["All", "Pending", "Approved", "Rejected"] as const).map(s => (
              <button key={s} onClick={() => setLeaveFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] transition-all ${leaveFilterStatus === s ? "bg-[#1e2746] text-white border border-[rgba(99,102,241,0.3)]" : "bg-[#131a35] text-[#6b7fa8] border border-[rgba(99,102,241,0.08)] hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>

          {filteredDbLeaves.length === 0 ? (
            <DataEmpty message={`No ${leaveFilterStatus !== "All" ? leaveFilterStatus.toLowerCase() + " " : ""}leave requests found.`} />
          ) : (
            <div className="space-y-2">
              {filteredDbLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-4 px-4 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                  <Avatar initials={l.employeeName.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{l.employeeName}</p>
                    <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{l.leaveType} · {l.days}d from {l.startDate} to {l.endDate}</p>
                    {l.reason && <p className="text-[10px] text-[#6b7fa8]/80 mt-0.5 italic">"{l.reason}"</p>}
                  </div>
                  <Badge variant={l.status === "Approved" ? "green" : l.status === "Pending" ? "yellow" : "red"}>{l.status}</Badge>
                  <div className="flex items-center gap-2">
                    {l.status === "Pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => void handleUpdateLeave(l.id, "Approved", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType })} className="text-[10px] font-['Geist_Mono'] text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">Approve</button>
                        <button onClick={() => void handleUpdateLeave(l.id, "Rejected", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType })} className="text-[10px] font-['Geist_Mono'] text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors">Reject</button>
                      </div>
                    )}
                    <button onClick={() => setViewingLeave(l)} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] border border-[rgba(99,102,241,0.2)] px-2.5 py-1 rounded-lg hover:text-white hover:bg-white/5 transition-colors">View</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setViewingLeave(null)}>
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(99,102,241,0.1)]">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Leave Request Details</h3>
              <button type="button" onClick={() => setViewingLeave(null)} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Employee</p>
                <p className="text-sm text-white font-semibold">{viewingLeave.employeeName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Leave Type</p>
                  <p className="text-sm text-white">{viewingLeave.leaveType}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Status</p>
                  <Badge variant={viewingLeave.status === "Approved" ? "green" : viewingLeave.status === "Pending" ? "yellow" : "red"}>{viewingLeave.status}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">Start Date</p>
                  <p className="text-sm text-white">{viewingLeave.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b7fa8] mb-1">End Date</p>
                  <p className="text-sm text-white">{viewingLeave.endDate}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Duration</p>
                <p className="text-sm text-white">{viewingLeave.days} Day(s)</p>
              </div>
              <div>
                <p className="text-xs text-[#6b7fa8] mb-1">Detailed Reason</p>
                <div className="bg-[#131a35] rounded-xl p-3 border border-[rgba(99,102,241,0.08)]">
                  <p className="text-sm text-[#e2e8f7] whitespace-pre-wrap">{viewingLeave.reason || "No reason provided."}</p>
                </div>
              </div>
              
              {viewingLeave.status === "Pending" && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { void handleUpdateLeave(viewingLeave.id, "Approved", { employeeId: viewingLeave.employeeId, employeeName: viewingLeave.employeeName, leaveType: viewingLeave.leaveType }); setViewingLeave(null); }} className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 py-2.5 rounded-xl text-sm font-semibold transition-colors">Approve</button>
                  <button onClick={() => { void handleUpdateLeave(viewingLeave.id, "Rejected", { employeeId: viewingLeave.employeeId, employeeName: viewingLeave.employeeName, leaveType: viewingLeave.leaveType }); setViewingLeave(null); }} className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2.5 rounded-xl text-sm font-semibold transition-colors">Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
