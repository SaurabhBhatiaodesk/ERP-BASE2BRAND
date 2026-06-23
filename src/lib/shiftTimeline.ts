import type { ClockSessionRecord, ClockSessionSegment } from "./database";
import type { ActivityKind, ShiftEmployee, TimelineBlock } from "@/app/components/views/ShiftView";
import type { AppTask } from "./database";
import { buildShiftActiveTasks, shortStageLabel, type ShiftActiveTask } from "./taskStageTime";
import {
  SHIFT_DURATION,
  TIMELINE_AXIS_DURATION,
  TIMELINE_AXIS_START,
  clockMinutesToLabel,
  isoToTimelineMinutes,
  currentTimelineNowMin,
} from "@/app/components/views/ShiftView";

export const DEFAULT_SHIFT_START = "10:00";

export const SHIFT_START_OPTIONS = [
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
] as const;

export function parseShiftStartMinutes(value?: string | null) {
  if (!value?.trim()) return 10 * 60;
  const t = value.trim().toUpperCase();
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const ap = m12[3];
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  return 10 * 60;
}

export function formatShiftStartLabel(value?: string | null) {
  return clockMinutesToLabel(parseShiftStartMinutes(value));
}

export function sessionStatusToActivity(session: ClockSessionRecord | null): ActivityKind {
  if (!session) return "offline";
  if (session.status === "active") return "working";
  if (session.status === "paused") {
    if (session.notes?.toLowerCase().includes("meeting")) return "meeting";
    // Check last segment kind to see if it was an idle pause vs a manual break
    const segments = session.segments || [];
    const lastSeg = [...segments].sort((a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    ).slice(-1)[0];
    if (lastSeg && lastSeg.kind === "idle") return "idle";
    // Also check notes for "idle" keyword (legacy data)
    if (session.notes?.toLowerCase().includes("idle") || session.notes?.toLowerCase().includes("system idle")) return "idle";
    return "break";
  }
  if (session.status === "completed") return "offline";
  return "offline";
}

export function segmentsToTimeline(
  segments: ClockSessionSegment[],
  loginMin: number,
): TimelineBlock[] {
  const blocks: TimelineBlock[] = [
    { kind: "login", label: "Logged in", start: loginMin, end: loginMin },
  ];
  const sorted = [...segments].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  for (const seg of sorted) {
    // kind=idle (new) OR kind=break with "idle"/"System Idle" label (legacy data)
    const isIdle = seg.kind === "idle" || (seg.kind === "break" && (seg.label.toLowerCase().includes("idle") || seg.label === "System Idle"));
    blocks.push({
      kind: isIdle ? "idle" : seg.kind,
      label: isIdle ? "Idle" : seg.label,
      start: isoToTimelineMinutes(seg.startedAt),
      end: seg.endedAt ? isoToTimelineMinutes(seg.endedAt) : null,
    });
  }
  return blocks;
}

function pauseLabelFromNotes(notes?: string | null) {
  const cleaned = notes?.replace(/^Break:\s*/i, "").trim();
  if (!cleaned || /^office attendance$/i.test(cleaned)) return "Break / away";
  return cleaned;
}

function prependMissingWork(blocks: TimelineBlock[], session: ClockSessionRecord): TimelineBlock[] {
  const loginMin = isoToTimelineMinutes(session.clockIn);
  const activity = blocks.filter(b => b.kind !== "login").sort((a, b) => a.start - b.start);
  if (!activity.length) return blocks;

  const firstStart = activity[0].start;
  if (firstStart <= loginMin + 5) return blocks;

  // Time from clock-in until first saved segment = work, not break
  return [
    blocks[0],
    { kind: "working", label: "Office attendance", start: loginMin, end: firstStart },
    ...activity,
  ];
}

/** Only stitch tiny gaps between segments (rounding); never invent breaks. */
function fillSmallGapsOnly(blocks: TimelineBlock[], nowMin: number): TimelineBlock[] {
  const login = blocks.find(b => b.kind === "login");
  const activity = blocks.filter(b => b.kind !== "login").sort((a, b) => a.start - b.start);
  if (!activity.length) return blocks;

  const result: TimelineBlock[] = login ? [login] : [];
  let cursor = activity[0].start;

  for (const block of activity) {
    if (block.start > cursor + 1 && block.start - cursor <= 2) {
      const prev = result[result.length - 1];
      if (prev && prev.kind !== "login") {
        prev.end = block.start;
      }
    } else if (block.start > cursor + 1) {
      result.push({ kind: "idle", label: "Idle", start: cursor, end: block.start });
    }
    result.push({ ...block });
    cursor = block.end ?? nowMin;
  }
  return result;
}

function legacySessionToTimeline(session: ClockSessionRecord, nowMin: number): TimelineBlock[] {
  const loginMin = isoToTimelineMinutes(session.clockIn);
  const blocks: TimelineBlock[] = [
    { kind: "login", label: "Logged in", start: loginMin, end: loginMin },
  ];
  const workedMins = Math.round((Number(session.hours) || 0) * 60);

  if (session.status === "active") {
    const start = isoToTimelineMinutes(session.sessionStart || session.clockIn);
    if (workedMins > 0 && start > loginMin + 5) {
      blocks.push({ kind: "working", label: "Office attendance", start: loginMin, end: loginMin + workedMins });
      if (start > loginMin + workedMins + 1) {
        blocks.push({
          kind: "break",
          label: pauseLabelFromNotes(session.notes),
          start: loginMin + workedMins,
          end: start,
        });
      }
    }
    blocks.push({ kind: "working", label: "Office attendance", start, end: null });
    return blocks;
  }

  if (session.status === "paused") {
    const breakStart = session.sessionStart
      ? isoToTimelineMinutes(session.sessionStart)
      : Math.min(nowMin, loginMin + Math.max(workedMins, 1));
    const workEnd = Math.max(loginMin, Math.min(breakStart, nowMin));
    if (workEnd > loginMin) {
      blocks.push({ kind: "working", label: "Office attendance", start: loginMin, end: workEnd });
    }
    const isMeeting = session.notes?.toLowerCase().includes("meeting");
    blocks.push({
      kind: isMeeting ? "meeting" : "break",
      label: pauseLabelFromNotes(session.notes),
      start: workEnd,
      end: null,
    });
    return blocks;
  }

  const end = session.clockOut
    ? isoToTimelineMinutes(session.clockOut)
    : Math.min(nowMin, loginMin + Math.max(workedMins, 1));
  blocks.push({ kind: "working", label: "Office attendance", start: loginMin, end });
  return blocks;
}

export function sessionToTimeline(session: ClockSessionRecord, nowMin: number): TimelineBlock[] {
  const loginMin = isoToTimelineMinutes(session.clockIn);
  let blocks: TimelineBlock[];

  if (session.segments && session.segments.length > 0) {
    blocks = segmentsToTimeline(session.segments, loginMin);
    blocks = prependMissingWork(blocks, session);
  } else {
    blocks = legacySessionToTimeline(session, nowMin);
  }

  return fillSmallGapsOnly(blocks, nowMin);
}

export function timelineDuration(
  timeline: TimelineBlock[],
  kind: ActivityKind,
  nowMin: number,
  window?: { start: number; end: number },
) {
  return timeline
    .filter(b => b.kind === kind)
    .reduce((sum, b) => {
      const rawEnd = b.end ?? nowMin;
      const start = window ? Math.max(b.start, window.start) : b.start;
      const end = window ? Math.min(rawEnd, window.end) : rawEnd;
      return sum + Math.max(0, end - start);
    }, 0);
}

/** Productivity within each employee's own shift window (not the global axis end). */
export function calcProductivity(
  timeline: TimelineBlock[],
  nowMin: number,
  shiftStartMin: number,
  shiftEndMin: number,
) {
  const shiftStartAxis = Math.max(0, shiftStartMin - TIMELINE_AXIS_START);
  const shiftEndAxis = shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, shiftEndAxis);
  if (effectiveNow <= shiftStartAxis) return 0;

  const window = { start: shiftStartAxis, end: effectiveNow };
  const worked = timelineDuration(timeline, "working", effectiveNow, window);
  const meetings = timelineDuration(timeline, "meeting", effectiveNow, window);
  const breaks = timelineDuration(timeline, "break", effectiveNow, window);
  const idle = timelineDuration(timeline, "idle", effectiveNow, window);
  const productive = worked + meetings;
  const total = productive + breaks + idle;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((productive / total) * 100));
}

