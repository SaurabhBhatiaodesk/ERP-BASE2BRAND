import type { RealtimeChannel } from "@supabase/supabase-js";
import { normalizeCloudinaryDeliveryUrl } from "./cloudinary";
import { supabase } from "./supabase";
import type { TaskStageHistoryRow } from "./taskStageTime";

// ─── DB row types (snake_case from Supabase) ─────────────────────────────────

export type DbLead = {
  id: number;
  name: string;
  value: string;
  stage: string;
  temp: string;
  contact: string;
  days: number;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  industry?: string | null;
  title?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type DbProjectTask = {
  id?: string;
  title?: string;
  status?: string;
  assignee?: string;
  assigneeId?: string;
  due?: string;
  est?: string;
  priority?: string;
  workNotes?: string;
  entryType?: "task" | "timesheet";
  linkedTaskId?: string;
  employee?: string;
  employeeId?: string;
  date?: string;
  hours?: number;
  description?: string;
};

export type TimesheetEntryKind = "manual" | "task";

export type TimesheetEntry = {
  id: string;
  projectId: string;
  projectName: string;
  employee: string;
  employeeId?: string;
  date: string;
  hours: number;
  description: string;
  taskTitle?: string;
  taskStatus?: string;
  workNotes?: string;
  status: string;
  kind: TimesheetEntryKind;
  taskId?: string;
};

function timesheetEntryKind(item: DbProjectTask, entryId: string): TimesheetEntryKind {
  if (entryId.startsWith("virtual-ts-") || entryId.startsWith("ts-task-") || item.linkedTaskId) {
    return "task";
  }
  return "manual";
}

function taskIdFromTimesheetEntryId(entryId: string, linkedTaskId?: string) {
  if (linkedTaskId) return linkedTaskId;
  if (entryId.startsWith("virtual-ts-")) return entryId.slice("virtual-ts-".length);
  if (entryId.startsWith("ts-task-")) return entryId.slice("ts-task-".length);
  return undefined;
}

export type DbTimelinePhase = {
  phase: string;
  start: number;
  width: number;
  color: string;
};

export type DbProject = {
  id: string;
  name: string;
  client: string;
  lead: string;
  lead_id?: string | null;
  team_ids?: string[] | null;
  dept: string;
  status: string;
  priority: string;
  progress: number;
  start_date: string;
  deadline: string;
  budget: string;
  spent: string;
  description: string;
  team: unknown;
  tasks: DbProjectTask[];
  timeline: DbTimelinePhase[];
  created_at?: string;
};

export type DbWeeklyHour = { day: string; h: number };

export type DbEmployeeProfile = {
  id: string;
  name: string;
  role: string;
  dept: string;
  email: string;
  phone: string;
  location: string;
  joined: string;
  score: number;
  status: string;
  salary: string;
  manager: string;
  skills: string[];
  bio: string;
  weekly_hours: DbWeeklyHour[];
  attendance: number;
  leaves: number;
  projects: number;
  revenue: string;
  avatar?: string;
  profile_image_url?: string | null;
  trend?: string;
  app_role?: string;
  shift_start?: string | null;
  last_active_at?: string | null;
  created_at?: string;
};

// ─── App types (camelCase for UI) ────────────────────────────────────────────

export type Employee = {
  name: string;
  role: string;
  dept: string;
  score: number;
  status: string;
  avatar: string;
  profileImageUrl: string;
  trend: string;
};

export type Lead = {
  id?: number;
  name: string;
  value: string;
  stage: string;
  temp: string;
  contact: string;
  days: number;
};

export type ClientProfile = {
  id: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  value: string;
  stage: string;
  temperature: string;
  since: string;
  industry: string;
  employees: string;
  notes: string;
  meetings: { date: string; type: string; outcome: string; duration: string }[];
  proposals: { name: string; value: string; status: string; date: string }[];
  payments: { invoice: string; amount: string; status: string; date: string }[];
  tags: string[];
};

export type ProjectTeamMember = {
  id: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  lead: string;
  leadId?: string;
  dept: string;
  status: string;
  priority: string;
  progress: number;
  start: string;
  end: string;
  budget: string;
  spent: string;
  desc: string;
  team: string[];
  teamMembers: ProjectTeamMember[];
  teamIds: string[];
  tasks: { title: string; status: string; assignee: string; due: string }[];
  timeline: DbTimelinePhase[];
};

export type EmployeeProfile = {
  id: string;
  name: string;
  role: string;
  dept: string;
  email: string;
  phone: string;
  location: string;
  joined: string;
  score: number;
  status: string;
  salary: string;
  manager: string;
  skills: string[];
  bio: string;
  weeklyHours: DbWeeklyHour[];
  last_active_at: string | null;
  recentTasks: { title: string; status: string; due: string }[];
  attendance: number;
  leaves: number;
  projects: number;
  revenue: string;
  appRole: string;
  profileImageUrl: string;
  avatar: string;
  /** HH:MM — e.g. 10:00, 11:00, 12:00 */
  shiftStart: string;
};

export type AppTask = {
  id: string;
  taskId: string;
  projectId: string;
  title: string;
  assignee: string;
  assigneeId: string;
  priority: string;
  status: string;
  due: string;
  dueIso: string;
  dueDay: number;
  startDay: number;
  project: string;
  est: string;
  workNotes: string;
  createdAt: string;
  statusEnteredAt: string;
  stageHistory: TaskStageHistoryRow[];
};

export type DbProjectMemberRow = {
  id: string;
  project_id: string;
  employee_id: string;
  role: string;
};

export type DbProjectTaskRow = {
  id: string;
  project_id: string;
  assignee_id: string | null;
  title: string;
  status: string;
  priority: string;
  due: string | null;
  est: string | null;
  work_notes: string;
  created_at?: string;
  updated_at?: string;
  status_entered_at?: string | null;
};

export type DbTimesheetEntryRow = {
  id: string;
  project_id: string;
  employee_id: string | null;
  linked_task_id: string | null;
  date: string;
  hours: number;
  description: string;
  created_at?: string;
};

export const PROJECT_RELATIONS_SETUP_MSG =
  "Run supabase/project_relations.sql in Supabase SQL Editor for ID-based team & tasks.";

let projectRelationsReady: boolean | null = null;

function isMissingProjectRelationsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number; statusCode?: number };
  const status = e.status ?? e.statusCode;
  return (
    status === 404 ||
    e.code === "PGRST205" ||
    /could not find the table.*project_members/i.test(e.message || "") ||
    /relation.*project_members.*does not exist/i.test(e.message || "")
  );
}

async function probeProjectRelations(): Promise<boolean> {
  if (projectRelationsReady !== null) return projectRelationsReady;
  const { error } = await supabase.from("project_members").select("id").limit(1);
  projectRelationsReady = !error || !isMissingProjectRelationsTable(error);
  return projectRelationsReady;
}

export async function isProjectRelationsReady() {
  return probeProjectRelations();
}

export type { TaskStageHistoryRow };
export { TASK_STAGE_SETUP_MSG } from "./taskStageTime";

let taskStageTrackingReady: boolean | null = null;

function isMissingTaskStageTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number; statusCode?: number };
  const status = e.status ?? e.statusCode;
  return (
    status === 404 ||
    e.code === "PGRST205" ||
    /could not find the table.*task_status_history/i.test(e.message || "") ||
    /relation.*task_status_history.*does not exist/i.test(e.message || "")
  );
}

async function probeTaskStageTracking(): Promise<boolean> {
  if (taskStageTrackingReady !== null) return taskStageTrackingReady;
  if (!(await probeProjectRelations())) {
    taskStageTrackingReady = false;
    return false;
  }
  const { error } = await supabase.from("task_status_history").select("id").limit(1);
  taskStageTrackingReady = !error || !isMissingTaskStageTable(error);
  return taskStageTrackingReady;
}

export async function isTaskStageTrackingReady() {
  return probeTaskStageTracking();
}

