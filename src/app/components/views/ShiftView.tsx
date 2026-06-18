import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Brain, AlertTriangle, Star, ArrowUpRight, Calendar,
  CheckSquare, Monitor, Globe, Timer, Clock, Zap, Activity,
  Users, WifiOff, Coffee, MapPin, X
} from "lucide-react";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";
import { useEmployeeProfiles, useProjectTasks } from "@/hooks/useSupabaseData";
import {
  CLOCK_SESSIONS_SETUP_MSG,
  fetchTodayTeamClockSessions,
  initialsFromName,
  isClockSessionsTableReady,
  type ClockSessionRecord,
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
  return hhmm(Math.floor(clockMin / 60), clockMin % 60);
}

export function isoToTimelineMinutes(iso: string) {
  const d = new Date(iso);
  const clockMin = d.getHours() * 60 + d.getMinutes();
  return Math.max(0, Math.min(TIMELINE_AXIS_DURATION, clockMin - TIMELINE_AXIS_START));
}

export function currentTimelineNowMin() {
  const now = new Date();
  const clockMin = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, Math.min(TIMELINE_AXIS_DURATION, clockMin - TIMELINE_AXIS_START));
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
  const totals = aggregateStageSeconds(task.stageHistory, task.status, task.statusEnteredAt, targetDate);
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

