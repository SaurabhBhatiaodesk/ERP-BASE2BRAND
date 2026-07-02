import { formatTaskStatusLabel, type AppTask } from "./database";

export type TaskStageHistoryRow = {
  id: string;
  task_id: string;
  project_id: string;
  from_status: string | null;
  to_status: string;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number | null;
  moved_by: string | null;
};

export const TASK_STAGE_SETUP_MSG =
  "Run supabase/task_status_history.sql in Supabase SQL Editor to enable per-column task time tracking.";

const STAGE_ORDER = ["todo", "in-progress", "ready-for-testing", "review", "done"] as const;

export { STAGE_ORDER };

export type StagePipelineEntry = {
  status: string;
  label: string;
  seconds: number;
  isCurrent: boolean;
};

export const stageMeta: Record<
  (typeof STAGE_ORDER)[number],
  { color: string; bg: string; dot: string; label: string }
> = {
  todo: { color: "text-slate-400", bg: "bg-slate-500", dot: "bg-slate-400", label: "To Do" },
  "in-progress": { color: "text-indigo-400", bg: "bg-indigo-500", dot: "bg-indigo-400", label: "In Progress" },
  "ready-for-testing": { color: "text-violet-400", bg: "bg-violet-500", dot: "bg-violet-400", label: "QA" },
  review: { color: "text-amber-400", bg: "bg-amber-500", dot: "bg-amber-400", label: "Review" },
  done: { color: "text-emerald-400", bg: "bg-emerald-500", dot: "bg-emerald-400", label: "Done" },
};

/** All five Kanban columns — always shown with duration (0m if none). */
export function getAllStageEntries(
  currentStatus: string,
  totals: Record<string, number>,
): StagePipelineEntry[] {
  return STAGE_ORDER.map(status => ({
    status,
    label: shortStageLabel(status),
    seconds: totals[status] || 0,
    isCurrent: status === currentStatus,
  }));
}

/** Stages the task has visited or is in — includes Review & Done when applicable. */
export function getVisibleStageEntries(
  currentStatus: string,
  totals: Record<string, number>,
  history: TaskStageHistoryRow[] = [],
): StagePipelineEntry[] {
  const visited = new Set<string>();
  for (const row of history) {
    if (row.to_status) visited.add(row.to_status);
  }
  if (currentStatus) visited.add(currentStatus);

  return STAGE_ORDER
    .filter(status => visited.has(status) || (totals[status] || 0) > 0)
    .map(status => ({
      status,
      label: shortStageLabel(status),
      seconds: totals[status] || 0,
      isCurrent: status === currentStatus,
    }));
}

export function formatStageDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const totalMins = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function shortStageLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "todo") return "To Do";
  if (s === "in-progress") return "In Progress";
  if (s === "ready-for-testing") return "QA";
  if (s === "review") return "Review";
  if (s === "done") return "Done";
  return formatTaskStatusLabel(status);
}

export const TASK_WORK_STAGES = ["in-progress", "ready-for-testing", "review"] as const;

export type AttendanceOverlapWindow = {
  employeeId: string | null;
  clockIn: string;
  clockOut: string | null;
};

function normalizeAssigneeId(id?: string | null) {
  return id?.trim() || "";
}

/** Merge overlapping clock windows so segment overlap is never double-counted. */
export function mergeAttendanceWindows(windows: AttendanceOverlapWindow[]): AttendanceOverlapWindow[] {
  if (windows.length <= 1) return windows;

  const byEmployee = new Map<string, AttendanceOverlapWindow[]>();
  for (const window of windows) {
    const id = normalizeAssigneeId(window.employeeId) || "__unknown__";
    const list = byEmployee.get(id) || [];
    list.push(window);
    byEmployee.set(id, list);
  }

  const merged: AttendanceOverlapWindow[] = [];
  const now = Date.now();

  for (const [id, list] of byEmployee) {
    const intervals = list
      .map(w => ({
        start: new Date(w.clockIn).getTime(),
        end: w.clockOut ? new Date(w.clockOut).getTime() : now,
        employeeId: w.employeeId,
      }))
      .filter(w => w.end > w.start)
      .sort((a, b) => a.start - b.start);

    const stacked: typeof intervals = [];
    for (const interval of intervals) {
      const last = stacked[stacked.length - 1];
      if (!last || interval.start > last.end) {
        stacked.push({ ...interval });
      } else {
        last.end = Math.max(last.end, interval.end);
      }
    }

    for (const interval of stacked) {
      merged.push({
        employeeId: id === "__unknown__" ? null : id,
        clockIn: new Date(interval.start).toISOString(),
        clockOut: interval.end >= now - 1000 ? null : new Date(interval.end).toISOString(),
      });
    }
  }

  return merged;
}

