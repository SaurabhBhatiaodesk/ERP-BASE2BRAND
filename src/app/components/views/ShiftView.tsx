import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Brain, AlertTriangle, Star, ArrowUpRight, Calendar,
  CheckSquare, Monitor, Globe, Timer, Clock, Zap, Activity,
  Users, WifiOff, Coffee, MapPin, X, ChevronLeft, ChevronRight, Search,
  Crown, LayoutGrid,
} from "lucide-react";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";
import { useEmployeeProfiles, useProjectTasks } from "@/hooks/useSupabaseData";
import {
  CLOCK_SESSIONS_SETUP_MSG,
  fetchTodayTeamClockSessions,
  fetchTeamClockSessionsByDate,
  initialsFromName,
  isClockSessionsTableReady,
  isTaskInKanbanListForDate,
  clockSessionsToAttendanceWindows,
  findProfileForUser,
  type AttendanceTimeWindow,
  type ClockSessionRecord,
  type AppTask,
  clockOutEmployee,
} from "@/lib/database";
import {
  buildShiftEmployee,
  buildShiftInsights,
  currentShiftNowMin,
  formatDurationMinutes,
  listPauseBlocks,
  timelineDuration,
} from "@/lib/shiftTimeline";
import {
  aggregateStageSeconds,
  buildProportionalStageSegments,
  computeTaskStageTotals,
  formatClockInLive,
  formatStageDuration,
  formatStageEnteredAt,
  getAllStageEntries,
  listTrackedTasksForEmployee,
  listWorkTasksForEmployee,
  shortStageLabel,
  stageMeta,
  STAGE_ORDER,
  type ShiftActiveTask,
} from "@/lib/taskStageTime";
import { playBeep } from "@/lib/audio";
import { useEmployeeVisualHistory } from "./useEmployeeVisualHistory";
import { ScreenshotsView } from "./ScreenshotsView";

export type ActivityKind = "working" | "break" | "idle" | "meeting" | "login" | "offline";

export type TimelineBlock = {
  kind: ActivityKind;
  label: string;
  start: number;
  end: number | null;
  app?: string;
};

export type ShiftEmployee = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  dept: string;
  shiftStartMin: number;
  shiftEndMin: number;
  shiftStartLabel: string;
  shiftEndLabel: string;
  loginTime: string;
  /** ISO timestamp — for live elapsed since clock-in */
  clockInAt: string | null;
  lastActiveAt?: string | null;
  idleDurationMins?: number;
  currentTask: string;
  currentApp: string;
  currentScreen: string;
  activeFor: string;
  productivity: number;
  status: ActivityKind;
  location: string;
  completionEst: string;
  lateStart: boolean;
  timeline: TimelineBlock[];
  /** In Progress only — real work started */
  workTasks: ShiftActiveTask[];
  /** All open tasks — each with own Kanban stage time */
  trackedTasks: ShiftActiveTask[];
};

/** Team view axis — earliest shift 10 AM, latest end 12 PM + 9h = 9 PM */
export const TIMELINE_AXIS_START = 10 * 60;
export const SHIFT_HOURS = 9;
export const SHIFT_DURATION = SHIFT_HOURS * 60;
export const TIMELINE_AXIS_END = 12 * 60 + SHIFT_DURATION;
export const TIMELINE_AXIS_DURATION = TIMELINE_AXIS_END - TIMELINE_AXIS_START;

/** @deprecated use TIMELINE_AXIS_START */
export const SHIFT_START = TIMELINE_AXIS_START;

export function hhmm(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export function clockMinutesToLabel(clockMin: number) {
  return hhmm(Math.floor(clockMin / 60), Math.floor(clockMin % 60));
}

export function isoToTimelineMinutes(iso: string) {
  const d = new Date(iso);
  // Use fractional minutes (include seconds) for accuracy in duration display
  const clockMinFractional = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  return Math.max(0, Math.min(TIMELINE_AXIS_DURATION, clockMinFractional - TIMELINE_AXIS_START));
}

export function currentTimelineNowMin() {
  const now = new Date();
  const clockMinFractional = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.max(0, Math.min(TIMELINE_AXIS_DURATION, clockMinFractional - TIMELINE_AXIS_START));
}

export function minToLabel(min: number) {
  return clockMinutesToLabel(TIMELINE_AXIS_START + min);
}

export function shiftWindowOnAxis(emp: ShiftEmployee) {
  const left = ((emp.shiftStartMin - TIMELINE_AXIS_START) / TIMELINE_AXIS_DURATION) * 100;
  const width = ((emp.shiftEndMin - emp.shiftStartMin) / TIMELINE_AXIS_DURATION) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0, Math.min(100 - left, width)),
  };
}

/** Hour labels for the team timeline header (10 AM … 9 PM). */
export function timelineHourLabels(compact = true) {
  const labels: string[] = [];
  for (let clock = TIMELINE_AXIS_START; clock <= TIMELINE_AXIS_END; clock += 60) {
    const h = Math.floor(clock / 60);
    if (!compact) {
      labels.push(clockMinutesToLabel(clock));
      continue;
    }
    if (h === 12) labels.push("12PM");
    else if (h < 12) labels.push(`${h}AM`);
    else labels.push(`${h - 12}PM`);
  }
  return labels;
}

export type ShiftDeptFilter =
  | "all"
  | "digital-marketing"
  | "development"
  | "sales"
  | "csr"
  | "hr"
  | "tl";

type ShiftFilterOption = {
  id: ShiftDeptFilter;
  label: string;
  group: "all" | "team" | "leadership";
  activeClass: string;
};

export const SHIFT_DEPT_OPTIONS: ShiftFilterOption[] = [
  { id: "all", label: "All Teams", group: "all", activeClass: "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25" },
  { id: "digital-marketing", label: "Digital Marketing", group: "team", activeClass: "bg-cyan-600/90 text-white border-cyan-500/50 shadow-lg shadow-cyan-500/20" },
  { id: "development", label: "Development", group: "team", activeClass: "bg-violet-600/90 text-white border-violet-500/50 shadow-lg shadow-violet-500/20" },
  { id: "sales", label: "Sales", group: "team", activeClass: "bg-emerald-600/90 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/20" },
  { id: "csr", label: "CSR", group: "team", activeClass: "bg-sky-600/90 text-white border-sky-500/50 shadow-lg shadow-sky-500/20" },
  { id: "hr", label: "HR", group: "team", activeClass: "bg-amber-600/90 text-white border-amber-500/50 shadow-lg shadow-amber-500/20" },
  { id: "tl", label: "Team Lead", group: "leadership", activeClass: "bg-fuchsia-600/90 text-white border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/20" },
];

function profileMatchesShiftDeptFilter(dept: string, filter: ShiftDeptFilter): boolean {
  const d = dept.trim().toLowerCase();
  switch (filter) {
    case "digital-marketing":
      return /marketing|digital|design|mktg|content|seo|social|brand/.test(d);
    case "development":
      return /develop|dev|engineer|software|tech|frontend|backend|full.?stack|qa|testing/.test(d);
    case "sales":
      return /sales|business development|\bbd\b/.test(d);
    case "csr":
      return /csr|customer service|customer support|client service|support team|operations support/.test(d);
    case "hr":
      return /\bhr\b|human resource|people ops|hr &|recruitment|payroll/.test(d);
    default:
      return true;
  }
}

function profileMatchesTeamLeadFilter(profile: { role: string; appRole?: string }): boolean {
  const role = profile.role.trim().toLowerCase();
  const appRole = (profile.appRole || "").trim().toLowerCase();
  return (
    appRole === "teamlead" ||
    /\bteam lead\b|\bteam leader\b|\btl\b|\btech lead\b|\bdev lead\b|\blead developer\b/.test(role)
  );
}

export function profileMatchesShiftFilter(
  profile: { dept: string; role: string; appRole?: string },
  filter: ShiftDeptFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "tl") return profileMatchesTeamLeadFilter(profile);
  return profileMatchesShiftDeptFilter(profile.dept, filter);
}

/** Total task time across all days — matches employee Kanban cards. */
function cumulativeTaskStageTotals(
  task: Pick<ShiftActiveTask, "stageHistory" | "status" | "statusEnteredAt">,
  assigneeId?: string,
  attendanceSessions?: AttendanceTimeWindow[],
) {
  return computeTaskStageTotals(task.stageHistory, task.status, task.statusEnteredAt, {
    assigneeId,
    attendanceSessions,
  });
}

