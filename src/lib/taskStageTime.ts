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

/** Closed segments from history + live time in the current column. */
export function aggregateStageSeconds(
  history: TaskStageHistoryRow[],
  currentStatus: string,
  statusEnteredAt?: string | null,
  targetDate?: string, // Format: YYYY-MM-DD
): Record<string, number> {
  const totals: Record<string, number> = {};

  const getOverlapSeconds = (enteredAt: string, exitedAt: string | null, targetDateStr: string) => {
    const dayStart = new Date(`${targetDateStr}T00:00:00`).getTime();
    const dayEnd = new Date(`${targetDateStr}T23:59:59.999`).getTime();
    const start = new Date(enteredAt).getTime();
    const end = exitedAt ? new Date(exitedAt).getTime() : Date.now();

    if (start > dayEnd || end < dayStart) return 0;
    const overlapStart = Math.max(start, dayStart);
    const overlapEnd = Math.min(end, dayEnd);
    return Math.floor((overlapEnd - overlapStart) / 1000);
  };

  for (const row of history) {
    // Skip the open row in history, because the live time is handled below using statusEnteredAt
    if (!row.exited_at) continue;

    if (targetDate) {
       const overlap = getOverlapSeconds(row.entered_at, row.exited_at, targetDate);
       if (overlap > 0) {
         totals[row.to_status] = (totals[row.to_status] || 0) + overlap;
       }
    } else {
      if (row.duration_seconds != null) {
        totals[row.to_status] = (totals[row.to_status] || 0) + row.duration_seconds;
      }
    }
  }

  if (statusEnteredAt && statusEnteredAt !== "paused" && currentStatus) {
    if (targetDate) {
      const overlap = getOverlapSeconds(statusEnteredAt, null, targetDate);
      if (overlap > 0) {
        totals[currentStatus] = (totals[currentStatus] || 0) + overlap;
      }
    } else {
      const live = Math.max(
        0,
        Math.floor((Date.now() - new Date(statusEnteredAt).getTime()) / 1000),
      );
      totals[currentStatus] = (totals[currentStatus] || 0) + live;
    }
  }
  return totals;
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
    if (profileId && t.assigneeId === profileId) return true;
    return t.assignee.trim().toLowerCase() === profileName.trim().toLowerCase();
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