/** Total clocked-in seconds for one employee on a date (working + meeting + idle windows). */
export function attendanceWindowsTotalSeconds(
  windows: AttendanceOverlapWindow[],
  assigneeId?: string | null,
  targetDate?: string,
): number {
  const id = normalizeAssigneeId(assigneeId);
  if (!id || windows.length === 0) return 0;

  const merged = mergeAttendanceWindows(windows);
  const dateStr = targetDate || new Date().toLocaleDateString("en-CA");
  const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
  const dayEnd = new Date(`${dateStr}T23:59:59.999`).getTime();
  const now = Date.now();

  return merged
    .filter(w => normalizeAssigneeId(w.employeeId) === id)
    .reduce((sum, w) => {
      let start = new Date(w.clockIn).getTime();
      let end = w.clockOut ? new Date(w.clockOut).getTime() : now;
      start = Math.max(start, dayStart);
      end = Math.min(end, dayEnd);
      if (end <= start) return sum;
      return sum + Math.floor((end - start) / 1000);
    }, 0);
}

export function taskWorkStageSeconds(totals: Record<string, number>) {
  return TASK_WORK_STAGES.reduce((sum, stage) => sum + (totals[stage] || 0), 0);
}

/** Prevent task work stages from exceeding total clock-in time for the day. */
export function capWorkStageTotals(
  totals: Record<string, number>,
  maxSeconds?: number,
): Record<string, number> {
  if (!maxSeconds || maxSeconds <= 0) return totals;

  const workTotal = taskWorkStageSeconds(totals);
  if (workTotal <= maxSeconds) return totals;

  const next = { ...totals };
  let overflow = workTotal - maxSeconds;
  for (const stage of TASK_WORK_STAGES) {
    const current = next[stage] || 0;
    if (current <= 0) continue;
    const cut = Math.min(current, overflow);
    next[stage] = current - cut;
    overflow -= cut;
    if (overflow <= 0) break;
  }
  return next;
}