function newStageHistoryId() {
  return `tsh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function openInitialTaskStatusSegment(input: {
  taskId: string;
  projectId: string;
  status: string;
  enteredAt?: string;
}) {
  const enteredAt = input.enteredAt || new Date().toISOString();
  const { error } = await supabase.from("task_status_history").insert({
    id: newStageHistoryId(),
    task_id: input.taskId,
    project_id: input.projectId,
    from_status: null,
    to_status: input.status,
    entered_at: enteredAt,
  });
  if (error) throw error;
  return enteredAt;
}

async function recordTaskStatusChange(input: {
  taskId: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  movedById?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();

  const { data: openRows, error: openError } = await supabase
    .from("task_status_history")
    .select("*")
    .eq("task_id", input.taskId)
    .is("exited_at", null)
    .order("entered_at", { ascending: false })
    .limit(1);
  if (openError) throw openError;

  const open = (openRows?.[0] || null) as TaskStageHistoryRow | null;
  if (open) {
    const duration = Math.max(
      0,
      Math.floor((Date.now() - new Date(open.entered_at).getTime()) / 1000),
    );
    const { error: closeError } = await supabase
      .from("task_status_history")
      .update({ exited_at: now, duration_seconds: duration })
      .eq("id", open.id);
    if (closeError) throw closeError;
  }

  const { error: insertError } = await supabase.from("task_status_history").insert({
    id: newStageHistoryId(),
    task_id: input.taskId,
    project_id: input.projectId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    entered_at: now,
    moved_by: input.movedById || null,
  });
  if (insertError) throw insertError;

  return now;
}

async function enrichTasksWithStageHistory(tasks: AppTask[]): Promise<AppTask[]> {
  if (!(await probeTaskStageTracking()) || tasks.length === 0) {
    return tasks.map(t => ({ ...t, stageHistory: t.stageHistory || [] }));
  }

  const taskIds = tasks.map(t => t.taskId);
  const { data, error } = await supabase
    .from("task_status_history")
    .select("*")
    .in("task_id", taskIds)
    .order("entered_at", { ascending: true });
  if (error) return tasks;

  const byTask = new Map<string, TaskStageHistoryRow[]>();
  for (const row of (data || []) as TaskStageHistoryRow[]) {
    const list = byTask.get(row.task_id) || [];
    list.push(row);
    byTask.set(row.task_id, list);
  }

  return tasks.map(task => ({
    ...task,
    stageHistory: byTask.get(task.taskId) || [],
  }));
}

function profileNameById(profiles: EmployeeProfile[], id?: string | null) {
  if (!id) return "";
  return profiles.find(p => p.id === id)?.name || "";
}

function profileIdByName(profiles: EmployeeProfile[], name?: string) {
  if (!name?.trim()) return "";
  return profiles.find(p => namesMatch(p.name, name))?.id || "";
}

/** Read team JSONB: legacy `["name"]` or new `[{ id, name }]`. */
export function parseTeamFromDb(team: unknown, profiles?: EmployeeProfile[]) {
  if (!team || !Array.isArray(team)) {
    return { members: [] as ProjectTeamMember[], names: [] as string[], ids: [] as string[] };
  }

  const members: ProjectTeamMember[] = team
    .map(item => {
      if (typeof item === "string") {
        const name = item.trim();
        if (!name) return null;
        const id = profiles ? profileIdByName(profiles, name) : "";
        return { id, name };
      }
      if (item && typeof item === "object") {
        const row = item as { id?: string; name?: string };
        const name = (row.name || "").trim();
        if (!name) return null;
        return { id: row.id || (profiles ? profileIdByName(profiles, name) : ""), name };
      }
      return null;
    })
    .filter((m): m is ProjectTeamMember => Boolean(m));

  return {
    members,
    names: members.map(m => m.name),
    ids: members.map(m => m.id).filter(Boolean),
  };
}

function buildTeamForDb(memberIds: string[], profiles: EmployeeProfile[]): ProjectTeamMember[] {
  return memberIds
    .map(id => ({
      id,
      name: profileNameById(profiles, id) || "—",
    }))
    .filter(m => m.id && m.name !== "—");
}

function mapProjectTaskRowToAppTask(
  row: DbProjectTaskRow,
  projectName: string,
  profiles: EmployeeProfile[]
): AppTask {
  const taskId = row.id;
  return {
    id: taskId,
    taskId,
    projectId: row.project_id,
    title: row.title,
    assignee: profileNameById(profiles, row.assignee_id) || "—",
    assigneeId: row.assignee_id || "",
    priority: mapPriority(row.priority),
    status: mapTaskStatus(row.status || "todo"),
    due: formatTaskDueDisplay(row.due),
    dueIso: row.due || "",
    dueDay: parseDueDay(row.due || undefined),
    startDay: 0,
    project: projectName,
    est: row.est || "—",
    workNotes: row.work_notes || "",
    createdAt: row.created_at || taskCreatedAtFromId(taskId) || "",
    statusEnteredAt: row.status_entered_at === null ? "paused" : (row.status_entered_at || row.created_at || taskCreatedAtFromId(taskId) || ""),
    stageHistory: [],
  };
}

function taskCreatedAtFromId(taskId: string): string | null {
  const match = taskId.match(/^task-(\d{10,})$/);
  if (!match) return null;
  const ms = Number(match[1]);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

export function resolveTaskCreatedAt(task: AppTask) {
  if (task.createdAt) return task.createdAt;
  return taskCreatedAtFromId(task.taskId) || "";
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

/** Stored in DB — employee submits work for QA */
export const TASK_STATUS_READY_FOR_QA = "ready-for-testing";
/** Stored in DB — CEO / Team Leader review before Done */
export const TASK_STATUS_REVIEW = "review";

function mapTaskStatus(status: string): string {
  const s = status.toLowerCase().trim();
  if (s === "done") return "done";
  if (s.includes("progress")) return "in-progress";
  if (s === TASK_STATUS_REVIEW || s === "in review") return TASK_STATUS_REVIEW;
  if (
    s === TASK_STATUS_READY_FOR_QA ||
    s === "ready for testing" ||
    s === "ready for qa" ||
    s === "ready-for-qa" ||
    s.includes("ready-for-test")
  ) {
    return TASK_STATUS_READY_FOR_QA;
  }
  return "todo";
}

export function formatTaskStatusLabel(status?: string) {
  const s = mapTaskStatus(status || "todo");
  if (s === "done") return "Done";
  if (s === "in-progress") return "In progress";
  if (s === TASK_STATUS_REVIEW) return "Review";
  if (s === TASK_STATUS_READY_FOR_QA) return "Ready for QA";
  return "To do";
}

export function normalizeTaskStatusForStorage(status?: string) {
  return mapTaskStatus(status || "todo");
}

function taskHasLoggedTime(task: {
  est?: string | null;
  work_notes?: string | null;
  workNotes?: string | null;
}) {
  const hours = parseEstHoursFromTask(task.est || undefined);
  const notes = (task.work_notes ?? task.workNotes ?? "").trim();
  return hours > 0 && notes.length > 0;
}

function mapPriority(priority?: string): string {
  return (priority || "medium").toLowerCase();
}

export function initialsFromName(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/** HR list/card view — sourced from employee_profiles only. */
export function profileToEmployee(row: DbEmployeeProfile): Employee {
  return {
    name: row.name,
    role: row.role,
    dept: row.dept,
    score: row.score,
    status: row.status,
    avatar: row.avatar || initialsFromName(row.name),
    profileImageUrl: row.profile_image_url || "",
    trend: row.trend || "up",
  };
}

export function mapLead(row: DbLead): Lead {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    stage: row.stage,
    temp: row.temp,
    contact: row.contact,
    days: row.days,
  };
}

function isTimesheetEntry(t: DbProjectTask) {
  return t.entryType === "timesheet";
}

/** Legacy auto-entries from old Clock In/Out → timesheet sync (office attendance only). */
function isClockAttendanceTimesheetEntry(t: DbProjectTask) {
  if (!isTimesheetEntry(t) || t.linkedTaskId) return false;
  const text = `${t.title || ""} ${t.description || ""}`.toLowerCase();
  return (
    text.includes("clock in / clock out") ||
    text.includes("clock in/clock out") ||
    text.trim() === "office attendance"
  );
}

function isWorkTask(t: DbProjectTask) {
  return !isTimesheetEntry(t) && Boolean(t.title);
}

function parseEstHoursFromTask(est?: string) {
  const num = parseFloat(String(est || "").replace(/[^\d.]/g, ""));
  return Number.isNaN(num) || num <= 0 ? 0 : num;
}

function taskWorkDescription(task: DbProjectTask) {
  return task.workNotes?.trim() || task.title || "";
}

function resolveTimesheetFromTask(project: DbProject, item: DbProjectTask) {
  const linkedTask = item.linkedTaskId
    ? (project.tasks || []).find(t => isWorkTask(t) && t.id === item.linkedTaskId)
    : null;
  const taskTitle = linkedTask?.title || item.title || "";
  const workNotes = linkedTask?.workNotes?.trim() || item.description?.trim() || "";
  return {
    taskTitle,
    workNotes,
    description: workNotes || taskTitle,
  };
}

export function formatLocalDateIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse task due from ISO (2026-06-11) or short text (Jun 11). Returns null if unknown. */
export function parseTaskDueDate(due?: string): Date | null {
  if (!due || due === "—") return null;
  const trimmed = due.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  const withYear = trimmed.includes(",")
    ? trimmed.replace(",", "")
    : `${trimmed} ${new Date().getFullYear()}`;
  const shortText = new Date(`${withYear}T12:00:00`);
  if (!Number.isNaN(shortText.getTime())) return shortText;

  const isoTry = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;

  return null;
}

export function formatTaskDueDisplay(due?: string | null) {
  if (!due || due === "—") return "—";
  const d = parseTaskDueDate(due);
  if (!d) return due;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dueInputToStorageIso(due?: string) {
  if (!due) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(due)) return due.slice(0, 10);
  const parsed = parseTaskDueDate(due);
  return parsed ? formatLocalDateIso(parsed) : null;
}

function taskDueToIso(due?: string) {
  const parsed = parseTaskDueDate(due);
  if (!parsed) return formatLocalDateIso(new Date());
  return formatLocalDateIso(parsed);
}

function applyTimesheetSyncForTask(tasks: DbProjectTask[], task: DbProjectTask) {
  const taskId = task.id || "";
  if (!taskId) return tasks;

  const withoutLinked = tasks.filter(
    t => !(isTimesheetEntry(t) && t.linkedTaskId === taskId)
  );

  if (!taskHasLoggedTime(task)) {
    return withoutLinked;
  }

  const hours = parseEstHoursFromTask(task.est);
  if (hours <= 0) return withoutLinked;

  const entry: DbProjectTask = {
    id: `ts-task-${taskId}`,
    entryType: "timesheet",
    linkedTaskId: taskId,
    employee: task.assignee || "—",
    date: taskDueToIso(task.due),
    hours,
    description: taskWorkDescription(task),
    title: task.title || "",
    status: "submitted",
  };

  return [...withoutLinked, entry];
}

export function mapLeadToClient(row: DbLead): ClientProfile {
  const temp = row.temp.charAt(0).toUpperCase() + row.temp.slice(1).toLowerCase();
  return {
    id: String(row.id),
    company: row.name,
    contact: row.contact,
    title: row.title || "Contact",
    email: row.email || "—",
    phone: row.phone || "—",
    location: row.location || "—",
    value: row.value,
    stage: row.stage,
    temperature: temp,
    since: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "—",
    industry: row.industry || "—",
    employees: "—",
    notes: row.notes || "No notes yet.",
    meetings: [],
    proposals: [],
    payments: [],
    tags: row.industry ? [row.industry] : [],
  };
}

export function mapProject(
  row: DbProject,
  memberMeta?: { teamIds: string[]; leadId?: string; teamMembers?: ProjectTeamMember[] },
  profiles?: EmployeeProfile[]
): Project {
  const parsed = parseTeamFromDb(row.team, profiles);
  const teamMembers =
    memberMeta?.teamMembers?.length ? memberMeta.teamMembers : parsed.members;
  const teamIds =
    memberMeta?.teamIds?.length ? memberMeta.teamIds : teamMembers.map(m => m.id).filter(Boolean);
  const teamNames = teamMembers.length
    ? teamMembers.map(m => m.name)
    : parsed.names;

  return {
    id: row.id,
    name: row.name,
    client: row.client,
    lead: row.lead,
    leadId: memberMeta?.leadId || row.lead_id || undefined,
    dept: row.dept,
    status: row.status,
    priority: row.priority,
    progress: row.progress,
    start: row.start_date,
    end: row.deadline,
    budget: row.budget,
    spent: row.spent,
    desc: row.description,
    team: teamNames,
    teamMembers,
    teamIds,
    tasks: (row.tasks || []).filter(isWorkTask).map(t => ({
      title: t.title!,
      status: t.status || "To Do",
      assignee: t.assignee || "—",
      due: t.due || "—",
    })),
    timeline: row.timeline || [],
  };
}

export function mapEmployeeProfile(row: DbEmployeeProfile): EmployeeProfile {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    dept: row.dept,
    email: row.email,
    phone: row.phone,
    location: row.location,
    joined: row.joined,
    score: row.score,
    status: row.status,
    salary: row.salary,
    manager: row.manager,
    skills: row.skills || [],
    bio: row.bio,
    weeklyHours: row.weekly_hours || [],
    last_active_at: row.last_active_at || null,
    recentTasks: [],
    attendance: row.attendance,
    leaves: row.leaves,
    projects: row.projects,
    revenue: row.revenue,
    // Empty when column missing — auth.ts falls back to dept/role mapping.
    appRole: row.app_role ?? "",
    profileImageUrl: row.profile_image_url || "",
    avatar: row.avatar || initialsFromName(row.name),
    shiftStart: row.shift_start?.trim() || "10:00",
  };
}

function parseDueDay(due?: string) {
  if (!due || due === "—") return 0;
  const d = new Date(`${due} ${new Date().getFullYear()}`);
  if (!Number.isNaN(d.getTime())) return d.getDate();
  const parsed = new Date(due);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getDate();
}

export function flattenDbProjectTasks(projects: DbProject[]): AppTask[] {
  let legacy = 0;
  return projects.flatMap(project =>
    (project.tasks || [])
      .filter(isWorkTask)
      .map(t => {
        const taskId = t.id || `legacy-${project.id}-${++legacy}-${t.title}`;
        return {
          id: taskId,
          taskId,
          projectId: project.id,
          title: t.title!,
          assignee: t.assignee || "—",
          assigneeId: t.employeeId || "",
          priority: mapPriority(t.priority),
          status: mapTaskStatus(t.status || "todo"),
          due: formatTaskDueDisplay(t.due),
          dueIso: t.due || "",
          dueDay: parseDueDay(t.due),
          startDay: 0,
          project: project.name,
          est: t.est || "—",
          workNotes: t.workNotes || "",
          createdAt: taskCreatedAtFromId(taskId) || "",
          statusEnteredAt: taskCreatedAtFromId(taskId) || "",
          stageHistory: [],
        };
      })
  );
}

export function flattenProjectTasks(projects: Project[]): AppTask[] {
  return flattenDbProjectTasks(
    projects.map(p => ({
      id: p.id,
      name: p.name,
      client: p.client,
      lead: p.lead,
      dept: p.dept,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      start_date: p.start,
      deadline: p.end,
      budget: p.budget,
      spent: p.spent,
      description: p.desc,
      team: p.team,
      tasks: p.tasks as DbProjectTask[],
      timeline: p.timeline,
    }))
  );
}

export function isTaskDueToday(due?: string) {
  const dueDate = parseTaskDueDate(due);
  if (!dueDate) return false;
  const todayIso = formatLocalDateIso(new Date());
  const dueIso = formatLocalDateIso(dueDate);
  if (dueIso === todayIso) return true;
  // Fallback: same month/day even if year in DB differs from display year
  const today = new Date();
  return dueDate.getMonth() === today.getMonth() && dueDate.getDate() === today.getDate();
}

/** Open tasks past due date (shown on employee dashboard with today's work). */
export function isTaskOverdue(due?: string) {
  const dueDate = parseTaskDueDate(due);
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  dueDate.setHours(12, 0, 0, 0);
  return dueDate < today;
}

export function isTaskCreatedToday(createdAt?: string) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return formatLocalDateIso(created) === formatLocalDateIso(new Date());
}

/** Employee dashboard: tasks assigned to this employee that were created today. */
export function isEmployeeDashboardTask(task: AppTask) {
  return isTaskCreatedToday(resolveTaskCreatedAt(task));
}

export function sortTodayTasks(tasks: AppTask[]) {
  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    const aCreated = new Date(resolveTaskCreatedAt(a) || 0).getTime();
    const bCreated = new Date(resolveTaskCreatedAt(b) || 0).getTime();
    if (aCreated !== bCreated) return bCreated - aCreated;
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });
}

/** Employee dashboard: tasks assigned to this employee created today. */
export async function fetchTodayTasksForEmployee(input: {
  employeeId: string;
  employeeName?: string;
}): Promise<AppTask[]> {
  const { employeeId, employeeName = "" } = input;
  if (!employeeId && !employeeName) return [];

  const all = await fetchProjectTasks();
  const mine = filterTasksForUser(all, employeeName, employeeId || undefined);

  return sortTodayTasks(mine.filter(isEmployeeDashboardTask));
}

export async function fetchProjectTasks(): Promise<AppTask[]> {
  if (await probeProjectRelations()) {
    const [{ data: taskRows, error: taskError }, { data: projects, error: projectError }] =
      await Promise.all([
        supabase.from("project_tasks").select("*"),
        supabase.from("projects").select("id, name"),
      ]);
    if (taskError) throw taskError;
    if (projectError) throw projectError;

    const profiles = await fetchEmployeeProfiles();
    const projectNames = new Map(
      ((projects || []) as { id: string; name: string }[]).map(p => [p.id, p.name])
    );

    return enrichTasksWithStageHistory(
      ((taskRows || []) as DbProjectTaskRow[]).map(row =>
        mapProjectTaskRowToAppTask(row, projectNames.get(row.project_id) || "—", profiles)
      )
    );
  }

  const { data, error } = await supabase.from("projects").select("*");
  if (error) throw error;
  return flattenDbProjectTasks(data as DbProject[]);
}

export function extractTimesheetEntries(projects: DbProject[]): TimesheetEntry[] {
  const entries: TimesheetEntry[] = [];
  for (const project of projects) {
    const linkedTaskIds = new Set(
      (project.tasks || [])
        .filter(isTimesheetEntry)
        .map(t => t.linkedTaskId)
        .filter(Boolean) as string[]
    );

    for (const item of project.tasks || []) {
      if (!isTimesheetEntry(item)) continue;
      if (isClockAttendanceTimesheetEntry(item)) continue;
      const display = resolveTimesheetFromTask(project, item);
      const entryId = item.id || `ts-${project.id}-${entries.length}`;
      entries.push({
        id: entryId,
        projectId: project.id,
        projectName: project.name,
        employee: item.employee || item.assignee || "—",
        employeeId: item.employeeId,
        date: item.date || "—",
        hours: Number(item.hours) || 0,
        description: display.description,
        taskTitle: display.taskTitle,
        workNotes: display.workNotes,
        status: item.status || "submitted",
        kind: timesheetEntryKind(item, entryId),
        taskId: taskIdFromTimesheetEntryId(entryId, item.linkedTaskId),
      });
    }

    for (const item of project.tasks || []) {
      if (!isWorkTask(item)) continue;
      if (!taskHasLoggedTime(item)) continue;
      if (item.id && linkedTaskIds.has(item.id)) continue;
      const hours = parseEstHoursFromTask(item.est);
      if (hours <= 0) continue;
      const workNotes = item.workNotes?.trim() || "";
      entries.push({
        id: `virtual-ts-${item.id}`,
        projectId: project.id,
        projectName: project.name,
        employee: item.assignee || "—",
        date: taskDueToIso(item.due),
        hours,
        description: taskWorkDescription(item),
        taskTitle: item.title || "",
        taskStatus: item.status,
        workNotes,
        status: "submitted",
        kind: "task",
        taskId: item.id,
      });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function formatCurrency(value: string | number) {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.]/g, ""));
  if (!num || Number.isNaN(num)) return "₹0";
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num}`;
}