function TaskStageDetail({ task, compact = false, large = false }: { task: ShiftActiveTask; compact?: boolean; large?: boolean }) {
  const totals = aggregateStageSeconds(task.stageHistory, task.status, task.statusEnteredAt);
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
                {entry.isCurrent ? (task.statusEnteredAt === "paused" ? " · paused" : " · live") : ""}
              </p>
            </div>
          );
        })}
      </div>
      {task.stageHistory.length > 0 && (
        <div className={`pt-3 border-t border-amber-500/15 space-y-1.5 overflow-y-auto ${large ? "max-h-36" : "max-h-28"}`}>
          {[...task.stageHistory].reverse().slice(0, 8).map(row => (
            <p key={row.id} className={`font-['Geist_Mono'] text-[#8fa0c4] ${large ? "text-xs" : "text-[10px]"}`}>
              {shortStageLabel(row.to_status)}
              {row.exited_at
                ? ` · ${formatStageDuration(row.duration_seconds || 0)}`
                : " · current"}
              {" · "}
              {formatStageEnteredAt(row.entered_at)}
            </p>
          ))}
        </div>
      )}
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
  targetDate,
}: {
  task: ShiftActiveTask;
  shiftWindow: { left: number; width: number };
  targetDate?: string;
}) {
  const totals = aggregateStageSeconds(task.stageHistory, task.status, task.statusEnteredAt, targetDate);
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
                  {seg.percent >= 14 && (
                    <span className="text-[7px] text-white/95 font-['Geist_Mono'] truncate px-0.5 font-semibold leading-none">
                      {formatStageDuration(seg.seconds)}
                    </span>
                  )}
                  {seg.percent >= 18 && (
                    <span className="text-[6px] text-white/75 font-['Geist_Mono'] truncate px-0.5 leading-none mt-px">
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
            title={`${task.title} — no stage time yet`}
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
              className={`inline-flex items-center gap-1 text-[8px] font-['Geist_Mono'] ${
                meta?.color ? `${meta.color} ${entry.isCurrent ? "" : "opacity-80"}` : "text-[#8fa0c4]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-sm shrink-0 ${meta?.bg ?? "bg-slate-500"}`} />
              {entry.label} {formatStageDuration(entry.seconds)}
              {entry.isCurrent ? (task.statusEnteredAt === "paused" ? " · paused" : " · live") : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function StageTimelineBar({ emp, nowMin, targetDate }: { emp: ShiftEmployee; nowMin: number; targetDate?: string; }) {
  const shiftWindow = shiftWindowOnAxis(emp);
  const hourMarks = Array.from({ length: TIMELINE_AXIS_DURATION / 60 + 1 }, (_, i) => i * 60).slice(1, -1);
  const tasks = emp.trackedTasks.length > 0 ? emp.trackedTasks : [];

  return (
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
      {tasks.length > 0 ? (
        tasks.map(task => (
          <TaskStageBar key={task.taskId} task={task} shiftWindow={shiftWindow} targetDate={targetDate} />
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
  );
}

export function TimelineBar({ emp, nowMin }: { emp: ShiftEmployee; nowMin: number }) {
  const shiftWindow = shiftWindowOnAxis(emp);
  const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, shiftEndAxis);
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
        const endMin = block.end ?? Math.min(effectiveNow, shiftEndAxis);
        const w = ((endMin - block.start) / TIMELINE_AXIS_DURATION) * 100;
        const meta = kindMeta[block.kind];
        const isOngoing = block.end === null;
        const dur = Math.max(0, endMin - block.start);
        const durLabel = formatDurationMinutes(dur);
        return (
          <div
            key={i}
            className={`absolute top-1 bottom-1 rounded-sm ${meta.bg} ${isOngoing ? "opacity-95 ring-1 ring-white/20" : "opacity-75"} flex items-center justify-center overflow-hidden`}
            style={{ left: `${s}%`, width: `${Math.max(w, block.kind === "break" || block.kind === "meeting" ? 1.2 : 0.5)}%` }}
            title={`${block.label}: ${minToLabel(block.start)} → ${block.end ? minToLabel(block.end) : "Now"} (${durLabel})`}
          >
            {(block.kind === "break" || block.kind === "meeting") && w > 4 && (
              <span className="text-[8px] text-white/90 font-['Geist_Mono'] truncate px-0.5">{durLabel}</span>
            )}
          </div>
        );
      })}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
        style={{ left: `${Math.min((nowMin / TIMELINE_AXIS_DURATION) * 100, 100)}%` }} />
    </div>
    {pauseBlocks.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {pauseBlocks.slice(0, 3).map((b, i) => (
          <span
            key={i}
            className="text-[9px] font-['Geist_Mono'] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded"
            title={`${minToLabel(b.start)} → ${b.end ? minToLabel(b.end) : "Now"}`}
          >
            {b.label} · {formatDurationMinutes(b.durationMin)}
          </span>
        ))}
      </div>
    )}
    </div>
  );
}

export function EmployeeDetailPanel({ emp, onClose, nowMin, allTasks }: { emp: ShiftEmployee; onClose: () => void; nowMin: number; allTasks: AppTask[] }) {
  const [tab, setTab] = useState<"live" | "history">("live");
  const [historyRange, setHistoryRange] = useState<number>(7);
  const [page, setPage] = useState(1);
  const { historyDays, loading: historyLoading } = useEmployeeVisualHistory(emp, historyRange, allTasks);

  const PAGE_SIZE = 7;
  const totalPages = Math.ceil(historyDays.length / PAGE_SIZE);
  const visibleDays = historyDays.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const shiftStartAxis = Math.max(0, emp.shiftStartMin - TIMELINE_AXIS_START);
  const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, shiftEndAxis);
  const window = { start: shiftStartAxis, end: effectiveNow };

  const worked = timelineDuration(emp.timeline, "working", effectiveNow, window);
  const idle = timelineDuration(emp.timeline, "idle", effectiveNow, window);
  const meetings = timelineDuration(emp.timeline, "meeting", effectiveNow, window);
  const breaks = timelineDuration(emp.timeline, "break", effectiveNow, window);

  const pauseBlocks = listPauseBlocks(emp.timeline, effectiveNow);

  const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
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

        {emp.trackedTasks.length > 0 && (
          <div className="m-6 sm:m-8 mb-0 space-y-4">
            <p className="text-xs font-['Geist_Mono'] text-amber-400 uppercase tracking-widest font-medium">
              Task Stage Time ({emp.trackedTasks.length})
            </p>
            {emp.trackedTasks.map(task => (
              <TaskStageDetail key={task.taskId} task={task} compact large />
            ))}
          </div>
        )}

        {pauseBlocks.length > 0 && (
          <div className="m-6 sm:m-8 mb-0 space-y-3">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 m-6 sm:m-8 mb-0">
          {[
            { label: "Work Time", value: fmtMin(worked), color: "text-indigo-400", icon: Activity },
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

        <div className="m-6 sm:m-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
              Daily Timeline — {emp.shiftStartLabel} → {emp.shiftEndLabel}
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
              const endMin = block.end ?? Math.min(effectiveNow, shiftEndAxis);
              const w = ((endMin - block.start) / TIMELINE_AXIS_DURATION) * 100;
              const meta = kindMeta[block.kind];
              return (
                <div key={i} className={`absolute top-2 bottom-2 rounded-lg ${meta.bg} ${block.end === null ? "opacity-90" : "opacity-65"} flex items-center justify-center overflow-hidden`}
                  style={{ left: `${s}%`, width: `${Math.max(w, 0.8)}%` }}
                  title={`${block.label}\n${minToLabel(block.start)} → ${block.end ? minToLabel(block.end) : "Now"}`}>
                  {w > 8 && <span className="text-[10px] text-white/85 font-['Geist_Mono'] truncate px-1.5">{block.label}</span>}
                </div>
              );
            })}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_6px_rgba(255,255,255,0.5)]"
              style={{ left: `${Math.min((effectiveNow / TIMELINE_AXIS_DURATION) * 100, 100)}%` }} />
          </div>

          <div className="mt-5 space-y-2">
            {emp.timeline.map((block, i) => {
              const meta = kindMeta[block.kind];
              const endMin = block.end ?? effectiveNow;
              const dur = block.kind !== "login" ? Math.max(0, endMin - block.start) : 0;
              return (
                <div key={i} className="flex items-center gap-4 py-2.5 px-4 rounded-xl hover:bg-white/[0.03] transition-colors group">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot} ${block.end === null ? "animate-pulse" : ""}`} />
                  <span className="text-sm font-['Geist_Mono'] text-[#8fa0c4] w-32 shrink-0">{minToLabel(block.start)}</span>
                  <span className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${meta.color}`}>{block.label}</span>
                  {block.kind !== "login" && (
                    <span className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">
                      {formatDurationMinutes(dur)}
                    </span>
                  )}
                  {block.end === null
                    ? <span className="ml-auto text-xs font-['Geist_Mono'] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">Ongoing</span>
                    : <span className="ml-auto text-xs font-['Geist_Mono'] text-[#8fa0c4]">→ {minToLabel(block.end)}</span>}
                </div>
              );
            })}
          </div>
        </div>
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
                    <StageTimelineBar emp={hd.data} nowMin={1440} targetDate={hd.date} />
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
      </div>
    </div>
  );
}