/** One calendar day — for history audit and “did this task run on this date?” filters. */
function dailyTaskStageTotals(
  task: Pick<ShiftActiveTask, "stageHistory" | "status" | "statusEnteredAt">,
  targetDate: string | undefined,
  assigneeId?: string,
  attendanceSessions?: AttendanceTimeWindow[],
) {
  return computeTaskStageTotals(task.stageHistory, task.status, task.statusEnteredAt, {
    targetDate,
    assigneeId,
    attendanceSessions,
  });
}

export function TaskStageGrid({
  task,
  compact = false,
  large = false,
  targetDate,
}: {
  task: ShiftActiveTask;
  compact?: boolean;
  large?: boolean;
  targetDate?: string;
}) {
  const totals = aggregateStageSeconds(task.stageHistory, task.status, task.statusEnteredAt, undefined);
  const rows = getAllStageEntries(task.status, totals);

  function stageUi(status: string) {
    switch (status) {
      case "todo":
        return {
          bg: "bg-slate-500/10",
          border: "border-slate-500/25",
          text: "text-slate-300",
        };
      case "in-progress":
        return {
          bg: "bg-indigo-500/10",
          border: "border-indigo-500/25",
          text: "text-indigo-300",
        };
      case "ready-for-testing":
        return {
          bg: "bg-violet-500/10",
          border: "border-violet-500/25",
          text: "text-violet-300",
        };
      case "review":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/25",
          text: "text-amber-300",
        };
      case "done":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/25",
          text: "text-emerald-300",
        };
      default:
        return {
          bg: "bg-[#0a1020]",
          border: "border-[rgba(99,102,241,0.12)]",
          text: "text-[#8fa0c4]",
        };
    }
  }

  return (
    <div className={`grid grid-cols-5 ${compact ? "gap-0.5" : "gap-1"}`}>
      {rows.map(entry => {
        const meta = stageMeta[entry.status as (typeof STAGE_ORDER)[number]];
        const ui = stageUi(entry.status);
        const showAccent = entry.isCurrent || entry.seconds > 0;
        return (
          <div
            key={entry.status}
            title={`${entry.label}: ${formatStageDuration(entry.seconds)}${entry.isCurrent ? (task.statusEnteredAt === "paused" ? " (paused)" : " (live)") : ""}`}
            className={`rounded-md border text-center ${
              showAccent ? `${ui.border} ${ui.bg}` : "border-[rgba(99,102,241,0.12)] bg-[#0a1020]"
            } ${compact ? "px-0.5 py-1" : "px-1 py-1.5"}`}
          >
            <p
              className={`font-['Geist_Mono'] truncate ${
                showAccent ? ui.text : "text-[#8fa0c4]"
              } ${compact ? "text-[7px]" : "text-[8px]"}`}
            >
              {meta?.label ?? entry.label}
            </p>
            <p
              className={`font-bold font-['Geist_Mono'] truncate ${
                compact ? "text-[8px]" : "text-[9px]"
              } ${showAccent ? ui.text : "text-white"}`}
            >
              {formatStageDuration(entry.seconds)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function TaskStageList({ tasks, max = 4, large = false, targetDate }: { tasks: ShiftActiveTask[]; max?: number; large?: boolean; targetDate?: string; }) {
  if (tasks.length === 0) {
    return <p className={`text-[#6b7fa8] font-['Geist_Mono'] ${large ? "text-xs" : "text-[10px]"}`}>—</p>;
  }
  const todoCount = tasks.filter(t => t.status === "todo").length;
  const shown = tasks.slice(0, max);
  return (
    <div className={large ? "space-y-3" : "space-y-2"}>
      {todoCount > 1 && (
        <p className={`font-['Geist_Mono'] text-slate-400 ${large ? "text-[11px]" : "text-[9px]"}`}>
          {todoCount} tasks in To Do
        </p>
      )}
      {shown.map(task => (
        <div
          key={task.taskId}
          className={`min-w-0 rounded-xl border border-[rgba(99,102,241,0.14)] bg-[#0a1020]/90 ${
            large ? "px-3 py-2.5 shadow-sm shadow-black/20" : "px-2 py-1.5"
          }`}
        >
          <p className={`text-white font-['Plus_Jakarta_Sans'] font-semibold leading-snug mb-1.5 ${
            large ? "text-xs" : "text-[10px]"
          }`}>
            {task.title}
          </p>
          <TaskStageGrid task={task} compact={!large} targetDate={targetDate} />
        </div>
      ))}
      {tasks.length > max && (
        <p className={`font-['Geist_Mono'] text-[#6b7fa8] ${large ? "text-[11px]" : "text-[9px]"}`}>
          +{tasks.length - max} more task{tasks.length - max === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function TaskStageDetail({
  task,
  compact = false,
  large = false,
  assigneeId,
  attendanceSessions,
}: {
  task: ShiftActiveTask;
  compact?: boolean;
  large?: boolean;
  assigneeId?: string;
  attendanceSessions?: AttendanceTimeWindow[];
}) {
  const totals = cumulativeTaskStageTotals(task, assigneeId, attendanceSessions);

  const rows = getAllStageEntries(task.status, totals);

  function stageUi(status: string) {
    switch (status) {
      case "todo":
        return {
          bg: "bg-slate-500/10",
          border: "border-slate-500/25",
          text: "text-slate-300",
        };
      case "in-progress":
        return {
          bg: "bg-indigo-500/10",
          border: "border-indigo-500/25",
          text: "text-indigo-300",
        };
      case "ready-for-testing":
        return {
          bg: "bg-violet-500/10",
          border: "border-violet-500/25",
          text: "text-violet-300",
        };
      case "review":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/25",
          text: "text-amber-300",
        };
      case "done":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/25",
          text: "text-emerald-300",
        };
      default:
        return {
          bg: "bg-[#0a1020]",
          border: "border-[rgba(99,102,241,0.12)]",
          text: "text-[#8fa0c4]",
        };
    }
  }

  return (
    <div className={`rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] ${
      large ? "p-5 space-y-4" : compact ? "p-4 space-y-3" : "p-4 space-y-3 m-6 mb-0"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Timer size={large ? 18 : 14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className={`font-semibold text-white font-['Plus_Jakarta_Sans'] ${large ? "text-sm leading-snug" : "text-xs truncate"}`}>
              {task.title}
            </p>
            <p className={`text-[#8fa0c4] font-['Geist_Mono'] mt-1 ${large ? "text-xs" : "text-[10px]"}`}>
              {task.project} · {shortStageLabel(task.status)}
            </p>
          </div>
        </div>
        <span className={`font-['Geist_Mono'] text-amber-300 shrink-0 ${large ? "text-xs" : "text-[10px]"}`}>
          Kanban stage time
        </span>
      </div>
      {!large && <TaskStageGrid task={task} />}
      <div className={`grid gap-3 ${large ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-5 gap-2.5"}`}>
        {rows.map(entry => {
          const ui = stageUi(entry.status);
          const showAccent = entry.isCurrent || entry.seconds > 0;
          
          let enteredDateStr: string | null = null;
          const historyRow = task.stageHistory.find(r => r.to_status === entry.status);
          
          if (historyRow) {
             enteredDateStr = historyRow.entered_at;
          } else if (entry.isCurrent && task.statusEnteredAt && task.statusEnteredAt !== "paused") {
             enteredDateStr = task.statusEnteredAt;
          } else if (entry.status === "todo" && task.stageHistory.length === 0) {
             enteredDateStr = task.statusEnteredAt !== "paused" ? task.statusEnteredAt : null;
          }

          let formattedDate = "";
          if (enteredDateStr) {
            const d = new Date(enteredDateStr);
            if (!Number.isNaN(d.getTime())) {
               formattedDate = d.toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            }
          }

          return (
            <div
              key={entry.status}
              className={`bg-[#111828] rounded-xl border ${
                showAccent ? `${ui.border} ${ui.bg}` : "border-[rgba(99,102,241,0.12)]"
              } ${large ? "px-4 py-3" : "px-3 py-2.5"}`}
            >
              <p
                className={`font-['Plus_Jakarta_Sans'] ${large ? "text-xs" : "text-[11px]"} ${
                  showAccent ? ui.text : "text-[#8fa0c4]"
                }`}
              >
                {entry.label}
              </p>
              <p
                className={`font-bold font-['Geist_Mono'] mt-1 ${
                  large ? "text-lg" : "text-base"
                } ${showAccent ? ui.text : "text-white"}`}
              >
                {formatStageDuration(entry.seconds)}
                {entry.isCurrent ? (task.statusEnteredAt === "paused" ? " · paused" : <><span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span></>) : ""}
              </p>
              {formattedDate && (
                <p className={`font-['Geist_Mono'] mt-1.5 ${large ? "text-[10px]" : "text-[9px]"} ${showAccent ? ui.text : "text-[#6b7fa8]"} opacity-75 truncate`} title={formattedDate}>
                  {formattedDate}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const kindMeta: Record<ActivityKind, { color: string; bg: string; dot: string; label: string }> = {
  working: { color: "text-indigo-400", bg: "bg-indigo-500",  dot: "bg-indigo-400",  label: "Working" },
  break:   { color: "text-amber-400",  bg: "bg-amber-500",   dot: "bg-amber-400",   label: "Break" },
  idle:    { color: "text-red-400",    bg: "bg-red-500",     dot: "bg-red-400",     label: "Idle" },
  meeting: { color: "text-violet-400", bg: "bg-violet-500",  dot: "bg-violet-400",  label: "Meeting" },
  login:   { color: "text-emerald-400",bg: "bg-emerald-500", dot: "bg-emerald-400", label: "Login" },
  offline: { color: "text-slate-400",  bg: "bg-slate-600",   dot: "bg-slate-400",   label: "Offline" },
};

function TaskStageBar({
  task,
  shiftWindow,
  nowMin,
  assigneeId,
  attendanceSessions,
}: {
  task: ShiftActiveTask;
  shiftWindow: { left: number; width: number };
  nowMin: number;
  assigneeId?: string;
  attendanceSessions?: AttendanceTimeWindow[];
}) {
  const totals = cumulativeTaskStageTotals(task, assigneeId, attendanceSessions);

  const segments = buildProportionalStageSegments(totals);
  const currentStageMeta = stageMeta[task.status as (typeof STAGE_ORDER)[number]];

  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <p
          className="text-[10px] font-semibold text-white truncate font-['Plus_Jakarta_Sans'] flex-1 min-w-0"
          title={`${task.title}${task.project ? ` (${task.project})` : ''}`}
        >
          {task.title}
          {task.project && (
            <span className="ml-2 font-normal text-[#8fa0c4] font-['Geist_Mono']">
              {task.project}
            </span>
          )}
        </p>
        <span
          className={`shrink-0 text-[8px] font-['Geist_Mono'] px-1.5 py-0.5 rounded border ${
            currentStageMeta?.bg
              ? `${currentStageMeta.color} border-current/25 bg-current/10`
              : "text-amber-300 border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {shortStageLabel(task.status)}
        </span>
      </div>
      <div className="relative h-5 bg-[#111828] rounded-md overflow-hidden">
        {segments.length > 0 ? (
          <div
            className="absolute top-0.5 bottom-0.5 flex rounded-sm overflow-hidden ring-1 ring-white/10"
            style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
          >
            {segments.map(seg => {
              const meta = stageMeta[seg.status as (typeof STAGE_ORDER)[number]];
              return (
                <div
                  key={seg.status}
                  className={`h-full ${meta?.bg ?? "bg-slate-500"} opacity-90 flex flex-col items-center justify-center overflow-hidden border-r border-black/20 last:border-r-0`}
                  style={{ width: `${seg.percent}%`, minWidth: seg.percent > 0 ? "4px" : undefined }}
                  title={`${task.title} · ${seg.label}: ${formatStageDuration(seg.seconds)}`}
                >
                  {seg.percent >= 16 && (
                    <span className="text-[9px] text-white font-['Geist_Mono'] truncate px-1 font-bold leading-none drop-shadow-md tracking-wide">
                      {formatStageDuration(seg.seconds)}
                    </span>
                  )}
                  {seg.percent >= 20 && (
                    <span className="text-[8px] text-white/95 font-['Geist_Mono'] truncate px-1 font-medium leading-none mt-0.5 drop-shadow-md tracking-wider uppercase">
                      {seg.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="absolute top-0.5 bottom-0.5 rounded-sm bg-slate-700/30 border border-dashed border-slate-600/40"
            style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
            title={`${task.title} A no stage time yet`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {getAllStageEntries(task.status, totals).map(entry => {
          const meta = stageMeta[entry.status as (typeof STAGE_ORDER)[number]];
          if (entry.seconds <= 0 && !entry.isCurrent) return null;
          return (
            <span
              key={entry.status}
              className={`inline-flex items-center gap-1.5 text-[10px] font-medium font-['Geist_Mono'] tracking-wide ${
                meta?.color ? `${meta.color} ${entry.isCurrent ? "" : "opacity-80"}` : "text-[#8fa0c4]"
              }`}
            >
              <span className={`w-2 h-2 rounded-[3px] shrink-0 ${meta?.bg ?? "bg-slate-500"}`} />
              {entry.label} {formatStageDuration(entry.seconds)}
              {entry.isCurrent ? (task.statusEnteredAt === "paused" ? " · paused" : <><span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">live</span></>) : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function StageTimelineBar({
  emp,
  nowMin,
  targetDate,
  attendanceSessions,
  allTasks,
}: {
  emp: ShiftEmployee;
  nowMin: number;
  targetDate?: string;
  attendanceSessions?: AttendanceTimeWindow[];
  allTasks?: AppTask[];
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const shiftWindow = shiftWindowOnAxis(emp);
  const hourMarks = Array.from({ length: TIMELINE_AXIS_DURATION / 60 + 1 }, (_, i) => i * 60).slice(1, -1);
  
  const kanbanTaskIds = useMemo(() => {
    if (!targetDate || !allTasks?.length) return null;
    return new Set(
      allTasks
        .filter(t =>
          (t.assigneeId === emp.id ||
            (!t.assigneeId && t.assignee.trim().toLowerCase() === emp.name.trim().toLowerCase())) &&
          isTaskInKanbanListForDate(t, targetDate)
        )
        .map(t => t.taskId)
    );
  }, [allTasks, emp.id, emp.name, targetDate]);
  
  const sortedTasks = useMemo(() => {
    const merged = new Map<string, ShiftActiveTask>();
    for (const task of emp.trackedTasks || []) merged.set(task.taskId, task);
    for (const task of emp.workTasks || []) merged.set(task.taskId, task);

    const list = [...merged.values()].filter(task => {
      const isInProgress = task.status === "in-progress";
      // In-progress work always shows on shift tracker — even if task_date is an older day.
      if (!isInProgress && kanbanTaskIds && !kanbanTaskIds.has(task.taskId)) return false;
      const totals = dailyTaskStageTotals(
        task,
        targetDate,
        emp.id,
        attendanceSessions,
      );
      if (isInProgress) return true;
      return Object.values(totals).reduce((a, b) => a + b, 0) > 0;
    });
    return list.sort((a, b) => {
      const aProg = a.status === "in-progress" ? 1 : 0;
      const bProg = b.status === "in-progress" ? 1 : 0;
      if (aProg !== bProg) return bProg - aProg;

      const aTotals = cumulativeTaskStageTotals(a, emp.id, attendanceSessions);
      const bTotals = cumulativeTaskStageTotals(b, emp.id, attendanceSessions);
      
      const aHasInProgress = (aTotals["in-progress"] || 0) > 0 ? 1 : 0;
      const bHasInProgress = (bTotals["in-progress"] || 0) > 0 ? 1 : 0;
      
      return bHasInProgress - aHasInProgress;
    });
  }, [emp.trackedTasks, emp.workTasks, emp.id, targetDate, attendanceSessions, kanbanTaskIds]);

  const totalPages = Math.ceil(sortedTasks.length / PAGE_SIZE);
  const visibleTasks = sortedTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2 relative min-w-0 h-full justify-center">
      <div className="relative space-y-2.5 min-w-0">
        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
          {hourMarks.map(m => (
            <div
              key={m}
              className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
              style={{ left: `${(m / TIMELINE_AXIS_DURATION) * 100}%` }}
            />
          ))}
          <div
            className="absolute top-0 bottom-0 bg-indigo-500/[0.04] border-x border-indigo-400/10"
            style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
            style={{ left: `${Math.min((nowMin / TIMELINE_AXIS_DURATION) * 100, 100)}%` }}
          />
        </div>
        {visibleTasks.length > 0 ? (
          visibleTasks.map(task => (
          <TaskStageBar
            key={task.taskId}
            task={task}
            shiftWindow={shiftWindow}
            nowMin={nowMin}
            assigneeId={emp.id}
            attendanceSessions={attendanceSessions}
          />
        ))
      ) : (
        <div className="relative h-8 bg-[#111828] rounded-lg overflow-hidden">
          <div
            className="absolute top-1 bottom-1 rounded-sm bg-slate-700/30 border border-dashed border-slate-600/40"
            style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
            title="No tasks assigned"
          />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-start items-center gap-2 mt-2">
          <button 
            disabled={page === 1} 
            onClick={(e) => { e.stopPropagation(); setPage(p => p - 1); }}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[#8fa0c4] hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] font-['Geist_Mono'] text-[#8fa0c4]">
            {page} / {totalPages}
          </span>
          <button 
            disabled={page === totalPages} 
            onClick={(e) => { e.stopPropagation(); setPage(p => p + 1); }}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[#8fa0c4] hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function TimelineBar({ emp, nowMin }: { emp: ShiftEmployee; nowMin: number }) {
  const shiftWindow = shiftWindowOnAxis(emp);
  const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, TIMELINE_AXIS_DURATION);
  const hourMarks = Array.from({ length: TIMELINE_AXIS_DURATION / 60 + 1 }, (_, i) => i * 60).slice(1, -1);
  const pauseBlocks = listPauseBlocks(emp.timeline, effectiveNow);

  return (
    <div className="space-y-1">
    <div className="relative h-8 bg-[#111828] rounded-lg overflow-hidden">
      <div
        className="absolute top-0 bottom-0 bg-indigo-500/5 border-x border-indigo-400/10"
        style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
        title={`Shift ${emp.shiftStartLabel} – ${emp.shiftEndLabel} (${SHIFT_HOURS}h)`}
      />
      {hourMarks.map(m => (
        <div key={m} className="absolute top-0 bottom-0 w-px bg-white/5"
          style={{ left: `${(m / TIMELINE_AXIS_DURATION) * 100}%` }} />
      ))}
      {emp.timeline.filter(b => b.kind !== "login").map((block, i) => {
        const s = (block.start / TIMELINE_AXIS_DURATION) * 100;
        const endMin = block.end ?? effectiveNow;
        const w = ((endMin - block.start) / TIMELINE_AXIS_DURATION) * 100;
        const meta = kindMeta[block.kind];
        const isOngoing = block.end === null;
        const dur = Math.max(0, endMin - block.start);
        const durLabel = formatDurationMinutes(dur);
        return (
          <div
            key={i}
            className={`absolute top-1 bottom-1 rounded-sm ${meta.bg} ${isOngoing ? "opacity-95 ring-1 ring-white/20" : "opacity-75"} flex items-center justify-center ${block.kind === "idle" ? "" : "overflow-hidden"}`}
            style={{ left: `${s}%`, width: `${w}%`, minWidth: "1px" }}
            title={`${block.label}: ${minToLabel(block.start)} - ${block.end ? minToLabel(block.end) : "Now"} (${durLabel})`}
          />
        );
      })}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
        style={{ left: `${Math.min((nowMin / TIMELINE_AXIS_DURATION) * 100, 100)}%` }} />
    </div>
    </div>
  );
}

export function EmployeeDetailPanel({
  emp,
  onClose,
  nowMin,
  allTasks,
  targetDate,
  attendanceSessions,
}: {
  emp: ShiftEmployee;
  onClose: () => void;
  nowMin: number;
  allTasks: AppTask[];
  targetDate: string;
  attendanceSessions?: AttendanceTimeWindow[];
}) {
  const [tab, setTab] = useState<"live" | "history" | "screenshots">("live");
  const [historyRange, setHistoryRange] = useState<number>(7);
  const [page, setPage] = useState(1);
  const [taskStageDate, setTaskStageDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [, setTaskStageTick] = useState(0);
  const { historyDays, loading: historyLoading } = useEmployeeVisualHistory(emp, historyRange, allTasks);

  const todayIso = new Date().toLocaleDateString("en-CA");
  const isTaskStageToday = taskStageDate === todayIso;

  useEffect(() => {
    setTaskStageDate(targetDate);
  }, [targetDate, emp.id]);

  useEffect(() => {
    if (!isTaskStageToday) return;
    const id = setInterval(() => setTaskStageTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isTaskStageToday]);

  const PAGE_SIZE = 7;
  const totalPages = Math.ceil(historyDays.length / PAGE_SIZE);
  const visibleDays = historyDays.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tasksForToday = useMemo(() => {
    const kanbanTaskIds = new Set(
      allTasks
        .filter(t =>
          (t.assigneeId === emp.id ||
            (!t.assigneeId && t.assignee.trim().toLowerCase() === emp.name.trim().toLowerCase())) &&
          isTaskInKanbanListForDate(t, taskStageDate)
        )
        .map(t => t.taskId)
    );

    const activeTasks = emp.trackedTasks.filter(task => kanbanTaskIds.has(task.taskId));

    return activeTasks.sort((a, b) => {
      const aIsInProgress = a.status === "in-progress" ? 1 : 0;
      const bIsInProgress = b.status === "in-progress" ? 1 : 0;
      if (aIsInProgress !== bIsInProgress) return bIsInProgress - aIsInProgress;

      const aTotals = cumulativeTaskStageTotals(a, emp.id, attendanceSessions);
      const bTotals = cumulativeTaskStageTotals(b, emp.id, attendanceSessions);
      
      const aHasInProgress = (aTotals["in-progress"] || 0) > 0 ? 1 : 0;
      const bHasInProgress = (bTotals["in-progress"] || 0) > 0 ? 1 : 0;
      
      return bHasInProgress - aHasInProgress;
    });
  }, [emp.trackedTasks, emp.id, emp.name, allTasks, taskStageDate, attendanceSessions]);

  const taskStageDateLabel = useMemo(() => {
    const [y, m, d] = taskStageDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [taskStageDate]);

  const shiftStartAxis = Math.max(0, emp.shiftStartMin - TIMELINE_AXIS_START);
  const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, TIMELINE_AXIS_DURATION);
  const window = { start: shiftStartAxis, end: effectiveNow };

  const worked = timelineDuration(emp.timeline, "working", effectiveNow, window);
  const idle = timelineDuration(emp.timeline, "idle", effectiveNow, window);
  const meetings = timelineDuration(emp.timeline, "meeting", effectiveNow, window);
  const breaks = timelineDuration(emp.timeline, "break", effectiveNow, window);

  const pauseBlocks = listPauseBlocks(emp.timeline, effectiveNow);

  const fmtMin = formatDurationMinutes;
  const statusMeta = kindMeta[emp.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.25)] rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl shadow-indigo-950/40">
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[rgba(99,102,241,0.12)]">
          <div className="flex items-center gap-5">
            <Avatar initials={emp.avatar} size="lg" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{emp.name}</h2>
              <p className="text-sm text-[#8fa0c4] font-['Geist_Mono'] mt-0.5">{emp.role} · {emp.dept}</p>
              <div className="flex items-center flex-wrap gap-2 mt-2">
                <span className={`flex items-center gap-1.5 text-sm font-['Geist_Mono'] ${statusMeta.color}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dot} ${emp.status === "working" ? "animate-pulse" : ""}`} />
                  {statusMeta.label}
                </span>
                <span className="text-[#6b7fa8] text-sm">·</span>
                <span className="text-sm text-[#c5d0ea] flex items-center gap-1"><MapPin size={12} /> {emp.location}</span>
                {emp.lateStart && (
                  <span className="text-xs font-['Geist_Mono'] bg-red-500/15 text-red-400 border border-red-500/25 px-2.5 py-1 rounded-full">
                    Late Start
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/[0.06] rounded-xl transition-colors text-[#8fa0c4] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 sm:px-8 py-3 border-b border-[rgba(99,102,241,0.12)] flex items-center justify-between">
          <div className="flex gap-6">
            <button
              onClick={() => setTab("live")}
              className={`pb-3 text-sm font-['Geist_Mono'] font-medium uppercase tracking-wider transition-colors relative border-b-2 ${
                tab === "live" ? "border-indigo-500 text-indigo-400" : "border-transparent text-[#6b7fa8] hover:text-white"
              }`}
              style={{ marginBottom: "-13px" }}
            >
              Live Activity
            </button>
            <button
              onClick={() => setTab("history")}
              className={`pb-3 text-sm font-['Geist_Mono'] font-medium uppercase tracking-wider transition-colors relative border-b-2 ${
                tab === "history" ? "border-indigo-500 text-indigo-400" : "border-transparent text-[#6b7fa8] hover:text-white"
              }`}
              style={{ marginBottom: "-13px" }}
            >
              Visual History
            </button>
            <button
              onClick={() => setTab("screenshots")}
              className={`pb-3 text-sm font-['Geist_Mono'] font-medium uppercase tracking-wider transition-colors relative border-b-2 ${
                tab === "screenshots" ? "border-indigo-500 text-indigo-400" : "border-transparent text-[#6b7fa8] hover:text-white"
              }`}
              style={{ marginBottom: "-13px" }}
            >
              Screenshots
            </button>
          </div>
          
          {tab === "history" && (
            <select
              value={historyRange}
              onChange={(e) => {
                setHistoryRange(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[#0a1020] border border-[rgba(99,102,241,0.25)] text-[#c5d0ea] text-xs font-['Geist_Mono'] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/50"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          )}
        </div>

        {tab === "live" && (
          <>
            <div className="m-6 sm:m-8 mb-0 p-5 sm:p-6 bg-gradient-to-r from-indigo-600/10 to-violet-600/10 border border-indigo-500/25 rounded-2xl">
              <p className="text-xs font-['Geist_Mono'] text-indigo-400 uppercase tracking-widest mb-4">Live Activity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <CheckSquare size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[#8fa0c4] text-sm block">Current task</span>
                  <span className="text-white font-semibold font-['Plus_Jakarta_Sans'] text-sm leading-snug">
                    {emp.workTasks[0]?.title || "Not started (move to In Progress)"}
                  </span>
                </div>
              </div>
              {emp.trackedTasks.filter(t => t.status === "todo").length > 0 && (
                <div className="flex items-start gap-3">
                  <Timer size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[#8fa0c4] text-sm block">
                      Queued ({emp.trackedTasks.filter(t => t.status === "todo").length})
                    </span>
                    <div className="space-y-1 mt-1">
                      {emp.trackedTasks.filter(t => t.status === "todo").map(t => (
                        <p key={t.taskId} className="text-slate-200 text-sm font-['Geist_Mono'] leading-snug">{t.title}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Monitor size={16} className="text-violet-400 shrink-0" />
                <span className="text-[#8fa0c4] text-sm">App:</span>
                <span className="text-white text-sm">{emp.currentApp}</span>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <Globe size={16} className="text-cyan-400 shrink-0" />
                <span className="text-[#8fa0c4] text-sm shrink-0">Screen:</span>
                <span className="text-indigo-300 text-sm truncate font-['Geist_Mono']">{emp.currentScreen}</span>
              </div>
            </div>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <Timer size={16} className="text-emerald-400 shrink-0" />
                <span className="text-[#8fa0c4] text-sm">Active for:</span>
                <span className="text-emerald-400 font-['Geist_Mono'] text-base font-bold">{emp.activeFor}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-amber-400 shrink-0" />
                <span className="text-[#8fa0c4] text-sm">Shift ends:</span>
                <span className="text-white text-sm font-['Geist_Mono']">{emp.completionEst}</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap size={16} className="text-yellow-400 shrink-0" />
                <span className="text-[#8fa0c4] text-sm">Productivity:</span>
                <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                  <div className="flex-1 h-2 bg-[#131a35] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${emp.productivity >= 90 ? "bg-emerald-500" : emp.productivity >= 75 ? "bg-indigo-500" : "bg-amber-500"}`}
                      style={{ width: `${emp.productivity}%` }} />
                  </div>
                  <span className={`text-sm font-['Geist_Mono'] font-bold ${emp.productivity >= 90 ? "text-emerald-400" : emp.productivity >= 75 ? "text-indigo-400" : "text-amber-400"}`}>
                    {emp.productivity}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 m-6 sm:m-8 mb-0">
          {[
            { label: "Work Time", value: fmtMin(worked + meetings), color: "text-indigo-400", icon: Activity },
            { label: "Meetings", value: fmtMin(meetings), color: "text-violet-400", icon: Users },
            { label: "Breaks", value: fmtMin(breaks), color: "text-amber-400", icon: Coffee },
            { label: "Idle Time", value: fmtMin(idle), color: idle > 30 ? "text-red-400" : "text-slate-400", icon: WifiOff },
          ].map(s => (
            <div key={s.label} className="bg-[#111828] rounded-2xl p-4 sm:p-5 border border-[rgba(99,102,241,0.12)]">
              <s.icon size={18} className={`${s.color} mb-3`} />
              <div className={`text-xl font-bold font-['Plus_Jakarta_Sans'] ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[#8fa0c4] font-['Geist_Mono'] mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="m-6 sm:m-8 mb-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
              Daily Timeline · {emp.shiftStartLabel} → {emp.shiftEndLabel}
            </h3>
            <div className="flex items-center flex-wrap gap-3">
              {(["working","meeting","break","idle"] as ActivityKind[]).map(k => (
                <span key={k} className={`flex items-center gap-1.5 text-xs font-['Geist_Mono'] ${kindMeta[k].color}`}>
                  <span className={`w-2.5 h-2.5 rounded-sm ${kindMeta[k].bg}`} /> {kindMeta[k].label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-between text-xs font-['Geist_Mono'] text-[#8fa0c4] mb-2 px-0">
            {timelineHourLabels(false).map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="relative h-12 sm:h-14 bg-[#111828] rounded-xl overflow-hidden border border-[rgba(99,102,241,0.15)]">
            <div
              className="absolute top-0 bottom-0 bg-indigo-500/5 border-x border-indigo-400/10"
              style={{
                left: `${shiftWindowOnAxis(emp).left}%`,
                width: `${shiftWindowOnAxis(emp).width}%`,
              }}
            />
            {Array.from({ length: TIMELINE_AXIS_DURATION / 60 }, (_, i) => (i + 1) * 60).map(m => (
              <div key={m} className="absolute top-0 bottom-0 w-px bg-white/5"
                style={{ left: `${(m / TIMELINE_AXIS_DURATION) * 100}%` }} />
            ))}
            {emp.timeline.filter(b => b.kind !== "login").map((block, i) => {
              const s = (block.start / TIMELINE_AXIS_DURATION) * 100;
              const endMin = block.end ?? effectiveNow;
              const w = ((endMin - block.start) / TIMELINE_AXIS_DURATION) * 100;
              const meta = kindMeta[block.kind];
              return (
                <div key={i} className={`absolute top-2 bottom-2 rounded-lg ${meta.bg} ${block.end === null ? "opacity-90" : "opacity-65"} flex items-center justify-center overflow-hidden`}
                  style={{ left: `${s}%`, width: `${w}%`, minWidth: "1px" }}
                  title={`${block.label}\n${minToLabel(block.start)} → ${block.end ? minToLabel(block.end) : "Now"}`}>
                  {w > 8 && <span className="text-[10px] text-white/85 font-['Geist_Mono'] truncate px-1.5">{block.label}</span>}
                </div>
              );
            })}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_6px_rgba(255,255,255,0.5)]"
              style={{ left: `${Math.min((effectiveNow / TIMELINE_AXIS_DURATION) * 100, 100)}%` }} />
          </div>

        </div>

        <div className="m-6 sm:m-8 mb-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-['Geist_Mono'] text-amber-400 uppercase tracking-widest font-medium">
              Task Stage Time{tasksForToday.length > 0 ? ` (${tasksForToday.length})` : ""} · {isTaskStageToday ? "Today" : taskStageDateLabel}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaskStageDate(todayIso)}
                disabled={isTaskStageToday}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-['Geist_Mono'] border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Today
              </button>
              <div className="relative flex items-center gap-1.5 bg-[#111828] border border-[rgba(99,102,241,0.2)] rounded-lg px-2.5 py-1.5">
                <Calendar size={13} className="text-indigo-400 shrink-0" />
                <input
                  type="date"
                  value={taskStageDate}
                  max={todayIso}
                  onChange={e => {
                    if (e.target.value) setTaskStageDate(e.target.value);
                  }}
                  className="bg-transparent text-[11px] font-['Geist_Mono'] text-white outline-none cursor-pointer [color-scheme:dark]"
                  title="Filter kanban tasks by date"
                />
              </div>
            </div>
          </div>
          {tasksForToday.length > 0 ? (
            tasksForToday.map(task => (
              <TaskStageDetail
                key={task.taskId}
                task={task}
                compact
                large
                assigneeId={emp.id}
                attendanceSessions={attendanceSessions}
              />
            ))
          ) : (
            <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans'] rounded-xl border border-[rgba(99,102,241,0.12)] bg-[#111828]/50 px-4 py-6 text-center">
              No kanban tasks for {isTaskStageToday ? "today" : taskStageDateLabel}.
            </p>
          )}
        </div>

        {pauseBlocks.length > 0 && (
          <div className="m-6 sm:m-8 space-y-3">
            <p className="text-xs font-['Geist_Mono'] text-amber-400 uppercase tracking-widest font-medium">
              Breaks & Gaps ({pauseBlocks.length})
            </p>
            <div className="space-y-2">
              {pauseBlocks.map((block, i) => {
                const meta = kindMeta[block.kind];
                const endLabel = block.end ? minToLabel(block.end) : "Now";
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-3 py-3 px-4 rounded-xl bg-amber-500/5 border border-amber-500/15"
                  >
                    <Coffee size={16} className={`shrink-0 ${meta.color}`} />
                    <span className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${meta.color}`}>
                      {block.label}
                    </span>
                    <span className="text-xs font-['Geist_Mono'] text-[#8fa0c4]">
                      {minToLabel(block.start)} → {endLabel}
                    </span>
                    <span className="ml-auto text-sm font-bold font-['Geist_Mono'] text-amber-300">
                      {formatDurationMinutes(block.durationMin)} gap
                    </span>
                    {block.end === null && (
                      <span className="text-[10px] font-['Geist_Mono'] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Ongoing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

        {tab === "history" && (
          <div className="p-6 sm:p-8 space-y-10">
            {historyLoading ? (
              <p className="text-center text-[#6b7fa8] font-['Geist_Mono'] text-sm">Loading historical data...</p>
            ) : historyDays.length === 0 ? (
              <p className="text-center text-[#6b7fa8] font-['Geist_Mono'] text-sm">No recorded shift data for this period.</p>
            ) : (
              <>
                {visibleDays.map((hd, index) => (
                  <div key={hd.date} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {new Date(hd.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <div className="h-px bg-white/[0.06] flex-1" />
                      <span className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">
                        Shift: {hd.data.shiftStartLabel} – {hd.data.shiftEndLabel}
                      </span>
                    </div>
                    <StageTimelineBar
                      emp={hd.data}
                      nowMin={1440}
                      targetDate={hd.date}
                      attendanceSessions={hd.attendanceWindows}
                      allTasks={allTasks}
                    />
                  </div>
                ))}
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-[rgba(99,102,241,0.1)]">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs font-['Geist_Mono'] rounded-lg border border-[rgba(99,102,241,0.2)] text-[#8fa0c4] hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs font-['Geist_Mono'] rounded-lg border border-[rgba(99,102,241,0.2)] text-[#8fa0c4] hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {tab === "screenshots" && (
          <div className="mt-6 h-full">
            <ScreenshotsView employeeId={emp.id} />
          </div>
        )}
      </div>
    </div>
  );
}

export function ShiftView({
  userRole = "ceo",
  userName = "",
  userEmail = "",
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}) {
  const { data: profiles, loading: pLoading, error: pError, refresh: refreshProfiles } = useEmployeeProfiles();
  const { data: tasks, loading: tLoading } = useProjectTasks();
  const [sessions, setSessions] = useState<ClockSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [selected, setSelected] = useState<ShiftEmployee | null>(null);
  const [nowMin, setNowMin] = useState(currentShiftNowMin());
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<ShiftDeptFilter>("all");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [targetDate, setTargetDate] = useState<string>(
    () => new Date().toLocaleDateString("en-CA") // "YYYY-MM-DD" local time
  );

  const attendanceWindows = useMemo(
    () => clockSessionsToAttendanceWindows(sessions),
    [sessions]
  );

  const viewerProfile = useMemo(
    () => findProfileForUser(profiles, userName, userEmail),
    [profiles, userName, userEmail]
  );

  const refresh = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setFetchError("");
    try {
      refreshProfiles();
      const rows = await fetchTeamClockSessionsByDate(targetDate);
      setSessions(rows);
      setSetupNeeded(!isClockSessionsTableReady());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load team shifts");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [targetDate, refreshProfiles]);

  useEffect(() => {
    void refresh(false);
    
    const isToday = targetDate === new Date().toLocaleDateString("en-CA");
    if (!isToday) {
      setNowMin(TIMELINE_AXIS_DURATION); // lock timeline to end of day for past dates
      return;
    }
    
    setNowMin(currentShiftNowMin());
    const refreshId = setInterval(() => void refresh(true), 30_000);
    const clockId = setInterval(() => setNowMin(currentShiftNowMin()), 15_000);
    return () => {
      clearInterval(refreshId);
      clearInterval(clockId);
    };
  }, [refresh, targetDate]);

  const visibleProfiles = useMemo(() => {
    let list = profiles.filter(p => p.dept !== "Executive" && p.name !== "CEO Admin");
    return list;
  }, [profiles, userRole, viewerProfile?.dept]);

  const profileCountByName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visibleProfiles) {
      const key = p.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [visibleProfiles]);

  const sessionByEmployeeId = useMemo(() => {
    const map = new Map<string, ClockSessionRecord>();
    for (const s of sessions) {
      if (!s.employeeId) continue;
      const existing = map.get(s.employeeId);
      if (!existing || new Date(s.clockIn).getTime() > new Date(existing.clockIn).getTime()) {
        map.set(s.employeeId, s);
      }
    }
    return map;
  }, [sessions]);

  /** Legacy clock rows without employee_id — only when that display name is unique on the team. */
  const legacySessionByUniqueName = useMemo(() => {
    const map = new Map<string, ClockSessionRecord>();
    for (const s of sessions) {
      if (s.employeeId) continue;
      const nameKey = s.employeeName.trim().toLowerCase();
      if ((profileCountByName.get(nameKey) || 0) !== 1) continue;
      const existing = map.get(nameKey);
      if (!existing || new Date(s.clockIn).getTime() > new Date(existing.clockIn).getTime()) {
        map.set(nameKey, s);
      }
    }
    return map;
  }, [sessions, profileCountByName]);

  const shiftEmployees = useMemo(() => {
    let list = visibleProfiles
      .filter(profile => profileMatchesShiftFilter(profile, deptFilter))
      .map(profile => {
      const session =
        sessionByEmployeeId.get(profile.id) ||
        legacySessionByUniqueName.get(profile.name.trim().toLowerCase()) ||
        null;
      const workTasks = listWorkTasksForEmployee(tasks, profile.id, profile.name);
      const trackedTasks = listTrackedTasksForEmployee(tasks, profile.id, profile.name);
      return buildShiftEmployee({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar || initialsFromName(profile.name),
        role: profile.role,
        dept: profile.dept,
        profileImageUrl: profile.profileImageUrl,
        shiftStart: profile.shiftStart,
        lastActiveAt: profile.last_active_at,
        session,
        currentTask: workTasks[0]?.title || "No task in progress",
        workTasksInput: workTasks,
        trackedTasksInput: trackedTasks,
      });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(emp => emp.name.toLowerCase().includes(q) || emp.dept.toLowerCase().includes(q));
    }

    return list;
  }, [visibleProfiles, sessionByEmployeeId, legacySessionByUniqueName, tasks, nowMin, searchQuery, deptFilter]);

  useEffect(() => {
    if (!selected) return;
    const updated = shiftEmployees.find(e => e.id === selected.id);
    if (updated) setSelected(updated);
  }, [shiftEmployees, selected?.name]);



  const prevIdleSet = useRef<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  useEffect(() => {
    const currentIdleSet = new Set<string>();

    for (const emp of shiftEmployees) {
      if (emp.status === "idle") {
        currentIdleSet.add(emp.name);
      }
    }

    prevIdleSet.current = currentIdleSet;
    isFirstRender.current = false;
  }, [shiftEmployees]);

  const shiftAiInsights = useMemo(() => buildShiftInsights(shiftEmployees), [shiftEmployees]);

  const statusCounts = useMemo(
    () => ({
      working: shiftEmployees.filter(e => e.status === "working").length,
      idle: shiftEmployees.filter(e => e.status === "idle" || e.status === "offline").length,
      meeting: shiftEmployees.filter(e => e.status === "meeting").length,
      break: shiftEmployees.filter(e => e.status === "break").length,
    }),
    [shiftEmployees]
  );

  const currentTimeLabel = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const isToday = targetDate === new Date().toLocaleDateString("en-CA");
  
  // Parse targetDate in local time to avoid timezone offset issues
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const displayDateLabel = new Date(ty, tm - 1, td).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handlePrevDay = () => {
    const d = new Date(ty, tm - 1, td);
    d.setDate(d.getDate() - 1);
    setTargetDate(d.toLocaleDateString("en-CA"));
  };

  const handleNextDay = () => {
    const d = new Date(ty, tm - 1, td);
    d.setDate(d.getDate() + 1);
    setTargetDate(d.toLocaleDateString("en-CA"));
  };

  // Only show full loading screen if we have no initial data
  const isInitialLoad = loading || (pLoading && profiles.length === 0) || (tLoading && tasks.length === 0);

  if (isInitialLoad) {
    return <DataLoading label="Loading team shift tracker..." />;
  }
  if (pError || fetchError) {
    return <DataError message={pError || fetchError} />;
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Shift Tracker</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">
            {isToday ? "Today" : displayDateLabel} · {clockMinutesToLabel(TIMELINE_AXIS_START)} → {clockMinutesToLabel(TIMELINE_AXIS_END)} ·{" "}
            <span className="text-[#6b7fa8]">{SHIFT_HOURS}h shift per employee ·</span>{" "}
            {isToday ? <span className="text-emerald-400">Current: {currentTimeLabel}</span> : <span className="text-indigo-400">Historical View</span>}
            {userRole === "teamlead" && viewerProfile?.dept ? (
              <span className="text-indigo-400"> · {viewerProfile.dept} team</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" size={14} />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#6b7fa8] focus:outline-none focus:border-indigo-500/50 w-48 transition-colors"
            />
          </div>
          <div className={`flex items-center gap-1.5 text-[10px] font-['Geist_Mono'] px-3 py-2 rounded-lg ${isToday ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"}`}>
            {isToday && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
            <span>{isToday ? "Live Tracking Active" : "Historical Data"}</span>
          </div>
          <div className="flex items-center bg-[#131a35] border border-indigo-500/30 rounded-lg overflow-hidden transition-colors shadow-sm shadow-indigo-500/10">
            <button onClick={handlePrevDay} className="px-3 py-2 text-[#8fa0c4] hover:text-white hover:bg-indigo-500/10 transition-colors border-r border-[rgba(99,102,241,0.15)]">
              <ChevronLeft size={16} />
            </button>
            <div 
              className="relative px-4 py-2 flex items-center justify-center gap-2 min-w-[150px] hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker?.();
                } catch (e) {
                  // Fallback for browsers that don't support showPicker on dates yet
                  dateInputRef.current?.focus();
                }
              }}
            >
              <Calendar size={14} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                {isToday ? "Today" : targetDate === new Date(Date.now() - 86400000).toLocaleDateString("en-CA") ? "Yesterday" : displayDateLabel}
              </span>
              <input 
                ref={dateInputRef}
                type="date" 
                value={targetDate}
                onChange={(e) => { if (e.target.value) setTargetDate(e.target.value); }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Select Date"
              />
            </div>
            <button onClick={handleNextDay} disabled={isToday} className="px-3 py-2 text-[#8fa0c4] hover:text-white hover:bg-indigo-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-l border-[rgba(99,102,241,0.15)]">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.14)] rounded-xl p-4 shadow-sm shadow-indigo-500/5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <LayoutGrid size={15} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Filter by team</p>
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">
                {deptFilter === "all"
                  ? `Showing all ${visibleProfiles.length} employees`
                  : `${shiftEmployees.length} shown · ${SHIFT_DEPT_OPTIONS.find(o => o.id === deptFilter)?.label}`}
              </p>
            </div>
          </div>
          {deptFilter !== "all" && (
            <button
              type="button"
              onClick={() => setDeptFilter("all")}
              className="text-[11px] font-semibold text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SHIFT_DEPT_OPTIONS.filter(o => o.group === "all" || o.group === "team").map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDeptFilter(opt.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold font-['Plus_Jakarta_Sans'] border transition-all duration-200 ${
                deptFilter === opt.id
                  ? opt.activeClass
                  : "bg-[#131a35]/80 border-[rgba(99,102,241,0.12)] text-[#8fa0c4] hover:text-white hover:border-indigo-500/30 hover:bg-[#161f3d]"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="hidden sm:block w-px h-7 bg-indigo-500/20 mx-1" />

          <span className="w-full sm:w-auto text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wide shrink-0 flex items-center gap-1.5">
            <Crown size={12} className="text-fuchsia-400" />
            Leadership
          </span>

          {SHIFT_DEPT_OPTIONS.filter(o => o.group === "leadership").map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDeptFilter(opt.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold font-['Plus_Jakarta_Sans'] border transition-all duration-200 ${
                deptFilter === opt.id
                  ? opt.activeClass
                  : "bg-[#131a35]/80 border-[rgba(99,102,241,0.12)] text-[#8fa0c4] hover:text-white hover:border-indigo-500/30 hover:bg-[#161f3d]"
              }`}
            >
              <Crown size={13} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {setupNeeded && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 font-['Plus_Jakarta_Sans']">
          {CLOCK_SESSIONS_SETUP_MSG}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Actively Working", count: statusCounts.working, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", dot: "bg-indigo-400" },
          { label: "In Meetings", count: statusCounts.meeting, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", dot: "bg-violet-400" },
          { label: "On Break", count: statusCounts.break, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400" },
          { label: "Idle / Inactive", count: statusCounts.idle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 flex items-center gap-4`}>
            <span className={`w-10 h-10 rounded-full ${s.bg} border flex items-center justify-center text-xl font-bold font-['Plus_Jakarta_Sans'] ${s.color}`}>{s.count}</span>
            <div>
              <div className={`text-sm font-semibold ${s.color} font-['Plus_Jakarta_Sans']`}>{s.label}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">of {shiftEmployees.length} total</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-lg p-1 w-full mb-4 mt-2">
        <button
          onClick={() => setViewMode("timeline")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${viewMode === "timeline" ? "bg-[rgba(99,102,241,0.15)] text-indigo-400" : "text-[#6b7fa8] hover:text-white"}`}
        >
          Team Shift Timeline
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${viewMode === "grid" ? "bg-[rgba(99,102,241,0.15)] text-indigo-400" : "text-[#6b7fa8] hover:text-white"}`}
        >
          Live Tracking Grid
        </button>
      </div>

      {viewMode === "timeline" ? (
        <div className="space-y-4">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Team Shift Timeline</h3>
            <div className="flex items-center gap-3 text-[10px] font-['Geist_Mono']">
              {STAGE_ORDER.map(status => {
                const meta = stageMeta[status];
                return (
                  <span key={status} className={`flex items-center gap-1.5 ${meta.color}`}>
                    <span className={`w-2.5 h-2.5 rounded-sm ${meta.bg} opacity-80`} /> {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex border-t border-[rgba(99,102,241,0.08)] bg-[#080c1f]">
            <div className="w-52 shrink-0 px-5 py-2 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Employee</div>
            <div className="flex-1 relative px-3 py-2">
              <div className="flex justify-between text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
                {timelineHourLabels().map(t => <span key={t}>{t}</span>)}
              </div>
            </div>
            <div className="w-36 shrink-0 px-4 py-2 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Productivity</div>
          </div>
        </div>

        {shiftEmployees.length === 0 ? (
          <div className="p-8 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl">
            <DataEmpty message="No team members found for shift tracking." />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
          {shiftEmployees.map((emp, i) => {
          const meta = kindMeta[emp.status];
          const photo = (emp as ShiftEmployee & { profileImageUrl?: string }).profileImageUrl;
          const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
          const effectiveNow = Math.min(nowMin, TIMELINE_AXIS_DURATION);
          const currentPause = emp.timeline.find(
            b => (b.kind === "break" || b.kind === "meeting") && b.end === null
          );
          const completedPauses = listPauseBlocks(emp.timeline, effectiveNow).filter(b => b.end !== null);
          return (
            <div key={i}
              className="flex items-stretch bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl hover:border-indigo-500/30 hover:shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] transition-all cursor-pointer group overflow-hidden"
              onClick={() => setSelected(emp)}>
              <div className="w-52 shrink-0 px-5 py-4 flex items-center gap-2.5 border-r border-[rgba(99,102,241,0.06)] bg-[#0a0f1d]">
                <Avatar initials={emp.avatar} size="sm" src={photo} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate font-['Plus_Jakarta_Sans'] group-hover:text-indigo-300 transition-colors">{emp.name}</p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${emp.status === "working" ? "animate-pulse" : ""}`} />
                      <span className={`text-[10px] font-['Geist_Mono'] ${meta.color}`}>
                        {emp.status === "idle" && (emp.idleDurationMins || 0) > 0 ? `Not at desk for ${emp.idleDurationMins}m` : meta.label}
                      </span>
                    </div>
                    {emp.status !== "offline" && formatClockInLive(emp.clockInAt) ? (
                      <div className="text-[10px] font-['Geist_Mono'] text-emerald-400/95 flex items-start gap-1.5 mt-0.5">
                        <Timer size={10} className="shrink-0 mt-px" />
                        <div className="flex flex-col">
                          <span>{formatClockInLive(emp.clockInAt)?.split(' · ')[0]}</span>
                          <span className="font-semibold">{emp.activeFor}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
                        Shift {emp.shiftStartLabel}–{emp.shiftEndLabel}
                      </span>
                    )}
                    {currentPause && (
                      <span className="text-[10px] font-['Geist_Mono'] text-amber-400/95">
                        {currentPause.label} · {formatDurationMinutes(effectiveNow - currentPause.start)}
                      </span>
                    )}
                    {!currentPause && completedPauses.length > 0 && (
                      <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] truncate" title={completedPauses.map(p => `${p.label} ${formatDurationMinutes(p.durationMin)}`).join(", ")}>
                        {completedPauses.length} break{completedPauses.length > 1 ? "s" : ""} · {formatDurationMinutes(completedPauses.reduce((s, p) => s + p.durationMin, 0))}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 px-4 py-4">
                <StageTimelineBar
                  emp={emp}
                  nowMin={nowMin}
                  targetDate={targetDate}
                  attendanceSessions={attendanceWindows}
                  allTasks={tasks}
                />
              </div>

              <div className="w-36 shrink-0 px-4 py-4 border-l border-[rgba(99,102,241,0.06)] bg-[#0a0f1d] flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1 bg-[#131a35] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${emp.productivity >= 90 ? "bg-emerald-500" : emp.productivity >= 75 ? "bg-indigo-500" : "bg-amber-500"}`}
                      style={{ width: `${emp.productivity}%` }} />
                  </div>
                  <span className={`text-xs font-bold font-['Geist_Mono'] ${emp.productivity >= 90 ? "text-emerald-400" : emp.productivity >= 75 ? "text-indigo-400" : "text-amber-400"}`}>{emp.productivity}%</span>
                </div>
                <p className="text-[10px] text-[#6b7fa8] truncate font-['Geist_Mono']">
                  {emp.workTasks[0]?.title
                    || (emp.trackedTasks.some(t => t.status === "todo")
                      ? `${emp.trackedTasks.filter(t => t.status === "todo").length} in To Do`
                      : "—")}
                </p>
              </div>
            </div>
          );
        })}
          </div>
        )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Live Tracking Grid</h3>
              <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mt-0.5">Click any card to open detailed timeline</p>
            </div>
            
            <div className="flex border-t border-[rgba(99,102,241,0.08)] bg-[#080c1f]">
              <div className="w-48 shrink-0 px-5 py-3 text-[10px] font-['Geist_Mono'] text-[#8fa0c4] uppercase tracking-wider">Employee</div>
              <div className="w-64 shrink-0 px-4 py-3 text-[10px] font-['Geist_Mono'] text-[#8fa0c4] uppercase tracking-wider">Current Activity</div>
              <div className="w-32 shrink-0 px-4 py-3 text-[10px] font-['Geist_Mono'] text-[#8fa0c4] uppercase tracking-wider">Attendance</div>
              <div className="flex-1 px-4 pt-3 pb-2 flex flex-col gap-2">
                <span className="text-[10px] font-['Geist_Mono'] text-[#8fa0c4] uppercase tracking-wider">Daily Timeline</span>
                <div className="flex justify-between text-[9px] font-['Geist_Mono'] text-[#4f679b]">
                  {timelineHourLabels(true).map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {shiftEmployees.map((emp, i) => {
              const meta = kindMeta[emp.status];
              const photo = (emp as ShiftEmployee & { profileImageUrl?: string }).profileImageUrl;
              


              const currentWorkTask = emp.status === "working" && emp.workTasks[0] ? emp.workTasks[0] : null;
              const currentWorkTaskTotals = currentWorkTask
                ? cumulativeTaskStageTotals(
                    currentWorkTask,
                    emp.id,
                    attendanceWindows,
                  )
                : null;
              
              let currentWorkTaskTimeSum = currentWorkTaskTotals
                ? (currentWorkTaskTotals["in-progress"] || 0)
                : 0;

              return (
                <div key={i} className="flex items-center bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl hover:border-indigo-500/30 hover:shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] transition-all cursor-pointer overflow-hidden group"
                  onClick={() => setSelected(emp)}>
                  <div className="w-48 shrink-0 px-5 py-4 flex items-center gap-3 border-r border-[rgba(99,102,241,0.06)] bg-[#0a0f1d] self-stretch">
                    <Avatar initials={emp.avatar} size="sm" src={photo} />
                    <div>
                      <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] group-hover:text-indigo-300 transition-colors">{emp.name.split(" ")[0]}</p>
                      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{emp.dept}</p>
                    </div>
                  </div>

                  <div className="w-64 shrink-0 px-4 py-3 border-r border-[rgba(99,102,241,0.06)] flex flex-col justify-center self-stretch">
                    <div className={`flex items-start gap-2 text-xs font-['Geist_Mono'] ${meta.color}`}>
                      <span className={`shrink-0 w-2 h-2 mt-1 rounded-full ${meta.bg} shadow-[0_0_8px_currentColor] ${emp.status === "working" ? "animate-pulse" : "opacity-80"}`} />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="whitespace-normal break-words leading-snug font-semibold drop-shadow-sm" style={{ wordBreak: 'break-word' }}>
                          {emp.status === "working"
                            ? (emp.workTasks[0]?.title
                              || (emp.trackedTasks.length > 0 ? "Clocked in — task not started" : "Clocked in"))
                            : (emp.status === "idle" && (emp.idleDurationMins || 0) > 0 ? `Not at desk for ${emp.idleDurationMins}m` : meta.label)}
                        </span>
                        {emp.status === "working" && currentWorkTaskTimeSum > 0 && (
                          <span className="text-[10px] font-bold text-indigo-300 mt-2 bg-indigo-500/20 border border-indigo-500/30 px-2 py-1 rounded shadow-sm w-fit tracking-wide uppercase">
                            Task Time: {formatStageDuration(currentWorkTaskTimeSum)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>



                  <div className="w-32 shrink-0 px-4 py-4 border-r border-[rgba(99,102,241,0.06)] flex flex-col justify-center">
                    <span className="text-emerald-400 font-['Geist_Mono'] text-[11px] font-bold">{emp.activeFor}</span>
                    <div className="mt-1 h-1 bg-[#131a35] rounded-full overflow-hidden w-full">
                      <div className={`h-full rounded-full ${emp.productivity >= 90 ? "bg-emerald-500" : emp.productivity >= 75 ? "bg-indigo-500" : "bg-amber-500"}`}
                        style={{ width: `${emp.productivity}%` }} />
                    </div>
                  </div>

                  <div className="flex-1 px-4 py-4 min-w-[280px]">
                    <TimelineBar emp={emp} nowMin={nowMin} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <EmployeeDetailPanel
          emp={selected}
          onClose={() => setSelected(null)}
          nowMin={nowMin}
          allTasks={tasks}
          targetDate={targetDate}
          attendanceSessions={attendanceWindows}
        />
      )}
    </div>
  );
}