function formatJoinDate(dateStr: string) {
  if (!dateStr) return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateProjectId() {
  return `P${Math.floor(100 + Math.random() * 900)}`;
}

function defaultWeeklyHours() {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => ({ day, h: 8 }));
}

function isMissingAppRoleColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204" && String(error?.message ?? "").includes("app_role");
}

function isMissingProfileImageColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204" && String(error?.message ?? "").includes("profile_image_url");
}

function isMissingShiftStartColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST204" && String(error?.message ?? "").includes("shift_start");
}

function stripProfileImageUrl(payload: Record<string, unknown>) {
  const { profile_image_url: _removed, ...rest } = payload;
  return rest;
}

function stripAppRole(payload: Record<string, unknown>) {
  const { app_role: _removed, ...rest } = payload;
  return rest;
}

function stripShiftStart(payload: Record<string, unknown>) {
  const { shift_start: _removed, ...rest } = payload;
  return rest;
}

async function insertEmployeeProfileRow(row: Record<string, unknown>) {
  let payload = { ...row };
  const optionalStrips: Array<(p: Record<string, unknown>) => Record<string, unknown>> = [
    stripAppRole,
    stripProfileImageUrl,
    stripShiftStart,
  ];

  for (let attempt = 0; attempt <= optionalStrips.length; attempt++) {
    const { error } = await supabase.from("employee_profiles").insert(payload);
    if (!error) return;

    if (isMissingAppRoleColumn(error)) {
      payload = stripAppRole(payload);
      continue;
    }
    if (isMissingProfileImageColumn(error)) {
      payload = stripProfileImageUrl(payload);
      if (row.profile_image_url) {
        throw new Error(
          "Profile photo column missing in database. Run supabase/profile_image.sql in Supabase SQL Editor, then try again."
        );
      }
      continue;
    }
    if (isMissingShiftStartColumn(error)) {
      payload = stripShiftStart(payload);
      continue;
    }
    throw error;
  }
}

async function updateEmployeeProfileRow(id: string, payload: Record<string, unknown>) {
  const { error } = await supabase.from("employee_profiles").update(payload).eq("id", id);
  if (isMissingAppRoleColumn(error)) {
    const retry = await supabase
      .from("employee_profiles")
      .update(stripAppRole(payload))
      .eq("id", id);
    if (retry.error) throw retry.error;
    return;
  }
  if (isMissingProfileImageColumn(error)) {
    throw new Error(
      "Profile photo column missing in database. Run supabase/profile_image.sql in Supabase SQL Editor, then try again."
    );
  }
  if (error) throw error;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .order("score", { ascending: false });
  if (error) throw error;
  return (data as DbEmployeeProfile[]).map(profileToEmployee);
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbLead[]).map(mapLead);
}

export async function fetchLeadsAsClients(): Promise<ClientProfile[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbLead[]).map(mapLeadToClient);
}

async function fetchProjectsRelational(rows: DbProject[], profiles: EmployeeProfile[]): Promise<Project[]> {
  const projectIds = rows.map(r => r.id);
  if (projectIds.length === 0) return [];

  const [{ data: members }, { data: taskRows }] = await Promise.all([
    supabase.from("project_members").select("project_id, employee_id, role").in("project_id", projectIds),
    supabase.from("project_tasks").select("project_id, title, status, assignee_id, due").in("project_id", projectIds),
  ]);

  const membersByProject = new Map<string, DbProjectMemberRow[]>();
  for (const m of (members || []) as DbProjectMemberRow[]) {
    if (!membersByProject.has(m.project_id)) membersByProject.set(m.project_id, []);
    membersByProject.get(m.project_id)!.push(m);
  }

  const tasksByProject = new Map<string, DbProjectTaskRow[]>();
  for (const t of (taskRows || []) as DbProjectTaskRow[]) {
    if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, []);
    tasksByProject.get(t.project_id)!.push(t);
  }

  return rows.map(row => {
    const parsedTeam = parseTeamFromDb(row.team, profiles);
    const projMembers = membersByProject.get(row.id) || [];
    const teamIdsFromRow = Array.isArray(row.team_ids) ? row.team_ids.filter(Boolean) : [];
    const teamIds = parsedTeam.ids.length
      ? parsedTeam.ids
      : teamIdsFromRow.length
        ? teamIdsFromRow
        : projMembers.map(m => m.employee_id);
    const teamMembers = parsedTeam.members.length
      ? parsedTeam.members
      : teamIds.map(id => ({ id, name: profileNameById(profiles, id) })).filter(m => m.name);
    const leadMember = projMembers.find(m => m.role === "lead");
    const leadId = row.lead_id || leadMember?.employee_id;
    const leadName = profileNameById(profiles, leadId) || row.lead;

    const projTasks = (tasksByProject.get(row.id) || []).map(t => ({
      title: t.title,
      status: t.status || "To Do",
      assignee: profileNameById(profiles, t.assignee_id) || "—",
      due: t.due || "—",
    }));

    return mapProject(
      {
        ...row,
        lead: leadName,
        tasks: projTasks as DbProjectTask[],
      },
      { teamIds, leadId, teamMembers },
      profiles
    );
  });
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as DbProject[];

  const profiles = await fetchEmployeeProfiles();

  if (!(await probeProjectRelations())) {
    return rows.map(row => mapProject(row, undefined, profiles));
  }

  return fetchProjectsRelational(rows, profiles);
}

export async function fetchEmployeeProfiles(): Promise<EmployeeProfile[]> {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbEmployeeProfile[]).map(mapEmployeeProfile);
}

export async function fetchEmployeeProfileByEmail(email: string): Promise<EmployeeProfile | null> {
  const normalized = email.trim();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEmployeeProfile(data as DbEmployeeProfile) : null;
}

async function syncRelationalTimesheetForTask(
  task: DbProjectTaskRow,
  _profiles: EmployeeProfile[]
) {
  if (!taskHasLoggedTime(task)) {
    await supabase.from("timesheet_entries").delete().eq("linked_task_id", task.id);
    return;
  }

  const hours = parseEstHoursFromTask(task.est || undefined);
  if (hours <= 0) return;

  const entryId = `ts-task-${task.id}`;
  await supabase.from("timesheet_entries").upsert({
    id: entryId,
    project_id: task.project_id,
    employee_id: task.assignee_id,
    linked_task_id: task.id,
    date: taskDueToIso(task.due || undefined),
    hours,
    description: task.work_notes?.trim() || task.title,
  });
}