/** Closed segments from history + live time in the current column. */
export function aggregateStageSeconds(
  history: TaskStageHistoryRow[],
  currentStatus: string,
  statusEnteredAt?: string | null,
  targetDate?: string, // Format: YYYY-MM-DD
  assigneeId?: string | null,
  attendanceSessions?: AttendanceOverlapWindow[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  const todayIso = new Date().toLocaleDateString("en-CA");
  const scopedAssigneeId = normalizeAssigneeId(assigneeId);
  const attendanceScoped = Boolean(scopedAssigneeId);
  const mergedAttendance = attendanceSessions?.length
    ? mergeAttendanceWindows(attendanceSessions)
    : attendanceSessions;

  const segmentEndMs = (exitedAt: string | null, targetDateStr?: string) => {
    if (exitedAt) return new Date(exitedAt).getTime();
    if (targetDateStr && targetDateStr !== todayIso) {
      return new Date(`${targetDateStr}T23:59:59.999`).getTime();
    }
    return Date.now();
  };

  const getStageOverlapSeconds = (enteredAt: string, exitedAt: string | null, targetDateStr?: string) => {
    let start = new Date(enteredAt).getTime();
    let end = segmentEndMs(exitedAt, targetDateStr);
    if (start >= end) return 0;

    if (targetDateStr) {
      const dayStart = new Date(`${targetDateStr}T00:00:00`).getTime();
      const dayEnd = new Date(`${targetDateStr}T23:59:59.999`).getTime();
      if (start > dayEnd || end < dayStart) return 0;
      start = Math.max(start, dayStart);
      end = Math.min(end, dayEnd);
    }

    if (!attendanceScoped) {
      return Math.floor((end - start) / 1000);
    }

    if (!attendanceSessions?.length) return 0;

    const employeeSessions = mergedAttendance!.filter(
      s => normalizeAssigneeId(s.employeeId) === scopedAssigneeId,
    );
    if (employeeSessions.length === 0) return 0;

    let totalOverlapMs = 0;
    for (const session of employeeSessions) {
      const sessionStart = new Date(session.clockIn).getTime();
      const sessionEnd = session.clockOut
        ? new Date(session.clockOut).getTime()
        : segmentEndMs(null, targetDateStr);

      if (start > sessionEnd || end < sessionStart) continue;
      totalOverlapMs += Math.min(end, sessionEnd) - Math.max(start, sessionStart);
    }
    return Math.floor(totalOverlapMs / 1000);
  };

  for (const row of history) {
    // Open rows are handled below — only the current column may accumulate live time.
    if (!row.exited_at) continue;

    let seconds: number;
    if (attendanceScoped) {
      seconds = getStageOverlapSeconds(row.entered_at, row.exited_at, targetDate);
    } else if (row.duration_seconds != null && row.duration_seconds >= 0) {
      seconds = row.duration_seconds;
    } else {
      seconds = getStageOverlapSeconds(row.entered_at, row.exited_at, targetDate);
    }

    if (row.exited_at) {
      const wallCap = Math.max(
        0,
        Math.floor((new Date(row.exited_at).getTime() - new Date(row.entered_at).getTime()) / 1000),
      );
      seconds = Math.min(seconds, wallCap);
    }

    if (seconds > 0) {
      totals[row.to_status] = (totals[row.to_status] || 0) + seconds;
    }
  }

  const openForCurrent = history.find(row => !row.exited_at && row.to_status === currentStatus);
  const liveStart = openForCurrent?.entered_at || statusEnteredAt;
  if (liveStart && liveStart !== "paused" && currentStatus) {
    const live = getStageOverlapSeconds(liveStart, null, targetDate);
    if (live > 0) {
      totals[currentStatus] = (totals[currentStatus] || 0) + live;
    }
  }
  return totals;
}

/** Same totals logic as employee Kanban — attendance overlap + daily clock cap. */
export function computeTaskStageTotals(
  history: TaskStageHistoryRow[],
  currentStatus: string,
  statusEnteredAt?: string | null,
  options?: {
    targetDate?: string;
    assigneeId?: string | null;
    attendanceSessions?: AttendanceOverlapWindow[];
  },
): Record<string, number> {
  const targetDate = options?.targetDate;
  const assigneeId = options?.assigneeId;
  const attendanceSessions = options?.attendanceSessions;
  const raw = aggregateStageSeconds(
    history,
    currentStatus,
    statusEnteredAt,
    targetDate,
    assigneeId,
    attendanceSessions,
  );
  const maxSeconds =
    assigneeId && attendanceSessions?.length
      ? attendanceWindowsTotalSeconds(attendanceSessions, assigneeId, targetDate)
      : undefined;
  return capWorkStageTotals(raw, maxSeconds);
}

/** Instant UI update when a card moves — closes the old stage and opens the new one. */
export function applyOptimisticTaskStatusMove(
  task: AppTask,
  newStatus: string,
  movedById?: string | null,
): AppTask {
  const previousStatus = task.status;
  if (previousStatus === newStatus) return task;

  const now = new Date().toISOString();
  const nowMs = Date.now();
  const closedHistory = (task.stageHistory || []).map(row => {
    if (row.exited_at) return row;
    const duration = Math.max(0, Math.floor((nowMs - new Date(row.entered_at).getTime()) / 1000));
    return { ...row, exited_at: now, duration_seconds: duration };
  });

  const newRow: TaskStageHistoryRow = {
    id: `opt-${nowMs}`,
    task_id: task.taskId,
    project_id: task.projectId,
    from_status: previousStatus,
    to_status: newStatus,
    entered_at: now,
    exited_at: null,
    duration_seconds: null,
    moved_by: movedById || null,
  };

  return {
    ...task,
    status: newStatus as AppTask["status"],
    statusEnteredAt: now,
    stageHistory: [...closedHistory, newRow],
  };
}

export function aggregateEmployeeStageTotals(tasks: ShiftActiveTask[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const task of tasks) {
    const taskTotals = aggregateStageSeconds(task.stageHistory, task.status, task.statusEnteredAt);
    for (const status of STAGE_ORDER) {
      totals[status] = (totals[status] || 0) + (taskTotals[status] || 0);
    }
  }
  return totals;
}

export type ProportionalStageSegment = {
  status: string;
  label: string;
  seconds: number;
  percent: number;
};

/** Stage durations as % widths for the stacked task-time bar. */
export function buildProportionalStageSegments(
  totals: Record<string, number>,
): ProportionalStageSegment[] {
  const totalSeconds = STAGE_ORDER.reduce((sum, s) => sum + (totals[s] || 0), 0);
  if (totalSeconds <= 0) return [];

  return STAGE_ORDER
    .filter(status => (totals[status] || 0) > 0)
    .map(status => ({
      status,
      label: shortStageLabel(status),
      seconds: totals[status] || 0,
      percent: ((totals[status] || 0) / totalSeconds) * 100,
    }));
}

export function formatStageSummary(
  totals: Record<string, number>,
  order: readonly string[] = STAGE_ORDER,
): string {
  const parts = order
    .filter(s => (totals[s] || 0) > 0)
    .map(s => `${shortStageLabel(s)} ${formatStageDuration(totals[s])}`);
  return parts.join(" · ");
}

export function formatStageStartTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Live elapsed since employee clocked in — e.g. "Since 11:05 AM · 1h 48m" */
export function formatClockInLive(clockInIso: string | null | undefined): string | null {
  if (!clockInIso) return null;
  const start = new Date(clockInIso);
  if (Number.isNaN(start.getTime())) return null;
  const since = formatStageStartTime(clockInIso);
  const mins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const elapsed = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `Since ${since} · ${elapsed}`;
}

export function formatStageEnteredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type ShiftActiveTask = {
  taskId: string;
  title: string;
  status: string;
  project: string;
  stageSummary: string;
  stageTotals: Record<string, number>;
  stageHistory: TaskStageHistoryRow[];
  statusEnteredAt: string;
};

export function effectiveStatusEnteredAt(task: Pick<AppTask, "statusEnteredAt" | "createdAt">) {
  if (task.statusEnteredAt === "paused") return "paused";
  return task.statusEnteredAt || task.createdAt || "";
}

export function buildShiftActiveTask(task?: AppTask | null): ShiftActiveTask | null {
  if (!task) return null;
  const statusEnteredAt = effectiveStatusEnteredAt(task);
  const totals = aggregateStageSeconds(task.stageHistory, task.status, statusEnteredAt);
  return {
    taskId: task.taskId,
    title: task.title,
    status: task.status,
    project: task.project,
    stageSummary: formatStageSummary(totals),
    stageTotals: totals,
    stageHistory: task.stageHistory || [],
    statusEnteredAt,
  };
}

function isTaskTrackedToday(task: AppTask) {
  if (task.status !== "done") return true;
  const ref = task.statusEnteredAt || task.createdAt;
  if (!ref) return false;
  const d = new Date(ref);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function buildShiftActiveTasks(tasks: AppTask[]): ShiftActiveTask[] {
  return tasks.map(buildShiftActiveTask).filter((t): t is ShiftActiveTask => t != null);
}

const TASK_STATUS_SORT_RANK: Record<string, number> = {
  "in-progress": 0,
  "ready-for-testing": 1,
  review: 2,
  todo: 3,
};

function sortEmployeeTasks(tasks: AppTask[]) {
  return [...tasks].sort((a, b) => {
    const rank = (TASK_STATUS_SORT_RANK[a.status] ?? 9) - (TASK_STATUS_SORT_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function tasksForEmployee(tasks: AppTask[], profileId: string, profileName: string, includeDoneToday = false) {
  return tasks.filter(t => {
    if (t.status === "done" && !includeDoneToday) return false;
    if (t.status === "done" && includeDoneToday && !isTaskTrackedToday(t)) return false;
    if (profileId?.trim()) return t.assigneeId?.trim() === profileId.trim();
    return profileName.trim() && t.assignee.trim().toLowerCase() === profileName.trim().toLowerCase();
  });
}

/** Real work — only after employee moves task to In Progress. */
export function listWorkTasksForEmployee(tasks: AppTask[], profileId: string, profileName: string): AppTask[] {
  return sortEmployeeTasks(tasksForEmployee(tasks, profileId, profileName).filter(t => t.status === "in-progress"));
}

export function pickWorkTaskForEmployee(tasks: AppTask[], profileId: string, profileName: string): AppTask | null {
  return listWorkTasksForEmployee(tasks, profileId, profileName)[0] || null;
}

/** All open tasks (+ done today) for TL/CEO — each tracked separately. */
export function listTrackedTasksForEmployee(tasks: AppTask[], profileId: string, profileName: string): AppTask[] {
  return sortEmployeeTasks(tasksForEmployee(tasks, profileId, profileName, true));
}

/** @deprecated use listTrackedTasksForEmployee */
export function pickTrackedTaskForEmployee(tasks: AppTask[], profileId: string, profileName: string): AppTask | null {
  return listTrackedTasksForEmployee(tasks, profileId, profileName)[0] || null;
}

/** @deprecated use pickWorkTaskForEmployee or pickTrackedTaskForEmployee */
export function pickPrimaryTaskForEmployee(tasks: AppTask[], profileId: string, profileName: string): AppTask | null {
  return pickTrackedTaskForEmployee(tasks, profileId, profileName);
}
