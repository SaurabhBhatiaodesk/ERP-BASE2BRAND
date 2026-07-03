import { isTaskAssignedToUser, type AppTask, type Project } from "@/lib/database";

function parseTaskDueDate(due: string): Date | null {
  if (!due || due === "—") return null;
  const withYear = new Date(`${due} ${new Date().getFullYear()}`);
  if (!Number.isNaN(withYear.getTime())) return withYear;
  const parsed = new Date(due);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFlexibleDate(value: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getBiweeklySprintNumber(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  return Math.max(1, Math.ceil(dayOfYear / 14));
}

function getCurrentBiweeklyRange(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const sprintIndex = Math.floor(dayOfYear / 14);
  const start = new Date(startOfYear);
  start.setDate(startOfYear.getDate() + sprintIndex * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13);
  return { start, end };
}

function scopeTasks(tasks: AppTask[], userName?: string, userId?: string) {
  if (!userName && !userId) return tasks;
  return tasks.filter(t => isTaskAssignedToUser(t.assignee, userName || "", t.assigneeId, userId));
}

export type SprintSummary = {
  sprintNumber: number;
  label: string;
  rangeLabel: string;
  projectName?: string;
};

export function getSprintSummary(
  tasks: AppTask[],
  options?: { userName?: string; userId?: string; projects?: Project[] }
): SprintSummary {
  const now = new Date();
  const sprintNumber = getBiweeklySprintNumber(now);
  const scope = scopeTasks(tasks, options?.userName, options?.userId);
  const projects = options?.projects ?? [];

  const projectIds = [...new Set(scope.map(t => t.projectId).filter(Boolean))];
  const singleProject =
    projectIds.length === 1 ? projects.find(p => p.id === projectIds[0]) : undefined;

  let start: Date | null = null;
  let end: Date | null = null;

  if (singleProject) {
    start = parseFlexibleDate(singleProject.start);
    end = parseFlexibleDate(singleProject.end);
  }

  if (!start || !end) {
    const dueDates = scope
      .map(t => parseTaskDueDate(t.due))
      .filter((d): d is Date => d !== null);

    if (dueDates.length > 0) {
      start = new Date(Math.min(...dueDates.map(d => d.getTime())));
      end = new Date(Math.max(...dueDates.map(d => d.getTime())));
    }
  }

  if (!start || !end) {
    const range = getCurrentBiweeklyRange(now);
    start = range.start;
    end = range.end;
  }

  const firstName = options?.userName?.split(" ")[0];
  const isPersonal =
    Boolean(options?.userName || options?.userId) &&
    options!.userName !== "CEO Admin" &&
    scope.some(t =>
      isTaskAssignedToUser(t.assignee, options!.userName || "", t.assigneeId, options!.userId)
    );

  const prefix = isPersonal && firstName ? `${firstName}'s ` : "";
  const projectPrefix = singleProject ? `${singleProject.name} · ` : "";

  return {
    sprintNumber,
    label: `${projectPrefix}${prefix}Sprint #${sprintNumber}`,
    rangeLabel: `${formatShortDate(start)} – ${formatShortDate(end)}`,
    projectName: singleProject?.name,
  };
}

export function formatTaskManagementSubtitle(
  sprint: SprintSummary,
  visibleCount: number,
  totalCount?: number
) {
  const countLabel =
    totalCount !== undefined && totalCount !== visibleCount
      ? `${visibleCount} of ${totalCount} tasks`
      : `${visibleCount} task${visibleCount === 1 ? "" : "s"}`;

  return `${sprint.label} · ${sprint.rangeLabel} · ${countLabel}`;
}