async function fetchTimesheetEntriesRelational(): Promise<TimesheetEntry[]> {
  const [{ data: projects }, { data: sheetRows }, { data: taskRows }] = await Promise.all([
    supabase.from("projects").select("id, name"),
    supabase.from("timesheet_entries").select("*"),
    supabase.from("project_tasks").select("*"),
  ]);

  const profiles = await fetchEmployeeProfiles();
  const projectMap = new Map(
    ((projects || []) as { id: string; name: string }[]).map(p => [p.id, p.name])
  );
  const taskMap = new Map(((taskRows || []) as DbProjectTaskRow[]).map(t => [t.id, t]));
  const entries: TimesheetEntry[] = [];

  for (const row of (sheetRows || []) as DbTimesheetEntryRow[]) {
    const linkedTask = row.linked_task_id ? taskMap.get(row.linked_task_id) : undefined;
    const employeeName = profileNameById(profiles, row.employee_id) || "—";
    const entryId = row.id;
    entries.push({
      id: entryId,
      projectId: row.project_id,
      projectName: projectMap.get(row.project_id) || "—",
      employee: employeeName,
      employeeId: row.employee_id || undefined,
      date: row.date,
      hours: Number(row.hours) || 0,
      description: row.description,
      taskTitle: linkedTask?.title,
      taskStatus: linkedTask?.status,
      workNotes: linkedTask?.work_notes || row.description,
      status: "submitted",
      kind: row.linked_task_id ? "task" : "manual",
      taskId: row.linked_task_id || undefined,
    });
  }

  for (const task of (taskRows || []) as DbProjectTaskRow[]) {
    if (!taskHasLoggedTime(task)) continue;
    const syncedId = `ts-task-${task.id}`;
    if (entries.some(e => e.id === syncedId || e.taskId === task.id)) continue;

    const hours = parseEstHoursFromTask(task.est || undefined);
    entries.push({
      id: `virtual-ts-${task.id}`,
      projectId: task.project_id,
      projectName: projectMap.get(task.project_id) || "—",
      employee: profileNameById(profiles, task.assignee_id) || "—",
      employeeId: task.assignee_id || undefined,
      date: taskDueToIso(task.due || undefined),
      hours,
      description: task.work_notes?.trim() || task.title,
      taskTitle: task.title,
      taskStatus: task.status,
      workNotes: task.work_notes || "",
      status: "submitted",
      kind: "task",
      taskId: task.id,
    });

    await syncRelationalTimesheetForTask(task, profiles);
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchTimesheetEntries(): Promise<TimesheetEntry[]> {
  if (await probeProjectRelations()) {
    return fetchTimesheetEntriesRelational();
  }

  const { data, error } = await supabase.from("projects").select("*");
  if (error) throw error;

  const projects = [...(data as DbProject[])];
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    let tasks = (project.tasks || []).filter(t => !isClockAttendanceTimesheetEntry(t));
    let changed = tasks.length !== (project.tasks || []).length;

    for (const item of project.tasks || []) {
      if (!isWorkTask(item)) continue;
      if (!taskHasLoggedTime(item)) continue;
      if (!item.id) continue;
      if (parseEstHoursFromTask(item.est) <= 0) continue;
      const synced = applyTimesheetSyncForTask(tasks, item);
      if (JSON.stringify(synced) !== JSON.stringify(tasks)) {
        tasks = synced;
        changed = true;
      }
    }

    if (changed) {
      const { error: updateError } = await supabase
        .from("projects")
        .update({ tasks })
        .eq("id", project.id);
      if (!updateError) projects[i] = { ...project, tasks };
    }
  }

  return extractTimesheetEntries(projects);
}

/** Signup / login — create or update employee_profiles row by email. */
export async function upsertEmployeeProfileFromSignup(input: {
  name: string;
  email: string;
  phone?: string;
  dept?: string;
  role?: string;
  appRole?: string;
}) {
  const normalizedEmail = input.email.trim();
  if (!normalizedEmail) throw new Error("Email is required for employee profile.");

  const appRole = input.appRole || "employee";
  const dept = input.dept?.trim() || "Development";
  const role =
    appRole === "teamlead"
      ? "Team Leader"
      : input.role?.trim() || (appRole === "ceo" ? "Administrator" : "Employee");

  const existing = await fetchEmployeeProfileByEmail(normalizedEmail);
  if (existing) {
    await updateEmployeeProfile(existing.id, {
      name: input.name.trim(),
      phone: input.phone || undefined,
      dept,
      role,
      appRole,
    });
    return existing.id;
  }

  return createEmployee({
    name: input.name.trim(),
    email: normalizedEmail,
    phone: input.phone,
    dept,
    role,
    appRole,
    joining: new Date().toISOString().slice(0, 10),
  });
}

export async function createEmployee(input: {
  name: string;
  email: string;
  phone?: string;
  dept: string;
  role: string;
  appRole?: string;
  manager?: string;
  salary?: string;
  joining?: string;
  location?: string;
  skills?: string[];
  profileImageUrl?: string;
  shiftStart?: string;
}) {
  const avatar = initialsFromName(input.name);
  const profileId = crypto.randomUUID();

  await insertEmployeeProfileRow({
    id: profileId,
    name: input.name,
    role: input.role,
    dept: input.dept,
    email: input.email,
    phone: input.phone || "—",
    location: input.location || "Remote",
    joined: formatJoinDate(input.joining || ""),
    score: 85,
    status: "Active",
    salary: input.salary ? formatCurrency(input.salary) : "₹0",
    manager: input.manager || "CEO Admin",
    skills: input.skills?.length ? input.skills : [input.role],
    bio: `${input.role} at Base2Brand. Dedicated to project success and team collaboration.`,
    weekly_hours: defaultWeeklyHours(),
    attendance: 100,
    leaves: 0,
    projects: 0,
    revenue: "₹0",
    avatar,
    profile_image_url: input.profileImageUrl || null,
    trend: "up",
    app_role: input.appRole || "employee",
    shift_start: input.shiftStart || "10:00",
  });

  return profileId;
}

export async function updateEmployeeProfile(id: string, input: Partial<{
  name: string;
  role: string;
  dept: string;
  appRole: string;
  email: string;
  phone: string;
  location: string;
  joined: string;
  salary: string;
  manager: string;
  skills: string[];
  bio: string;
  score: number;
  status: string;
  profileImageUrl: string;
  shiftStart: string;
}>) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role = input.role;
  if (input.dept !== undefined) payload.dept = input.dept;
  if (input.appRole !== undefined) payload.app_role = input.appRole;
  if (input.email !== undefined) payload.email = input.email;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.location !== undefined) payload.location = input.location;
  if (input.joined !== undefined) payload.joined = input.joined;
  if (input.salary !== undefined) payload.salary = input.salary;
  if (input.manager !== undefined) payload.manager = input.manager;
  if (input.skills !== undefined) payload.skills = input.skills;
  if (input.bio !== undefined) payload.bio = input.bio;
  if (input.score !== undefined) payload.score = input.score;
  if (input.status !== undefined) payload.status = input.status;
  if (input.profileImageUrl !== undefined) {
    payload.profile_image_url = input.profileImageUrl || null;
  }
  if (input.shiftStart !== undefined) payload.shift_start = input.shiftStart;

  if (input.name) {
    payload.avatar = initialsFromName(input.name);
  }

  await updateEmployeeProfileRow(id, payload);
}

export async function createLead(input: {
  company: string;
  contact: string;
  title?: string;
  email?: string;
  phone?: string;
  industry?: string;
  location?: string;
  value?: string;
  temp?: string;
  notes?: string;
  stage?: string;
}) {
  const { error } = await supabase.from("leads").insert({
    name: input.company,
    contact: input.contact,
    title: input.title || null,
    email: input.email || null,
    phone: input.phone || null,
    industry: input.industry || null,
    location: input.location || null,
    value: input.value ? formatCurrency(input.value) : "₹0",
    temp: (input.temp || "warm").toLowerCase(),
    stage: input.stage || "Discovery",
    days: 0,
    notes: input.notes || null,
  });
  if (error) throw error;
}

export async function createProject(input: {
  name: string;
  client: string;
  lead?: string;
  dept: string;
  start: string;
  end: string;
  budget?: string;
  priority?: string;
  desc?: string;
  team?: string[];
}) {
  const id = generateProjectId();
  const { error } = await supabase.from("projects").insert({
    id,
    name: input.name,
    client: input.client || "Internal",
    lead: input.lead || "Unassigned",
    dept: input.dept || "Cross-functional",
    status: "In Progress",
    priority: input.priority || "Medium",
    progress: 0,
    start_date: formatShortDate(input.start),
    deadline: formatShortDate(input.end),
    budget: input.budget ? formatCurrency(input.budget) : "₹0",
    spent: "₹0",
    description: input.desc || "",
    team: [],
    team_ids: [],
    lead_id: null,
    tasks: [],
    timeline: [
      { phase: "Discovery & Planning", start: 0, width: 25, color: "bg-emerald-500" },
      { phase: "Execution", start: 25, width: 50, color: "bg-indigo-500" },
      { phase: "Delivery", start: 75, width: 25, color: "bg-violet-500" },
    ],
  });
  if (error) throw error;
  return id;
}

export async function assignProjectTeam(
  projectId: string,
  team: string[],
  lead?: string,
  options?: { memberIds?: string[]; leadId?: string }
) {
  const profiles = await fetchEmployeeProfiles();
  const leadId = options?.leadId || profileIdByName(profiles, lead);
  const memberIds = options?.memberIds?.length
    ? [...new Set(options.memberIds)]
    : [...new Set(team.map(name => profileIdByName(profiles, name)).filter(Boolean))];

  const allMemberIds = [...new Set([leadId, ...memberIds].filter(Boolean))];
  const teamForDb = buildTeamForDb(allMemberIds, profiles);
  const leadName = profileNameById(profiles, leadId) || lead || "Unassigned";

  // Fetch old state to diff and notify
  const { data: oldProj } = await supabase.from("projects").select("name, team_ids").eq("id", projectId).single();
  const oldTeamIds = new Set<string>(oldProj?.team_ids || []);
  const newAssignments = allMemberIds.filter(id => id && !oldTeamIds.has(id));

  const payload: {
    team: ProjectTeamMember[];
    lead: string;
    lead_id: string | null;
    team_ids: string[];
  } = {
    team: teamForDb,
    lead: leadName,
    lead_id: leadId || null,
    team_ids: allMemberIds,
  };

  let { error } = await supabase.from("projects").update(payload).eq("id", projectId);
  if (error && /lead_id|team_ids/i.test(error.message || "")) {
    ({ error } = await supabase
      .from("projects")
      .update({ team: payload.team, lead: payload.lead })
      .eq("id", projectId));
  }
  if (error) throw error;

  if (await probeProjectRelations()) {
    await supabase.from("project_members").delete().eq("project_id", projectId);
    if (allMemberIds.length) {
      const rows = allMemberIds.map(employeeId => ({
        project_id: projectId,
        employee_id: employeeId,
        role: employeeId === leadId ? "lead" : "member",
      }));
      const { error: memberError } = await supabase.from("project_members").insert(rows);
      if (memberError) throw memberError;
    }
  }

  // Send Notifications
  if (newAssignments.length > 0) {
    const projName = oldProj?.name || "a project";
    for (const newId of newAssignments) {
      await insertNotification({
        recipientId: newId as string,
        title: "Project Assigned",
        message: `You have been assigned to project: ${projName}`,
        type: "project_assigned",
        referenceId: projectId
      });
    }
  }

  const { data: allProjects } = await supabase.from("projects").select("id,name,team,lead,team_ids,lead_id");
  if (!allProjects) return;

  if (await probeProjectRelations()) {
    const { data: allMembers } = await supabase.from("project_members").select("project_id, employee_id");
    for (const profile of profiles) {
      const count = ((allMembers || []) as DbProjectMemberRow[]).filter(
        m => m.employee_id === profile.id
      ).length;
      await supabase.from("employee_profiles").update({ projects: count }).eq("id", profile.id);
    }
    return;
  }

  for (const profile of profiles) {
    const count = (allProjects as DbProject[]).filter(p => {
      const parsed = parseTeamFromDb(p.team, profiles);
      return (
        parsed.names.some(m => namesMatch(m, profile.name)) ||
        parsed.ids.includes(profile.id) ||
        namesMatch(p.lead, profile.name) ||
        p.lead_id === profile.id
      );
    }).length;
    await supabase.from("employee_profiles").update({ projects: count }).eq("id", profile.id);
  }
}