export function ShiftView({
  userRole = "ceo",
  userName = "",
}: {
  userRole?: string;
  userName?: string;
}) {
  const { data: profiles, loading: pLoading, error: pError, refresh: refreshProfiles } = useEmployeeProfiles();
  const { data: tasks, loading: tLoading } = useProjectTasks();
  const [sessions, setSessions] = useState<ClockSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [selected, setSelected] = useState<ShiftEmployee | null>(null);
  const [nowMin, setNowMin] = useState(currentShiftNowMin());

  const viewerProfile = useMemo(
    () => profiles.find(p => p.name.trim().toLowerCase() === userName.trim().toLowerCase()),
    [profiles, userName]
  );

  const refresh = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setFetchError("");
    try {
      refreshProfiles();
      const rows = await fetchTodayTeamClockSessions();
      setSessions(rows);
      setSetupNeeded(!isClockSessionsTableReady());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load team shifts");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const refreshId = setInterval(() => void refresh(true), 30_000);
    const clockId = setInterval(() => setNowMin(currentShiftNowMin()), 15_000);
    return () => {
      clearInterval(refreshId);
      clearInterval(clockId);
    };
  }, [refresh]);

  const sessionByEmployee = useMemo(() => {
    const map = new Map<string, ClockSessionRecord>();
    for (const s of sessions) {
      if (s.employeeId) map.set(s.employeeId, s);
      const nameKey = s.employeeName.trim().toLowerCase();
      map.set(nameKey, s);
      // Also index first name for loose matching
      const first = nameKey.split(/\s+/)[0];
      if (first && !map.has(first)) map.set(first, s);
    }
    return map;
  }, [sessions]);

  const visibleProfiles = useMemo(() => {
    let list = profiles.filter(p => p.dept !== "Executive" && p.name !== "CEO Admin");
    return list;
  }, [profiles, userRole, viewerProfile?.dept]);

  const shiftEmployees = useMemo(() => {
    return visibleProfiles.map(profile => {
      const session =
        sessionByEmployee.get(profile.id) ||
        sessionByEmployee.get(profile.name.trim().toLowerCase()) ||
        sessionByEmployee.get(profile.name.trim().toLowerCase().split(/\s+/)[0]) ||
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
  }, [visibleProfiles, sessionByEmployee, tasks]);

  useEffect(() => {
    if (!selected) return;
    const updated = shiftEmployees.find(e => e.name === selected.name);
    if (updated) setSelected(updated);
  }, [shiftEmployees, selected?.name]);

  const prevIdleSet = useRef<Set<string>>(new Set());

  useEffect(() => {
    let newlyIdle = false;
    const currentIdleSet = new Set<string>();

    for (const emp of shiftEmployees) {
      if (emp.status === "idle") {
        currentIdleSet.add(emp.name);
        if (!prevIdleSet.current.has(emp.name)) {
          newlyIdle = true;
        }
      }
    }

    // Play a beep if someone just became idle
    if (newlyIdle) {
      playBeep();
    }

    prevIdleSet.current = currentIdleSet;
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
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Only show full loading screen if we have no initial data
  const isInitialLoad = loading || (pLoading && profiles.length === 0) || (tLoading && tasks.length === 0);

  if (isInitialLoad) {
    return <DataLoading label="Loading team shift tracker..." />;
  }
  if (pError || fetchError) {
    return <DataError message={pError || fetchError} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Shift Tracker</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">
            Today · {clockMinutesToLabel(TIMELINE_AXIS_START)} → {clockMinutesToLabel(TIMELINE_AXIS_END)} ·{" "}
            <span className="text-[#6b7fa8]">{SHIFT_HOURS}h shift per employee ·</span>{" "}
            <span className="text-emerald-400">Current: {currentTimeLabel}</span>
            {userRole === "teamlead" && viewerProfile?.dept ? (
              <span className="text-indigo-400"> · {viewerProfile.dept} team</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-['Geist_Mono'] px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400">Live Tracking Active</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-[#a8b5d1] text-xs hover:border-indigo-500/30 transition-colors"
          >
            <Calendar size={12} /> {todayLabel}
          </button>
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

      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(99,102,241,0.1)]">
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

        <div className="flex border-b border-[rgba(99,102,241,0.08)] bg-[#080c1f]">
          <div className="w-52 shrink-0 px-5 py-2 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Employee</div>
          <div className="flex-1 relative px-3 py-2">
            <div className="flex justify-between text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
              {timelineHourLabels().map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
          <div className="w-36 shrink-0 px-4 py-2 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Productivity</div>
        </div>

        {shiftEmployees.length === 0 ? (
          <div className="p-8">
            <DataEmpty message="No team members found for shift tracking." />
          </div>
        ) : (
        shiftEmployees.map((emp, i) => {
          const meta = kindMeta[emp.status];
          const photo = (emp as ShiftEmployee & { profileImageUrl?: string }).profileImageUrl;
          const shiftEndAxis = emp.shiftEndMin - TIMELINE_AXIS_START;
          const effectiveNow = Math.min(nowMin, shiftEndAxis);
          const currentPause = emp.timeline.find(
            b => (b.kind === "break" || b.kind === "meeting") && b.end === null
          );
          const completedPauses = listPauseBlocks(emp.timeline, effectiveNow).filter(b => b.end !== null);
          return (
            <div key={i}
              className="flex items-stretch border-b border-[rgba(99,102,241,0.06)] hover:bg-white/[0.015] transition-colors cursor-pointer group"
              onClick={() => setSelected(emp)}>
              <div className="w-52 shrink-0 px-5 py-3.5 flex items-center gap-2.5">
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
                      <span className="text-[10px] font-['Geist_Mono'] text-emerald-400/95 flex items-center gap-1">
                        <Timer size={9} className="shrink-0" />
                        {formatClockInLive(emp.clockInAt)}
                      </span>
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

              <div className="flex-1 px-3 py-3.5">
                <StageTimelineBar emp={emp} nowMin={nowMin} />
              </div>

              <div className="w-36 shrink-0 px-4 py-3.5">
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
        })
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[rgba(99,102,241,0.1)]">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Live Tracking Grid</h3>
            <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mt-0.5">Click any row to open detailed timeline</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(99,102,241,0.08)]">
                {["Employee", "Current Activity", "App / Screen", "Time Active", "Productivity", "Task Stage Time"].map(h => (
                  <th key={h} className={`text-left font-['Geist_Mono'] text-[#8fa0c4] uppercase tracking-wider ${
                    h === "Task Stage Time" ? "px-4 py-3.5 text-[11px] min-w-[280px]" : "px-4 py-3 text-[10px]"
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shiftEmployees.map((emp, i) => {
                const meta = kindMeta[emp.status];
                const photo = (emp as ShiftEmployee & { profileImageUrl?: string }).profileImageUrl;
                return (
                  <tr key={i} className="border-b border-[rgba(99,102,241,0.06)] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setSelected(emp)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar initials={emp.avatar} size="sm" src={photo} />
                        <div>
                          <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{emp.name.split(" ")[0]}</p>
                          <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{emp.dept}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-['Geist_Mono'] ${meta.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${emp.status === "working" ? "animate-pulse" : ""}`} />
                        {emp.status === "working"
                          ? (emp.workTasks[0]?.title
                            || (emp.trackedTasks.length > 0 ? "Clocked in — task not started" : "Clocked in"))
                          : (emp.status === "idle" && (emp.idleDurationMins || 0) > 0 ? `Not at desk for ${emp.idleDurationMins}m` : meta.label)}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <p className="text-xs text-indigo-300 font-['Geist_Mono'] truncate">{emp.currentApp}</p>
                      <p className="text-[10px] text-[#6b7fa8] truncate">{emp.currentScreen.split("—")[0]}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-['Geist_Mono'] text-emerald-400">{emp.activeFor}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1 bg-[#131a35] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${emp.productivity >= 90 ? "bg-emerald-500" : emp.productivity >= 75 ? "bg-indigo-500" : "bg-amber-500"}`}
                            style={{ width: `${emp.productivity}%` }} />
                        </div>
                        <span className={`text-xs font-bold font-['Geist_Mono'] ${emp.productivity >= 90 ? "text-emerald-400" : emp.productivity >= 75 ? "text-indigo-400" : "text-amber-400"}`}>{emp.productivity}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 min-w-[280px] align-top">
                      <TaskStageList tasks={emp.trackedTasks} max={2} large />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-violet-600/15 rounded-lg"><Brain size={14} className="text-violet-400" /></div>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">AI Shift Insights</h3>
          </div>
          <div className="space-y-3">
            {shiftAiInsights.length === 0 ? (
              <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No alerts yet — team activity looks normal.</p>
            ) : (
            shiftAiInsights.map((ins, i) => {
              const isWarn = ins.type === "warning" || ins.type === "idle" || ins.type === "overwork";
              return (
                <div key={i} className={`p-3 rounded-xl border ${isWarn ? "bg-red-500/5 border-red-500/15" : "bg-emerald-500/5 border-emerald-500/15"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isWarn
                      ? <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                      : <Star size={11} className="text-emerald-400 shrink-0" />}
                    <span className={`text-[10px] font-semibold font-['Geist_Mono'] ${isWarn ? "text-amber-400" : "text-emerald-400"}`}>{ins.emp}</span>
                  </div>
                  <p className="text-[11px] text-[#a8b5d1] leading-relaxed mb-2">{ins.msg}</p>
                  <button className={`text-[10px] font-['Geist_Mono'] flex items-center gap-1 ${isWarn ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"} transition-colors`}>
                    {ins.action} <ArrowUpRight size={9} />
                  </button>
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>

      {selected && (
        <EmployeeDetailPanel emp={selected} onClose={() => setSelected(null)} nowMin={nowMin} allTasks={tasks} />
      )}
    </div>
  );
}