export function formatDurationMinutes(mins: number) {
  if (mins <= 0) return "0m";
  // Show seconds when duration is very short (< 1 minute)
  if (mins < 1) {
    const secs = Math.round(mins * 60);
    return secs > 0 ? `${secs}s` : "0m";
  }
  const totalMins = Math.floor(mins);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Break / meeting blocks with duration (minutes). */
export function listPauseBlocks(timeline: TimelineBlock[], nowMin: number) {
  return timeline
    .filter(b => b.kind === "break" || b.kind === "meeting")
    .map(b => ({
      ...b,
      durationMin: Math.max(0, (b.end ?? nowMin) - b.start),
    }));
}

export function buildShiftEmployee(input: {
  id: string;
  name: string;
  avatar: string;
  role: string;
  dept: string;
  profileImageUrl?: string;
  shiftStart?: string | null;
  lastActiveAt?: string | null;
  session: ClockSessionRecord | null;
  currentTask?: string;
  workTasksInput?: AppTask[];
  trackedTasksInput?: AppTask[];
  targetDate?: string;
}): ShiftEmployee & { profileImageUrl?: string } {
  const {
    id, name, avatar, role, dept, session, currentTask = "—", profileImageUrl, shiftStart,
    lastActiveAt, workTasksInput = [], trackedTasksInput = [], targetDate,
  } = input;
  const workTasks = buildShiftActiveTasks(workTasksInput);
  const trackedTasks = buildShiftActiveTasks(trackedTasksInput);
  const workTask = workTasks[0] ?? null;
  const taskTitle = workTask?.title || currentTask;
  const shiftStartMin = parseShiftStartMinutes(shiftStart);
  const shiftEndMin = shiftStartMin + SHIFT_DURATION;
  const shiftStartLabel = formatShiftStartLabel(shiftStart);
  const shiftEndLabel = clockMinutesToLabel(shiftEndMin);
  const nowMin = targetDate ? 1440 : currentTimelineNowMin();
  const shiftEndAxis = shiftEndMin - TIMELINE_AXIS_START;
  const effectiveNow = Math.min(nowMin, shiftEndAxis);
  const timeline = session ? sessionToTimeline(session, effectiveNow) : [];
  const status = sessionStatusToActivity(session);
  const productivity = calcProductivity(timeline, nowMin, shiftStartMin, shiftEndMin);

  const activeSeg = [...timeline].reverse().find(b => b.end === null && b.kind !== "login");
  const activeMins = activeSeg ? Math.max(0, effectiveNow - activeSeg.start) : 0;

  const loginIso = session?.clockIn;
  const loginTime = loginIso
    ? new Date(loginIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "—";

  const loginClockMin = loginIso
    ? new Date(loginIso).getHours() * 60 + new Date(loginIso).getMinutes()
    : null;

  let currentStatus = status;
  let idleMins = 0;
  if (status === "working" && lastActiveAt) {
    idleMins = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60000);
    if (idleMins > 2) {
      currentStatus = "idle";
      const lastBlock = timeline[timeline.length - 1];
      if (lastBlock && lastBlock.kind === "working" && lastBlock.end === null) {
        const idleStartMin = isoToTimelineMinutes(lastActiveAt);
        const finalIdleStart = Math.max(idleStartMin, lastBlock.start);
        lastBlock.end = finalIdleStart;
        timeline.push({
          kind: "idle",
          label: "Idle",
          start: finalIdleStart,
          end: null
        });
      }
    }
  }

  return {
    id,
    name,
    avatar,
    role,
    dept,
    profileImageUrl,
    shiftStartMin,
    shiftEndMin,
    shiftStartLabel,
    shiftEndLabel,
    loginTime,
    clockInAt: loginIso || null,
    lastActiveAt: lastActiveAt || null,
    idleDurationMins: idleMins,
    currentTask: currentStatus === "working" ? taskTitle : session?.notes?.replace(/^Break:\s*/, "") || taskTitle,
    currentApp: currentStatus === "working" && workTask ? "BASE2BRAND ERP" : "—",
    currentScreen: currentStatus === "working" ? taskTitle : session?.notes || "—",
    workTasks,
    trackedTasks,
    activeFor: formatDurationMinutes(activeMins),
    productivity,
    status: currentStatus,
    location:
      currentStatus === "meeting"
        ? "In Meeting"
        : currentStatus === "break"
          ? "On Break"
          : currentStatus === "working"
            ? "At Desk"
            : "Offline",
    completionEst: shiftEndLabel,
    lateStart: loginClockMin != null ? loginClockMin > shiftStartMin + 15 : false,
    timeline,
  };
}

export type ShiftInsight = {
  type: "warning" | "idle" | "star" | "overwork";
  emp: string;
  msg: string;
  action: string;
};

export function buildShiftInsights(employees: ShiftEmployee[]): ShiftInsight[] {
  const insights: ShiftInsight[] = [];
  for (const emp of employees) {
    if (emp.lateStart) {
      insights.push({
        type: "warning",
        emp: emp.name,
        msg: `Started late today (shift ${emp.shiftStartLabel}, logged in ${emp.loginTime}).`,
        action: "Send Reminder",
      });
    }
    if (emp.status === "offline") {
      insights.push({
        type: "idle",
        emp: emp.name,
        msg: `Not clocked in — shift starts ${emp.shiftStartLabel}.`,
        action: "Ping Employee",
      });
    }
    if (emp.status === "break" && emp.activeFor !== "0m") {
      insights.push({
        type: "idle",
        emp: emp.name,
        msg: `On break — ${emp.currentTask}.`,
        action: "View Timeline",
      });
    }
    if (emp.productivity >= 90 && emp.status === "working") {
      insights.push({
        type: "star",
        emp: emp.name,
        msg: `Strong focus today (${emp.productivity}% productivity).`,
        action: "View Report",
      });
    }
  }
  return insights.slice(0, 6);
}

export { currentTimelineNowMin as currentShiftNowMin };

export type StageTimelineBlock = {
  status: string;
  label: string;
  start: number;
  end: number;
  taskTitle: string;
};

function stageHistoryToBlocks(task: ShiftActiveTask, effectiveNowMin: number): StageTimelineBlock[] {
  const blocks: StageTimelineBlock[] = [];
  const openStatuses = new Set<string>();

  for (const row of task.stageHistory) {
    const start = isoToTimelineMinutes(row.entered_at);
    const end = row.exited_at ? isoToTimelineMinutes(row.exited_at) : null;
    if (!row.exited_at) openStatuses.add(row.to_status);
    blocks.push({
      status: row.to_status,
      label: shortStageLabel(row.to_status),
      start,
      end: end !== null ? Math.min(end, effectiveNowMin) : effectiveNowMin,
      taskTitle: task.title,
    });
  }

  if (!openStatuses.has(task.status) && task.statusEnteredAt && task.status) {
    blocks.push({
      status: task.status,
      label: shortStageLabel(task.status),
      start: isoToTimelineMinutes(task.statusEnteredAt),
      end: effectiveNowMin,
      taskTitle: task.title,
    });
  }

  return blocks.filter(b => b.end > b.start);
}

/** Chronological task-stage segments for the team timeline bar. */
export function buildEmployeeStageTimeline(
  tasks: ShiftActiveTask[],
  effectiveNowMin: number,
): StageTimelineBlock[] {
  return tasks
    .flatMap(task => stageHistoryToBlocks(task, effectiveNowMin))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}