export async function addProjectTask(input: {
  projectId: string;
  title: string;
  assignee: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  due?: string;
  est?: string;
  workNotes?: string;
}) {
  const dueIso = dueInputToStorageIso(input.due) || "—";
  const dueFormatted = dueIso !== "—"
    ? formatTaskDueDisplay(dueIso)
    : "—";
  const taskId = `task-${Date.now()}`;
  const profiles = await fetchEmployeeProfiles();
  const assigneeId = input.assigneeId || profileIdByName(profiles, input.assignee);
  const taskStatus = normalizeTaskStatusForStorage(input.status);

  if (await probeProjectRelations()) {
    const now = new Date().toISOString();
    const row: DbProjectTaskRow = {
      id: taskId,
      project_id: input.projectId,
      assignee_id: assigneeId || null,
      title: input.title.trim(),
      status: taskStatus,
      priority: input.priority || "medium",
      due: dueIso !== "—" ? dueIso : null,
      est: input.est ? `${input.est.replace(/h$/i, "")}h` : "4h",
      work_notes: input.workNotes?.trim() || "",
      status_entered_at: now,
    };
    const { error } = await supabase.from("project_tasks").insert(row);
    if (error) throw error;
    if (await probeTaskStageTracking()) {
      await openInitialTaskStatusSegment({
        taskId,
        projectId: input.projectId,
        status: taskStatus,
        enteredAt: now,
      });
    }
    await syncRelationalTimesheetForTask(row, profiles);
    return;
  }

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (fetchError) throw fetchError;

  const row = project as DbProject;
  const task: DbProjectTask = {
    id: taskId,
    entryType: "task",
    title: input.title.trim(),
    assignee: input.assignee,
    employeeId: assigneeId || undefined,
    status: taskStatus,
    priority: input.priority || "medium",
    due: dueFormatted,
    est: input.est ? `${input.est}h` : "4h",
    workNotes: input.workNotes?.trim() || "",
  };

  let tasks = [...(row.tasks || []), task];
  tasks = applyTimesheetSyncForTask(tasks, task);
  const { error } = await supabase.from("projects").update({ tasks }).eq("id", input.projectId);
  if (error) throw error;
}

function dbTaskMatches(task: DbProjectTask, taskId: string, title: string) {
  if (task.id && task.id === taskId) return true;
  return !task.id && title === task.title;
}

export async function updateProjectTaskStatus(input: {
  projectId: string;
  taskId: string;
  title: string;
  status: string;
  movedById?: string | null;
}) {
  await updateProjectTask({
    projectId: input.projectId,
    taskId: input.taskId,
    originalTitle: input.title,
    title: input.title,
    assignee: "",
    status: input.status,
    priority: "",
    statusOnly: true,
    movedById: input.movedById,
  });
}

export async function updateProjectTask(input: {
  projectId: string;
  taskId: string;
  originalTitle: string;
  title: string;
  assignee: string;
  assigneeId?: string;
  status: string;
  priority: string;
  due?: string;
  est?: string;
  workNotes?: string;
  statusOnly?: boolean;
  movedById?: string | null;
}) {
  const profiles = await fetchEmployeeProfiles();
  const assigneeId = input.assigneeId || profileIdByName(profiles, input.assignee);
  const dueIso = input.due ? dueInputToStorageIso(input.due) : undefined;
  const dueFormatted = dueIso ? formatTaskDueDisplay(dueIso) : undefined;
  const taskStatus = normalizeTaskStatusForStorage(input.status);

  if (await probeProjectRelations()) {
    const { data: existing, error: fetchError } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("id", input.taskId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) throw new Error("Task not found");

    const current = existing as DbProjectTaskRow;
    const previousStatus = normalizeTaskStatusForStorage(current.status);
    let statusEnteredAt = current.status_entered_at || current.created_at || new Date().toISOString();

    if (previousStatus !== taskStatus && (await probeTaskStageTracking())) {
      statusEnteredAt = await recordTaskStatusChange({
        taskId: input.taskId,
        projectId: input.projectId,
        fromStatus: previousStatus,
        toStatus: taskStatus,
        movedById: input.movedById || assigneeId || current.assignee_id,
      });
    }

    const updated: DbProjectTaskRow = input.statusOnly
      ? {
          ...current,
          status: taskStatus,
          status_entered_at: statusEnteredAt,
          updated_at: new Date().toISOString(),
        }
      : {
          ...current,
          title: input.title.trim(),
          assignee_id: assigneeId || null,
          status: taskStatus,
          priority: input.priority,
          due: dueIso ?? current.due,
          est: input.est ? `${input.est.replace(/h$/i, "")}h` : current.est,
          work_notes: input.workNotes !== undefined ? input.workNotes.trim() : current.work_notes,
          status_entered_at: statusEnteredAt,
          updated_at: new Date().toISOString(),
        };

    const { error } = await supabase
      .from("project_tasks")
      .update(updated)
      .eq("id", input.taskId)
      .eq("project_id", input.projectId);
    if (error) throw error;
    await syncRelationalTimesheetForTask(updated, profiles);
    return;
  }

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (fetchError) throw fetchError;

  const row = project as DbProject;
  let found = false;
  let updatedTask: DbProjectTask | null = null;

  let tasks = (row.tasks || []).map(t => {
    if (!isWorkTask(t)) return t;
    if (!dbTaskMatches(t, input.taskId, input.originalTitle)) return t;
    found = true;
    if (input.statusOnly) {
      updatedTask = { ...t, status: taskStatus };
      return updatedTask;
    }
    updatedTask = {
      ...t,
      id: t.id || input.taskId,
      title: input.title.trim(),
      assignee: input.assignee,
      employeeId: assigneeId || t.employeeId,
      status: taskStatus,
      priority: input.priority,
      due: dueFormatted ?? t.due,
      est: input.est ? `${input.est.replace(/h$/i, "")}h` : t.est,
      workNotes: input.workNotes !== undefined ? input.workNotes.trim() : t.workNotes,
    };
    return updatedTask;
  });
  if (!found || !updatedTask) throw new Error("Task not found");

  tasks = applyTimesheetSyncForTask(tasks, updatedTask);

  const { error } = await supabase.from("projects").update({ tasks }).eq("id", input.projectId);
  if (error) throw error;
}

export type ClockSessionStatus = "active" | "paused" | "completed";

export type ClockSessionSegmentKind = "working" | "break" | "meeting" | "idle";

export type ClockSessionSegment = {
  id: string;
  sessionId: string;
  kind: ClockSessionSegmentKind;
  label: string;
  startedAt: string;
  endedAt: string | null;
};

export type ClockSessionRecord = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  clockIn: string;
  clockOut: string | null;
  sessionStart: string | null;
  status: ClockSessionStatus;
  hours: number | null;
  projectId: string | null;
  notes: string | null;
  segments?: ClockSessionSegment[];
};

export const CLOCK_OUT_OPTIONS = [
  { id: "lunch", label: "Lunch Break", desc: "Going for lunch" },
  { id: "tea", label: "Tea / Short Break", desc: "Quick break" },
  { id: "personal", label: "Personal / Urgent work", desc: "Stepped out for something" },
  { id: "meeting", label: "Meeting / Outside", desc: "Client or outside meeting" },
  { id: "end_day", label: "End Day", desc: "Leaving office for today" },
] as const;

export type ClockOutReason = (typeof CLOCK_OUT_OPTIONS)[number]["id"];

export const CLOCK_SESSIONS_SETUP_MSG =
  "Run supabase/clock_sessions.sql in Supabase SQL Editor to enable Clock In/Out.";

let clockSessionsTableReady: boolean | null = null;
let clockSegmentsTableReady: boolean | null = null;

export function isClockSessionsTableReady() {
  return clockSessionsTableReady === true;
}

function isMissingClockSegmentsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number; statusCode?: number };
  const status = e.status ?? e.statusCode;
  return (
    status === 404 ||
    e.code === "PGRST205" ||
    /could not find the table.*clock_session_segments/i.test(e.message || "") ||
    /relation.*clock_session_segments.*does not exist/i.test(e.message || "")
  );
}

async function probeClockSegments(): Promise<boolean> {
  if (clockSegmentsTableReady !== null) return clockSegmentsTableReady;
  const { error } = await supabase.from("clock_session_segments").select("id").limit(1);
  if (error) {
    clockSegmentsTableReady = !isMissingClockSegmentsTable(error);
    return clockSegmentsTableReady;
  }
  clockSegmentsTableReady = true;
  return true;
}

function mapClockSegment(row: {
  id: string;
  session_id: string;
  kind: string;
  label: string;
  started_at: string;
  ended_at: string | null;
}): ClockSessionSegment {
  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind as ClockSessionSegmentKind,
    label: row.label,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

async function closeOpenClockSegment(sessionId: string, endedAtMs: number) {
  if (!(await probeClockSegments())) return;
  
  // First get the open segment to ensure we don't set ended_at < started_at
  const { data: openSegment } = await supabase
    .from("clock_session_segments")
    .select("*")
    .eq("session_id", sessionId)
    .is("ended_at", null)
    .maybeSingle();
    
  if (!openSegment) return;
  
  const startMs = new Date(openSegment.started_at).getTime();
  const safeEndedAtMs = Math.max(startMs, endedAtMs);
  const endedAt = new Date(safeEndedAtMs).toISOString();

  await supabase
    .from("clock_session_segments")
    .update({ ended_at: endedAt })
    .eq("id", openSegment.id);
}

async function insertClockSegment(input: {
  sessionId: string;
  kind: ClockSessionSegmentKind;
  label: string;
  startedAtMs: number;
}) {
  if (!(await probeClockSegments())) return;
  const { error } = await supabase.from("clock_session_segments").insert({
    session_id: input.sessionId,
    kind: input.kind,
    label: input.label,
    started_at: new Date(input.startedAtMs).toISOString(),
    ended_at: null,
  });
  if (error && !isMissingClockSegmentsTable(error)) throw error;
}

async function fetchSegmentsForSessions(
  sessionIds: string[]
): Promise<Map<string, ClockSessionSegment[]>> {
  const map = new Map<string, ClockSessionSegment[]>();
  if (!sessionIds.length || !(await probeClockSegments())) return map;

  const { data, error } = await supabase
    .from("clock_session_segments")
    .select("*")
    .in("session_id", sessionIds)
    .order("started_at", { ascending: true });

  if (error) {
    if (isMissingClockSegmentsTable(error)) return map;
    throw error;
  }

  for (const row of data || []) {
    const seg = mapClockSegment(row);
    const list = map.get(seg.sessionId) || [];
    list.push(seg);
    map.set(seg.sessionId, list);
  }
  return map;
}

function breakKindFromReason(reason: ClockOutReason | string): ClockSessionSegmentKind {
  return reason === "meeting" ? "meeting" : "break";
}

function breakLabelFromReason(reason: ClockOutReason | string) {
  if (reason === "end_day") return "End of day";
  if (reason === "idle") return "System Idle";
  const opt = CLOCK_OUT_OPTIONS.find(o => o.id === reason);
  return opt ? opt.label : String(reason);
}

function isMissingClockSessionsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number; statusCode?: number };
  const status = e.status ?? e.statusCode;
  return (
    status === 404 ||
    e.code === "PGRST205" ||
    /could not find the table.*clock_sessions/i.test(e.message || "") ||
    /relation.*clock_sessions.*does not exist/i.test(e.message || "")
  );
}

function handleClockSessionsError(error: unknown): never {
  if (isMissingClockSessionsTable(error)) {
    clockSessionsTableReady = false;
    throw new Error(CLOCK_SESSIONS_SETUP_MSG);
  }
  throw error;
}

function formatClockDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Exact elapsed time in hours (no rounding up to minutes). */
function calculateSessionHours(clockInIso: string, clockOutMs: number) {
  const elapsedMs = clockOutMs - new Date(clockInIso).getTime();
  if (elapsedMs < 1000) return 0;
  return Math.round((elapsedMs / 3600000) * 10000) / 10000;
}

function mapClockSession(row: {
  id: string;
  employee_id: string | null;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  session_start?: string | null;
  status: string;
  hours: number | null;
  project_id?: string | null;
  notes?: string | null;
}): ClockSessionRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    sessionStart: row.session_start ?? null,
    status: row.status as ClockSessionStatus,
    hours: row.hours != null ? Number(row.hours) : null,
    projectId: row.project_id ?? null,
    notes: row.notes ?? null,
  };
}

function todayClockRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function applyEmployeeClockFilter<T extends { eq: (col: string, val: string) => T; ilike: (col: string, val: string) => T }>(
  query: T,
  employeeName: string,
  employeeId?: string
) {
  if (employeeId) return query.eq("employee_id", employeeId);
  if (employeeName.trim()) return query.ilike("employee_name", employeeName.trim());
  return query;
}

/** One row per employee per day — returns today's row if any. */
export async function fetchTodayOfficeSession(
  employeeName: string,
  employeeId?: string
): Promise<ClockSessionRecord | null> {
  const { start, end } = todayClockRange();
  let query = supabase
    .from("clock_sessions")
    .select("*")
    .gte("clock_in", start)
    .lte("clock_in", end)
    .order("clock_in", { ascending: false })
    .limit(1);

  query = applyEmployeeClockFilter(query, employeeName, employeeId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingClockSessionsTable(error)) return null;
    throw error;
  }
  if (data) {
    const clockInDate = new Date(data.clock_in);
    const now = new Date();
    // Check if the session is from a previous calendar day AND it's 1 AM or later
    if (
      (clockInDate.getFullYear() !== now.getFullYear() ||
      clockInDate.getMonth() !== now.getMonth() ||
      clockInDate.getDate() !== now.getDate()) &&
      now.getHours() >= 1
    ) {
      // It's from a previous day! Auto-close it at 23:59:59 of that day.
      const endOfDay = new Date(clockInDate);
      endOfDay.setHours(23, 59, 59, 999);
      await clockOutEmployee({
        sessionId: data.id,
        employeeName: data.employee_name,
        employeeId: data.employee_id,
        reason: "end_day",
        notes: "Auto-closed at midnight",
        forceTimeMs: endOfDay.getTime(),
      });
      return null;
    }
  }
  if (!data) return null;
  const session = mapClockSession(data);
  const segmentsMap = await fetchSegmentsForSessions([session.id]);
  session.segments = segmentsMap.get(session.id) || [];
  return session;
}

export async function fetchActiveClockSession(
  employeeName: string,
  employeeId?: string
): Promise<ClockSessionRecord | null> {
  let query = supabase
    .from("clock_sessions")
    .select("*")
    .eq("status", "active")
    .order("clock_in", { ascending: false })
    .limit(1);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  } else if (employeeName.trim()) {
    query = query.ilike("employee_name", employeeName.trim());
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingClockSessionsTable(error)) {
      clockSessionsTableReady = false;
      return null;
    }
    throw error;
  }
  clockSessionsTableReady = true;
  if (!data) return null;
  const session = mapClockSession(data);
  const segmentsMap = await fetchSegmentsForSessions([session.id]);
  session.segments = segmentsMap.get(session.id) || [];
  return session;
}

export async function pauseEmployeeTaskTimers(employeeName: string, employeeId?: string) {
  if (!(await probeProjectRelations()) || !(await probeTaskStageTracking())) return;
  const profiles = await fetchEmployeeProfiles();
  const assigneeId = employeeId || profileIdByName(profiles, employeeName);
  if (!assigneeId) return;

  const { data: tasks, error } = await supabase
    .from("project_tasks")
    .select("id, project_id, status")
    .eq("assignee_id", assigneeId)
    .neq("status", "done");
  
  if (error || !tasks || tasks.length === 0) return;
  const now = new Date().toISOString();

  for (const task of tasks) {
    const { data: openRows } = await supabase
      .from("task_status_history")
      .select("*")
      .eq("task_id", task.id)
      .is("exited_at", null)
      .order("entered_at", { ascending: false })
      .limit(1);
    
    const open = (openRows?.[0] || null) as TaskStageHistoryRow | null;
    if (open) {
      const duration = Math.max(0, Math.floor((Date.now() - new Date(open.entered_at).getTime()) / 1000));
      await supabase
        .from("task_status_history")
        .update({ exited_at: now, duration_seconds: duration })
        .eq("id", open.id);
    }
    await supabase.from("project_tasks").update({ status_entered_at: null }).eq("id", task.id);
  }
}

export async function resumeEmployeeTaskTimers(employeeName: string, employeeId?: string) {
  if (!(await probeProjectRelations()) || !(await probeTaskStageTracking())) return;
  const profiles = await fetchEmployeeProfiles();
  const assigneeId = employeeId || profileIdByName(profiles, employeeName);
  if (!assigneeId) return;

  const { data: tasks, error } = await supabase
    .from("project_tasks")
    .select("id, project_id, status")
    .eq("assignee_id", assigneeId)
    .neq("status", "done");
  
  if (error || !tasks || tasks.length === 0) return;

  for (const task of tasks) {
    const enteredAt = await openInitialTaskStatusSegment({
      taskId: task.id,
      projectId: task.project_id,
      status: task.status,
    });
    await supabase.from("project_tasks").update({ status_entered_at: enteredAt }).eq("id", task.id);
  }
}

export async function clockInEmployee(input: {
  employeeName: string;
  employeeId?: string;
}): Promise<ClockSessionRecord> {
  const active = await fetchActiveClockSession(input.employeeName, input.employeeId);
  if (active) return active;

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const todayRow = await fetchTodayOfficeSession(input.employeeName, input.employeeId);

  if (todayRow) {
    await closeOpenClockSegment(todayRow.id, nowMs);
    const { data, error } = await supabase
      .from("clock_sessions")
      .update({
        status: "active",
        session_start: now,
        clock_out: null,
        notes: "Office attendance",
      })
      .eq("id", todayRow.id)
      .select("*")
      .maybeSingle(); // Use maybeSingle to prevent PGRST116 if not found
    
    if (error) handleClockSessionsError(error);
    
    if (data) {
      await insertClockSegment({
        sessionId: todayRow.id,
        kind: "working",
        label: "Office attendance",
        startedAtMs: nowMs,
      });
      clockSessionsTableReady = true;
      await resumeEmployeeTaskTimers(input.employeeName, input.employeeId);
      return mapClockSession(data);
    }
    // If data is null, it means the row was deleted or RLS blocked it. Fall through to insert a new one.
  }

  const { data, error } = await supabase
    .from("clock_sessions")
    .insert({
      employee_id: input.employeeId || null,
      employee_name: input.employeeName.trim(),
      status: "active",
      clock_in: now,
      session_start: now,
      hours: 0,
      notes: "Office attendance",
    })
    .select("*")
    .single();
  if (error) handleClockSessionsError(error);
  if (!data) throw new Error("Failed to create clock session (no data returned).");
  
  clockSessionsTableReady = true;
  await insertClockSegment({
    sessionId: data.id,
    kind: "working",
    label: "Office attendance",
    startedAtMs: nowMs,
  });
  await resumeEmployeeTaskTimers(input.employeeName, input.employeeId);
  return mapClockSession(data);
}

function clockOutNote(reason: ClockOutReason | string) {
  if (reason === "end_day") return "End of day";
  const opt = CLOCK_OUT_OPTIONS.find(o => o.id === reason);
  return opt ? `Break: ${opt.label}` : `Break: ${reason}`;
}

export async function clockOutEmployee(input: {
  sessionId: string;
  employeeName: string;
  employeeId?: string;
  reason?: ClockOutReason | string;
  projectId?: string;
  notes?: string;
  forceTimeMs?: number;
}): Promise<{ session: ClockSessionRecord; hours: number }> {
  const { data: session, error: fetchError } = await supabase
    .from("clock_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .single();
  if (fetchError) handleClockSessionsError(fetchError);

  const reason = input.reason || "end_day";
  const endDay = reason === "end_day";
  const clockOutMs = input.forceTimeMs || Date.now();
  const segmentStart = session.session_start || session.clock_in;
  const segmentHours = calculateSessionHours(segmentStart, clockOutMs);
  const totalHours =
    Math.round(((Number(session.hours) || 0) + segmentHours) * 10000) / 10000;

  const notes = input.notes || clockOutNote(reason);

  await closeOpenClockSegment(input.sessionId, clockOutMs);
  if (!endDay) {
    await insertClockSegment({
      sessionId: input.sessionId,
      kind: breakKindFromReason(reason),
      label: breakLabelFromReason(reason),
      startedAtMs: clockOutMs,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("clock_sessions")
    .update({
      clock_out: endDay ? new Date(clockOutMs).toISOString() : null,
      status: endDay ? "completed" : "paused",
      hours: totalHours,
      session_start: endDay ? null : new Date(clockOutMs).toISOString(),
      notes,
      project_id: null,
    })
    .eq("id", input.sessionId)
    .select("*")
    .single();
  if (updateError) handleClockSessionsError(updateError);
  clockSessionsTableReady = true;

  await pauseEmployeeTaskTimers(input.employeeName, input.employeeId);
  return { session: mapClockSession(updated), hours: totalHours };
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function getCurrentWeekRange() {
  const monday = new Date();
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

function weekdayIndexFromDate(d: Date) {
  return (d.getDay() + 6) % 7;
}

/** Mon–Fri office hours from clock_sessions (current week). */
export async function fetchWeekAttendanceHours(
  employeeName: string,
  employeeId?: string
): Promise<{ day: string; h: number }[]> {
  const { monday, friday } = getCurrentWeekRange();
  const buckets = new Map<string, number>(
    WEEKDAY_LABELS.map(day => [day, 0])
  );

  let query = supabase
    .from("clock_sessions")
    .select("clock_in, hours, status, session_start")
    .gte("clock_in", monday.toISOString())
    .lte("clock_in", friday.toISOString());

  query = applyEmployeeClockFilter(query, employeeName, employeeId);

  const { data, error } = await query;
  if (error) {
    if (isMissingClockSessionsTable(error)) {
      return WEEKDAY_LABELS.map(day => ({ day, h: 0 }));
    }
    throw error;
  }

  for (const row of data || []) {
    const dayIndex = weekdayIndexFromDate(new Date(row.clock_in));
    if (dayIndex > 4) continue;
    const dayName = WEEKDAY_LABELS[dayIndex];

    let hours = Number(row.hours) || 0;
    if (row.status === "active") {
      const start = row.session_start || row.clock_in;
      hours += calculateSessionHours(start, Date.now());
    }

    buckets.set(dayName, (buckets.get(dayName) || 0) + hours);
  }

  return WEEKDAY_LABELS.map(day => ({
    day,
    h: Math.round((buckets.get(day) || 0) * 10000) / 10000,
  }));
}

/** Total office attendance today in seconds (one row per day). */
export async function fetchTodayAttendanceSeconds(
  employeeName: string,
  employeeId?: string
): Promise<number> {
  const row = await fetchTodayOfficeSession(employeeName, employeeId);
  if (!row) return 0;

  let seconds = Math.round((row.hours || 0) * 3600);

  if (row.status === "active") {
    const start = row.sessionStart || row.clockIn;
    seconds += Math.max(
      0,
      Math.floor((Date.now() - new Date(start).getTime()) / 1000)
    );
  }

  return seconds;
}

export type AttendanceEntry = {
  id: string;
  employee: string;
  employeeId: string | null;
  date: string;
  hours: number;
  clockIn: string;
  clockOut: string | null;
  status: ClockSessionStatus;
  notes: string | null;
};

/** Today's clock sessions for all employees (team shift tracker). */
export async function fetchEmployeeHistoricalSessions(employeeId: string, startDateIso: string, endDateIso: string): Promise<ClockSessionRecord[]> {
  const { data, error } = await supabase
    .from("clock_sessions")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("clock_in", startDateIso)
    .lte("clock_in", endDateIso)
    .order("clock_in", { ascending: false });

  if (error) {
    if (isMissingClockSessionsTable(error)) return [];
    throw error;
  }

  clockSessionsTableReady = true;
  const sessions = (data || []).map(mapClockSession);
  const segmentsBySession = await fetchSegmentsForSessions(sessions.map(s => s.id));
  return sessions.map(s => ({
    ...s,
    segments: segmentsBySession.get(s.id) || [],
  }));
}

export async function fetchTodayTeamClockSessions(): Promise<ClockSessionRecord[]> {
  const { start, end } = todayClockRange();
  const { data, error } = await supabase
    .from("clock_sessions")
    .select("*")
    .gte("clock_in", start)
    .lte("clock_in", end)
    .order("clock_in", { ascending: true });

  if (error) {
    if (isMissingClockSessionsTable(error)) return [];
    throw error;
  }

  clockSessionsTableReady = true;
  const sessions = (data || []).map(mapClockSession);
  const segmentsBySession = await fetchSegmentsForSessions(sessions.map(s => s.id));
  return sessions.map(s => ({
    ...s,
    segments: segmentsBySession.get(s.id) || [],
  }));
}

/** Office clock in/out rows for Timesheet / CEO attendance view. */
export async function fetchAttendanceEntries(): Promise<AttendanceEntry[]> {
  const { data, error } = await supabase
    .from("clock_sessions")
    .select("*")
    .order("clock_in", { ascending: false });

  if (error) {
    if (isMissingClockSessionsTable(error)) return [];
    throw error;
  }

  clockSessionsTableReady = true;

  return (data || []).map(row => {
    const session = mapClockSession(row);
    let hours = Number(session.hours) || 0;
    if (session.status === "active") {
      const start = session.sessionStart || session.clockIn;
      hours += calculateSessionHours(start, Date.now());
    }
    return {
      id: session.id,
      employee: session.employeeName,
      employeeId: session.employeeId,
      date: formatClockDate(new Date(session.clockIn)),
      hours: Math.round(hours * 10000) / 10000,
      clockIn: session.clockIn,
      clockOut: session.clockOut,
      status: session.status,
      notes: session.notes,
    };
  });
}

export async function updateTimesheetEntry(input: {
  projectId: string;
  entryId: string;
  date: string;
  hours: number;
  description: string;
}) {
  if (await probeProjectRelations()) {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .update({
        date: input.date,
        hours: input.hours,
        description: input.description,
      })
      .eq("id", input.entryId)
      .eq("project_id", input.projectId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Timesheet entry not found");
    return;
  }

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (fetchError) throw fetchError;

  const row = project as DbProject;
  let found = false;
  const tasks = (row.tasks || []).map(t => {
    if (!isTimesheetEntry(t) || t.id !== input.entryId) return t;
    found = true;
    return {
      ...t,
      date: input.date,
      hours: input.hours,
      description: input.description,
      title: input.description,
    };
  });
  if (!found) throw new Error("Timesheet entry not found");

  const { error } = await supabase.from("projects").update({ tasks }).eq("id", input.projectId);
  if (error) throw error;
}

export async function updateTimesheetFromTask(input: {
  projectId: string;
  taskId: string;
  date: string;
  hours: number;
  description: string;
}) {
  if (await probeProjectRelations()) {
    const { data: existing, error } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("id", input.taskId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!existing) throw new Error("Linked task not found");

    const current = existing as DbProjectTaskRow;
    const profiles = await fetchEmployeeProfiles();
    await updateProjectTask({
      projectId: input.projectId,
      taskId: input.taskId,
      originalTitle: current.title,
      title: current.title,
      assignee: profileNameById(profiles, current.assignee_id) || "—",
      assigneeId: current.assignee_id || undefined,
      status: current.status,
      priority: current.priority,
      due: input.date,
      est: String(input.hours),
      workNotes: input.description,
    });
    return;
  }

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (fetchError) throw fetchError;

  const row = project as DbProject;
  const task = (row.tasks || []).find(t => isWorkTask(t) && t.id === input.taskId);
  if (!task?.title) throw new Error("Linked task not found");

  await updateProjectTask({
    projectId: input.projectId,
    taskId: input.taskId,
    originalTitle: task.title,
    title: task.title,
    assignee: task.assignee || "—",
    status: mapTaskStatus(task.status || "todo"),
    priority: task.priority || "medium",
    due: input.date,
    est: String(input.hours),
    workNotes: input.description,
  });
}

export async function deleteTimesheetEntry(input: { projectId: string; entryId: string }) {
  if (await probeProjectRelations()) {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .delete()
      .eq("id", input.entryId)
      .eq("project_id", input.projectId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Timesheet entry not found");
    return;
  }

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .single();
  if (fetchError) throw fetchError;

  const row = project as DbProject;
  const tasks = (row.tasks || []).filter(
    t => !(isTimesheetEntry(t) && t.id === input.entryId)
  );
  if (tasks.length === (row.tasks || []).length) {
    throw new Error("Timesheet entry not found");
  }

  const { error } = await supabase.from("projects").update({ tasks }).eq("id", input.projectId);
  if (error) throw error;
}

export async function saveTimesheetEntryEdit(input: {
  projectId: string;
  entryId: string;
  kind: TimesheetEntryKind;
  taskId?: string;
  date: string;
  hours: number;
  description: string;
}) {
  if (input.kind === "task" && input.taskId) {
    await updateTimesheetFromTask({
      projectId: input.projectId,
      taskId: input.taskId,
      date: input.date,
      hours: input.hours,
      description: input.description,
    });
    return;
  }
  await updateTimesheetEntry({
    projectId: input.projectId,
    entryId: input.entryId,
    date: input.date,
    hours: input.hours,
    description: input.description,
  });
}

export async function addTimesheetEntry(input: {
  projectId: string;
  employee: string;
  employeeId?: string;
  date: string;
  hours: number;
  description: string;
}) {
  if (await probeProjectRelations()) {
    const entryId = `ts-${Date.now()}`;
    const { error } = await supabase.from("timesheet_entries").insert({
      id: entryId,
      project_id: input.projectId,
      employee_id: input.employeeId || null,
      linked_task_id: null,
      date: input.date,
      hours: input.hours,
      description: input.description,
    });
    if (error) throw error;
  } else {
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", input.projectId)
      .single();
    if (fetchError) throw fetchError;

    const row = project as DbProject;
    const entry: DbProjectTask = {
      id: `ts-${Date.now()}`,
      entryType: "timesheet",
      employee: input.employee,
      employeeId: input.employeeId,
      date: input.date,
      hours: input.hours,
      description: input.description,
      title: input.description,
      status: "submitted",
    };

    const tasks = [...(row.tasks || []), entry];
    const { error } = await supabase.from("projects").update({ tasks }).eq("id", input.projectId);
    if (error) throw error;
  }

  if (input.employeeId) {
    const dayName = new Date(input.date).toLocaleDateString("en-US", { weekday: "short" });
    const { data: profile } = await supabase
      .from("employee_profiles")
      .select("weekly_hours")
      .eq("id", input.employeeId)
      .single();

    if (profile?.weekly_hours) {
      const weekly = (profile.weekly_hours as DbWeeklyHour[]).map(d =>
        d.day === dayName ? { ...d, h: Math.min(12, d.h + input.hours) } : d
      );
      await supabase.from("employee_profiles").update({ weekly_hours: weekly }).eq("id", input.employeeId);
    }
  }
}

const PERSONAL_TASK_ROLES = new Set(["employee", "developer", "designer"]);

/** Roles that only see their own assigned tasks / projects in Task Management. */
export function isPersonalTaskRole(role: string) {
  return PERSONAL_TASK_ROLES.has(role);
}

/** Resolve logged-in user row from profile list (name, then email). */
export function findProfileForUser(
  profiles: EmployeeProfile[],
  userName: string,
  userEmail = ""
) {
  const byName = profiles.find(p => namesMatch(p.name, userName));
  if (byName) return byName;
  const email = userEmail.trim().toLowerCase();
  if (email) {
    return profiles.find(p => p.email?.trim().toLowerCase() === email);
  }
  return undefined;
}

/** Match full name, first name, or partial name (e.g. "Deepak" ↔ "Deepak Kumar"). */
export function namesMatch(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right || left === "—" || right === "—") return false;
  if (left === right) return true;
  const leftFirst = left.split(/\s+/)[0];
  const rightFirst = right.split(/\s+/)[0];
  if (leftFirst === rightFirst) return true;
  return left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

export function isTaskAssignedToUser(assignee: string, userName: string, assigneeId?: string, userId?: string) {
  if (userId && assigneeId && assigneeId === userId) return true;
  if (userName.trim() && assignee && assignee !== "—" && namesMatch(assignee, userName)) return true;
  return false;
}

export function filterTasksForUser(tasks: AppTask[], userName: string, userId?: string) {
  if (!userName.trim() && !userId) return tasks;
  return tasks.filter(t =>
    isTaskAssignedToUser(t.assignee, userName, t.assigneeId, userId)
  );
}

export function getEmployeeProjects(projects: Project[], employeeName: string, employeeId?: string) {
  return projects.filter(p =>
    (employeeId && p.teamIds?.includes(employeeId)) ||
    (employeeId && p.leadId === employeeId) ||
    p.team.some(m => namesMatch(m, employeeName)) ||
    namesMatch(p.lead, employeeName)
  );
}

function parseTimesheetEntryDateIso(date: string): string | null {
  if (!date || date === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalDateIso(d);
}

/** Mon–Fri hours for the current week from timesheet entries. */
export function buildWeeklyHoursFromTimesheets(
  entries: TimesheetEntry[],
  employeeId?: string,
  employeeName?: string
): { day: string; h: number }[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const scoped = entries.filter(e => {
    if (employeeId && e.employeeId === employeeId) return true;
    if (employeeName && namesMatch(e.employee, employeeName)) return true;
    return false;
  });

  const now = new Date();
  const monday = new Date(now);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  return days.map((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const iso = formatLocalDateIso(date);
    const h = scoped
      .filter(e => parseTimesheetEntryDateIso(e.date) === iso)
      .reduce((sum, e) => sum + e.hours, 0);
    return { day, h: Math.round(h * 10) / 10 };
  });
}

export function getEmployeeRecentTasks(
  tasks: AppTask[],
  employeeName: string,
  employeeId?: string,
  limit = 8
) {
  return filterTasksForUser(tasks, employeeName, employeeId)
    .sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (b.createdAt || b.dueIso || "").localeCompare(a.createdAt || a.dueIso || "");
    })
    .reverse()
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: formatTaskStatusLabel(t.status),
      due: t.due || "—",
      project: t.project,
    }));
}

/** Persists app actions so they appear in DevTools → Network (POST /rest/v1/activity_logs). */
export async function recordActivityLog(action: string, payload: Record<string, unknown>) {
  const { error } = await supabase.from("activity_logs").insert({
    action,
    payload,
  });
  if (error) throw error;
}

// ─── Team chat ───────────────────────────────────────────────────────────────

export type ChatChannelType = "team" | "group" | "dm";

export type ChatMessageType = "text" | "image" | "file";

export type DbChatChannel = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  is_announcements: boolean;
  channel_type?: string;
  created_by?: string | null;
  created_at?: string;
};

export type DbChatMessage = {
  id: string;
  channel_id: string;
  sender_id?: string | null;
  sender_name: string;
  content: string;
  is_broadcast: boolean;
  message_type?: string;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
};

export type DbChatChannelMember = {
  id: string;
  channel_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type DbChatChannelRead = {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_at: string;
};

export type ChatChannel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isAnnouncements: boolean;
  channelType: ChatChannelType;
  createdBy: string;
  memberIds: string[];
  displayName: string;
  createdAt: string;
};

export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  isBroadcast: boolean;
  messageType: ChatMessageType;
  mediaUrl: string;
  mediaType: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  /** Client-only state for optimistic send / failed send. */
  clientStatus?: MessageDeliveryStatus;
};

function mapChatChannelType(value?: string | null): ChatChannelType {
  if (value === "group" || value === "dm") return value;
  return "team";
}

function mapChatChannel(
  row: DbChatChannel,
  extras?: { memberIds?: string[]; displayName?: string }
): ChatChannel {
  const channelType = mapChatChannelType(row.channel_type);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    isAnnouncements: row.is_announcements,
    channelType,
    createdBy: row.created_by || "",
    memberIds: extras?.memberIds ?? [],
    displayName: extras?.displayName ?? row.name,
    createdAt: row.created_at || "",
  };
}

export function mapChatMessage(row: DbChatMessage): ChatMessage {
  let mediaUrl = normalizeCloudinaryDeliveryUrl(row.media_url?.trim() || "");
  let messageType: ChatMessageType =
    row.message_type === "image" || row.message_type === "file" ? row.message_type : "text";
  let fileName = row.file_name || "";

  const content = row.content?.trim() || "";
  const contentIsUrl = /^https?:\/\/\S+$/i.test(content);

  if (!mediaUrl && contentIsUrl) {
    mediaUrl = content;
  }

  if (mediaUrl && messageType === "text") {
    const isImage =
      row.message_type === "image" ||
      row.media_type?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i.test(mediaUrl) ||
      /\/image\/upload\//i.test(mediaUrl);
    messageType = isImage ? "image" : "file";
  }

  if (!fileName && mediaUrl) {
    try {
      const path = new URL(mediaUrl).pathname;
      fileName = decodeURIComponent(path.split("/").pop() || "") || "file";
    } catch {
      fileName = "file";
    }
  }

  return {
    id: row.id,
    channelId: row.channel_id,
    senderId: row.sender_id || "",
    senderName: row.sender_name,
    content: row.content,
    isBroadcast: row.is_broadcast,
    messageType,
    mediaUrl,
    mediaType: row.media_type || "",
    fileName,
    fileSize: row.file_size ?? 0,
    createdAt: row.created_at,
  };
}

export function isMissingChatTables(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("chat_channels") ||
    msg.includes("chat_messages") ||
    msg.includes("chat_channel_reads") ||
    msg.includes("chat_channel_members") ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table")
  );
}

export async function fetchChatChannels(): Promise<ChatChannel[]> {
  return fetchChatChannelsForUser("");
}

export async function fetchChatChannelsForUser(userId: string): Promise<ChatChannel[]> {
  const [{ data: channels, error: channelError }, { data: members, error: memberError }, profiles] =
    await Promise.all([
      supabase.from("chat_channels").select("*").order("created_at", { ascending: true }),
      supabase.from("chat_channel_members").select("channel_id, user_id"),
      fetchEmployeeProfiles(),
    ]);
  if (channelError) throw channelError;
  if (memberError && !isMissingChatTables(memberError)) throw memberError;

  const membersByChannel = new Map<string, string[]>();
  for (const m of (members || []) as { channel_id: string; user_id: string }[]) {
    if (!membersByChannel.has(m.channel_id)) membersByChannel.set(m.channel_id, []);
    membersByChannel.get(m.channel_id)!.push(m.user_id);
  }

  const profileName = new Map(profiles.map(p => [p.id, p.name]));
  const visible = ((channels || []) as DbChatChannel[]).filter(row => {
    const type = mapChatChannelType(row.channel_type);
    if (type === "team") return false;
    if (!userId) return type === "group" || type === "dm";
    const ids = membersByChannel.get(row.id) || [];
    return ids.includes(userId);
  });

  return visible.map(row => {
    const memberIds = membersByChannel.get(row.id) || [];
    let displayName = row.name;
    if (mapChatChannelType(row.channel_type) === "dm" && userId) {
      const peerId = memberIds.find(id => id !== userId);
      displayName = (peerId && profileName.get(peerId)) || row.name;
    }
    return mapChatChannel(row, { memberIds, displayName });
  });
}

export async function createGroupChannel(input: {
  name: string;
  createdBy: string;
  memberIds: string[];
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");

  const slug = `group-${Date.now()}`;
  const { data: channel, error } = await supabase
    .from("chat_channels")
    .insert({
      slug,
      name,
      description: "Group chat",
      is_announcements: false,
      channel_type: "group",
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;

  const memberSet = new Set([input.createdBy, ...input.memberIds.filter(Boolean)]);
  const rows = [...memberSet].map(userId => ({
    channel_id: (channel as DbChatChannel).id,
    user_id: userId,
    role: userId === input.createdBy ? "admin" : "member",
  }));
  const { error: memberError } = await supabase.from("chat_channel_members").insert(rows);
  if (memberError) throw memberError;

  return mapChatChannel(channel as DbChatChannel, {
    memberIds: [...memberSet],
    displayName: name,
  });
}

export async function findOrCreateDmChannel(input: {
  userId: string;
  peerId: string;
  userName: string;
  peerName: string;
}) {
  const [a, b] = [input.userId, input.peerId].sort();
  const slug = `dm-${a}-${b}`;

  const { data: existing, error: findError } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    return mapChatChannel(existing as DbChatChannel, {
      memberIds: [input.userId, input.peerId],
      displayName: input.peerName,
    });
  }

  const { data: channel, error } = await supabase
    .from("chat_channels")
    .insert({
      slug,
      name: `${input.userName} & ${input.peerName}`,
      description: "Direct message",
      is_announcements: false,
      channel_type: "dm",
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase.from("chat_channel_members").insert([
    { channel_id: (channel as DbChatChannel).id, user_id: input.userId, role: "member" },
    { channel_id: (channel as DbChatChannel).id, user_id: input.peerId, role: "member" },
  ]);
  if (memberError) throw memberError;

  return mapChatChannel(channel as DbChatChannel, {
    memberIds: [input.userId, input.peerId],
    displayName: input.peerName,
  });
}

export async function fetchChatMessages(channelId: string, limit = 150): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as DbChatMessage[]).map(mapChatMessage);
}

export async function sendChatMessage(input: {
  channelId: string;
  senderId?: string;
  senderName: string;
  content: string;
  isBroadcast?: boolean;
  messageType?: ChatMessageType;
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
}) {
  const text = input.content.trim();
  const mediaUrl = input.mediaUrl?.trim() || "";
  if (!text && !mediaUrl) throw new Error("Message cannot be empty");

  const messageType: ChatMessageType =
    input.messageType ?? (mediaUrl ? (input.mediaType?.startsWith("image/") ? "image" : "file") : "text");

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      channel_id: input.channelId,
      sender_id: input.senderId || null,
      sender_name: input.senderName,
      content: text || input.fileName || "",
      is_broadcast: input.isBroadcast ?? false,
      message_type: messageType,
      media_url: mediaUrl || null,
      media_type: input.mediaType || null,
      file_name: input.fileName || null,
      file_size: input.fileSize ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Insert notifications for other channel members
  try {
    const { data: members } = await supabase
      .from("chat_channel_members")
      .select("user_id")
      .eq("channel_id", input.channelId);
    
    if (members) {
      for (const member of members) {
        if (member.user_id !== input.senderId) {
          await insertNotification({
            recipientId: member.user_id,
            senderId: input.senderId || undefined,
            title: `New Message from ${input.senderName}`,
            message: messageType === "text" ? text : `Sent a ${messageType}`,
            type: "chat_message",
            referenceId: input.channelId
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to send chat notifications:", err);
  }

  return mapChatMessage(data as DbChatMessage);
}

export async function fetchChatChannelReadStates(
  channelId: string
): Promise<Record<string, string>> {
  if (!channelId) return {};

  const { data, error } = await supabase
    .from("chat_channel_reads")
    .select("user_id, last_read_at")
    .eq("channel_id", channelId);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of (data as Pick<DbChatChannelRead, "user_id" | "last_read_at">[]) ?? []) {
    map[row.user_id] = row.last_read_at;
  }
  return map;
}

/** WhatsApp-style ticks for messages sent by the current user. */
export function getMessageDeliveryStatus(
  message: ChatMessage,
  currentUserId: string,
  channel: ChatChannel | null,
  readStates: Record<string, string>
): MessageDeliveryStatus {
  if (message.clientStatus === "sending" || message.id.startsWith("pending-")) return "sending";
  if (message.clientStatus === "failed") return "failed";

  const otherMemberIds = (channel?.memberIds ?? []).filter(id => id && id !== currentUserId);
  if (otherMemberIds.length === 0) return "delivered";

  const msgTime = new Date(message.createdAt).getTime();
  if (Number.isNaN(msgTime)) return "delivered";

  const readByOthers = otherMemberIds.filter(uid => {
    const readAt = readStates[uid];
    if (!readAt) return false;
    // Small buffer for clock skew between clients
    return new Date(readAt).getTime() >= msgTime - 2000;
  });

  if (otherMemberIds.length === 1 && readByOthers.length > 0) return "read";
  if (readByOthers.length === otherMemberIds.length) return "read";
  return "delivered";
}

export function countMessageReaders(
  message: ChatMessage,
  currentUserId: string,
  channel: ChatChannel | null,
  readStates: Record<string, string>
) {
  const otherMemberIds = (channel?.memberIds ?? []).filter(id => id && id !== currentUserId);
  const msgTime = new Date(message.createdAt).getTime();
  const readCount = otherMemberIds.filter(uid => {
    const readAt = readStates[uid];
    return readAt && new Date(readAt).getTime() >= msgTime;
  }).length;
  return { readCount, total: otherMemberIds.length };
}

type ReadReceiptListener = (userId: string, lastReadAt: string) => void;

const readReceiptHubs = new Map<
  string,
  { room: RealtimeChannel; listeners: Set<ReadReceiptListener> }
>();

function ensureReadReceiptHub(channelId: string) {
  let hub = readReceiptHubs.get(channelId);
  if (hub) return hub;

  const listeners = new Set<ReadReceiptListener>();
  const room = supabase.channel(`chat-receipts:${channelId}`);

  room
    .on("broadcast", { event: "read_update" }, ({ payload }) => {
      const p = payload as { userId?: string; lastReadAt?: string };
      if (p?.userId && p?.lastReadAt) {
        listeners.forEach(fn => fn(p.userId!, p.lastReadAt!));
      }
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_channel_reads",
        filter: `channel_id=eq.${channelId}`,
      },
      payload => {
        const row = payload.new as { user_id?: string; last_read_at?: string } | null;
        if (row?.user_id && row?.last_read_at) {
          listeners.forEach(fn => fn(row.user_id!, row.last_read_at!));
        }
      }
    )
    .subscribe();

  hub = { room, listeners };
  readReceiptHubs.set(channelId, hub);
  return hub;
}

export function subscribeChatReadReceipts(
  channelId: string,
  listener: ReadReceiptListener
) {
  if (!channelId) return () => {};
  const hub = ensureReadReceiptHub(channelId);
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
    if (hub.listeners.size === 0) {
      supabase.removeChannel(hub.room);
      readReceiptHubs.delete(channelId);
    }
  };
}

export function broadcastChatReadReceipt(
  channelId: string,
  userId: string,
  lastReadAt: string
) {
  if (!channelId || !userId || !lastReadAt) return;
  const hub = ensureReadReceiptHub(channelId);
  void hub.room.send({
    type: "broadcast",
    event: "read_update",
    payload: { channelId, userId, lastReadAt },
  });
}

export async function markChatChannelRead(channelId: string, userId: string) {
  if (!channelId || !userId) return;

  const lastReadAt = new Date().toISOString();

  const { data: existing } = await supabase
    .from("chat_channel_reads")
    .select("id")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("chat_channel_reads")
      .update({ last_read_at: lastReadAt })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("chat_channel_reads").insert({
      channel_id: channelId,
      user_id: userId,
      last_read_at: lastReadAt,
    });
    if (error) throw error;
  }

  broadcastChatReadReceipt(channelId, userId, lastReadAt);
}

export async function fetchChatUnreadCounts(userId: string): Promise<Record<string, number>> {
  if (!userId) return {};

  const channels = await fetchChatChannelsForUser(userId);
  const { data: reads, error: readsError } = await supabase
    .from("chat_channel_reads")
    .select("channel_id, last_read_at")
    .eq("user_id", userId);
  if (readsError) throw readsError;

  const readMap = new Map(
    (reads as DbChatChannelRead[] | null)?.map(r => [r.channel_id, r.last_read_at]) ?? []
  );

  const counts: Record<string, number> = {};
  for (const channel of channels) {
    const since = readMap.get(channel.id) ?? "1970-01-01T00:00:00.000Z";
    const { count, error } = await supabase
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", channel.id)
      .gt("created_at", since);
    if (error) throw error;
    counts[channel.id] = count ?? 0;
  }
  return counts;
}

// ==========================================
// Notifications
// ==========================================

export type AppNotification = {
  id: string;
  recipient_id: string;
  sender_id?: string | null;
  title: string;
  message: string;
  type: string;
  reference_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export async function insertNotification(input: {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  senderId?: string;
  referenceId?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    sender_id: input.senderId || null,
    title: input.title,
    message: input.message,
    type: input.type,
    reference_id: input.referenceId || null,
  });
  if (error && error.message && !error.message.includes("does not exist")) {
    console.error("Insert notification error:", error);
  }
}

