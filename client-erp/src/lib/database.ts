import { supabase } from "./supabase";

// ==========================================
// Auth
// ==========================================

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ==========================================
// Identity — who's logged in, which org they belong to
// ==========================================

export type Organization = {
  id: string;
  name: string;
  planName: string | null;
};

export type Person = {
  id: string;
  kind: "client" | "team" | "admin";
  organizationId: string | null;
  authUserId: string | null;
  fullName: string;
  email: string | null;
  initials: string | null;
  role: string | null;
};

export type CurrentPersonContext = {
  person: Person;
  /** null for an admin — they aren't tied to one organization (see is_admin_person() in the RLS). */
  organization: Organization | null;
};

function mapPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    kind: row.kind as "client" | "team" | "admin",
    organizationId: (row.organization_id as string) ?? null,
    authUserId: (row.auth_user_id as string) ?? null,
    fullName: row.full_name as string,
    email: (row.email as string) ?? null,
    initials: (row.initials as string) ?? null,
    role: (row.role as string) ?? null,
  };
}

/**
 * Resolves the active Supabase Auth session to its `people` row + organization,
 * via `people.auth_user_id`. Requires the `current_person_id`/`current_org_id`
 * RLS helpers to be SECURITY DEFINER (see
 * supabase/migrations/20260909000000_fix_rls_helpers.sql) — otherwise a
 * client user can never resolve their own org (circular RLS bootstrap).
 */
export async function getCurrentPerson(): Promise<CurrentPersonContext | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from("people")
    .select("*, organizations(*)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const person = mapPerson(data);
  const orgRow = data.organizations as Record<string, unknown> | null;
  if (!orgRow) {
    // Expected for an admin (organization_id is null by design). Any other
    // kind with no org means their account isn't fully set up — App.tsx
    // treats that as an error screen, not a silent pass-through.
    if (person.kind !== "admin") return null;
    return { person, organization: null };
  }

  return {
    person,
    organization: {
      id: orgRow.id as string,
      name: orgRow.name as string,
      planName: (orgRow.plan_name as string) ?? null,
    },
  };
}

/** Every client organization — admin-only in practice (RLS only returns all rows for kind='admin'; a normal client only ever sees their own). Powers the admin's client switcher. */
export async function fetchAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase.from("organizations").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    planName: (row.plan_name as string) ?? null,
  }));
}

// ==========================================
// Projects
// ==========================================

export type ProjectStatus = "active" | "completed" | "planning";

export type Project = {
  id: string;
  organizationId: string;
  name: string;
  category: string | null;
  status: ProjectStatus;
  progressPct: number;
  healthScore: number | null;
  healthTimeline: number | null;
  healthBudget: number | null;
  healthQuality: number | null;
  healthCommunication: number | null;
  healthRisk: number | null;
  budgetTotal: number | null;
  budgetUsed: number;
  currentMilestone: string | null;
  projectManagerId: string | null;
  startDate: string | null;
  launchDate: string | null;
  description: string | null;
  tags: string[];
  updatedAt: string;
};

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    category: (row.category as string) ?? null,
    status: row.status as ProjectStatus,
    progressPct: (row.progress_pct as number) ?? 0,
    healthScore: (row.health_score as number) ?? null,
    healthTimeline: (row.health_timeline as number) ?? null,
    healthBudget: (row.health_budget as number) ?? null,
    healthQuality: (row.health_quality as number) ?? null,
    healthCommunication: (row.health_communication as number) ?? null,
    healthRisk: (row.health_risk as number) ?? null,
    budgetTotal: row.budget_total !== null && row.budget_total !== undefined ? Number(row.budget_total) : null,
    budgetUsed: Number(row.budget_used ?? 0),
    currentMilestone: (row.current_milestone as string) ?? null,
    projectManagerId: (row.project_manager_id as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    launchDate: (row.launch_date as string) ?? null,
    description: (row.description as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    updatedAt: row.updated_at as string,
  };
}

export async function fetchOrganizationProjects(organizationId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapProject);
}

/** The org's most-recently-updated active project (falls back to its first project). Command Center's health/roadmap panels focus on this one project; org-wide metrics still consider every project. */
function pickPrimaryProject(projects: Project[]): Project | null {
  if (projects.length === 0) return null;
  return projects.find(p => p.status === "active") ?? projects[0];
}

/** Every module below (Deliverables, Documents, Meetings, Billing, Team, Support) is scoped to the org's one primary project — same convention as Command Center and Projects. */
export async function fetchPrimaryProject(organizationId: string): Promise<Project | null> {
  return pickPrimaryProject(await fetchOrganizationProjects(organizationId));
}

// ==========================================
// Command Center — action items, roadmap, activity, AI summary, support
// ==========================================

export type ActionItemPriority = "high" | "medium" | "low";

export type ActionItem = {
  id: string;
  title: string;
  priority: ActionItemPriority;
  dueLabel: string;
  type: string | null;
};

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const todayKey = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  if (dateStr === todayKey) return "Today";
  if (dateStr === tomorrowKey) return "Tomorrow";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapTaskToActionItem(row: Record<string, unknown>): ActionItem {
  return {
    id: row.id as string,
    title: row.title as string,
    priority: row.priority as ActionItemPriority,
    dueLabel: formatDueDate((row.due_date as string) ?? null),
    type: (row.type as string) ?? null,
  };
}

export type MilestoneStep = {
  id: string;
  label: string;
  status: "done" | "active" | "upcoming";
  targetDate: string | null;
};

function mapMilestone(row: Record<string, unknown>): MilestoneStep {
  return {
    id: row.id as string,
    label: row.label as string,
    status: row.status as "done" | "active" | "upcoming",
    targetDate: (row.target_date as string) ?? null,
  };
}

export type ActivityEntry = {
  id: string;
  timeLabel: string;
  text: string;
  type: string;
  user: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function mapActivity(row: Record<string, unknown>): ActivityEntry {
  const actor = row.people as Record<string, unknown> | null;
  return {
    id: row.id as string,
    timeLabel: timeAgo(row.created_at as string),
    text: row.description as string,
    type: row.action_type as string,
    user: (actor?.full_name as string) ?? "System",
  };
}

export type AiExecutiveSummary = {
  summaryText: string;
  deliveryConfidencePct: number | null;
  healthGrade: string | null;
  estimatedLaunchDate: string | null;
  budgetStatus: string | null;
  riskLevel: string | null;
  generatedAt: string;
};

function mapAiSummary(row: Record<string, unknown>): AiExecutiveSummary {
  return {
    summaryText: row.summary_text as string,
    deliveryConfidencePct: (row.delivery_confidence_pct as number) ?? null,
    healthGrade: (row.health_grade as string) ?? null,
    estimatedLaunchDate: (row.estimated_launch_date as string) ?? null,
    budgetStatus: (row.budget_status as string) ?? null,
    riskLevel: (row.risk_level as string) ?? null,
    generatedAt: row.generated_at as string,
  };
}

export type SupportSummary = {
  openCount: number;
  nearestSlaDueAt: string | null;
};

async function fetchOpenSupportSummary(projectIds: string[]): Promise<SupportSummary> {
  if (projectIds.length === 0) return { openCount: 0, nearestSlaDueAt: null };
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, sla_due_at")
    .in("project_id", projectIds)
    .neq("status", "resolved")
    .order("sla_due_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  return { openCount: rows.length, nearestSlaDueAt: (rows[0]?.sla_due_at as string) ?? null };
}

export type CommandCenterData = {
  projects: Project[];
  primaryProject: Project | null;
  actionItems: ActionItem[];
  milestones: MilestoneStep[];
  activity: ActivityEntry[];
  aiSummary: AiExecutiveSummary | null;
  support: SupportSummary;
};

/** Everything the Command Center dashboard needs, in one call. */
export async function fetchCommandCenterData(organizationId: string): Promise<CommandCenterData> {
  const projects = await fetchOrganizationProjects(organizationId);
  const primaryProject = pickPrimaryProject(projects);
  const allProjectIds = projects.map(p => p.id);

  if (!primaryProject) {
    const support = await fetchOpenSupportSummary(allProjectIds);
    return { projects, primaryProject: null, actionItems: [], milestones: [], activity: [], aiSummary: null, support };
  }

  const [tasksRes, milestonesRes, activityRes, aiRes, support] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", primaryProject.id)
      .neq("status", "completed")
      // `tasks` is shared with sprint/dev task tracking (Projects page) —
      // only client-facing types belong in the Client Action Center.
      .in("type", ["approval", "review", "upload", "invoice"])
      .order("due_date", { ascending: true }),
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", primaryProject.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("activity_log")
      .select("*, people(full_name)")
      .eq("project_id", primaryProject.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ai_executive_summaries")
      .select("*")
      .eq("project_id", primaryProject.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchOpenSupportSummary(allProjectIds),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (milestonesRes.error) throw milestonesRes.error;
  if (activityRes.error) throw activityRes.error;
  if (aiRes.error) throw aiRes.error;

  return {
    projects,
    primaryProject,
    actionItems: (tasksRes.data ?? []).map(mapTaskToActionItem),
    milestones: (milestonesRes.data ?? []).map(mapMilestone),
    activity: (activityRes.data ?? []).map(mapActivity),
    aiSummary: aiRes.data ? mapAiSummary(aiRes.data) : null,
    support,
  };
}

// ==========================================
// All-Clients Overview — admin's Command Center when no single client is
// picked from the switcher: an aggregate roll-up plus a per-client roster.
// ==========================================

export type ClientOverviewRow = {
  organizationId: string;
  organizationName: string;
  projectName: string | null;
  projectStatus: ProjectStatus | null;
  healthScore: number | null;
  pendingApprovals: number;
  openTickets: number;
};

export type AllClientsOverview = {
  totalClients: number;
  activeProjects: number;
  completedProjects: number;
  totalPendingApprovals: number;
  totalOpenTickets: number;
  clients: ClientOverviewRow[];
};

export async function fetchAllClientsOverview(): Promise<AllClientsOverview> {
  const organizations = await fetchAllOrganizations();

  const { data: projectRows, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  const projects = (projectRows ?? []).map(mapProject);
  const projectIds = projects.map(p => p.id);

  const [deliverablesRes, ticketsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("deliverables").select("project_id").in("project_id", projectIds).in("status", ["pending", "review"])
      : Promise.resolve({ data: [] as { project_id: string }[], error: null }),
    projectIds.length > 0
      ? supabase.from("support_tickets").select("project_id").in("project_id", projectIds).neq("status", "resolved")
      : Promise.resolve({ data: [] as { project_id: string }[], error: null }),
  ]);
  if (deliverablesRes.error) throw deliverablesRes.error;
  if (ticketsRes.error) throw ticketsRes.error;

  const pendingByProject = new Map<string, number>();
  for (const row of deliverablesRes.data ?? []) pendingByProject.set(row.project_id, (pendingByProject.get(row.project_id) ?? 0) + 1);
  const openTicketsByProject = new Map<string, number>();
  for (const row of ticketsRes.data ?? []) openTicketsByProject.set(row.project_id, (openTicketsByProject.get(row.project_id) ?? 0) + 1);

  const projectsByOrg = new Map<string, Project[]>();
  for (const p of projects) {
    const list = projectsByOrg.get(p.organizationId) ?? [];
    list.push(p);
    projectsByOrg.set(p.organizationId, list);
  }

  const clients: ClientOverviewRow[] = organizations.map(org => {
    const orgProjects = projectsByOrg.get(org.id) ?? [];
    const primary = pickPrimaryProject(orgProjects);
    return {
      organizationId: org.id,
      organizationName: org.name,
      projectName: primary?.name ?? null,
      projectStatus: primary?.status ?? null,
      healthScore: primary?.healthScore ?? null,
      pendingApprovals: primary ? (pendingByProject.get(primary.id) ?? 0) : 0,
      openTickets: primary ? (openTicketsByProject.get(primary.id) ?? 0) : 0,
    };
  });

  return {
    totalClients: organizations.length,
    activeProjects: projects.filter(p => p.status === "active").length,
    completedProjects: projects.filter(p => p.status === "completed").length,
    totalPendingApprovals: [...pendingByProject.values()].reduce((a, b) => a + b, 0),
    totalOpenTickets: [...openTicketsByProject.values()].reduce((a, b) => a + b, 0),
    clients,
  };
}

// ==========================================
// Portfolio — every project in the org, with team + tags
// ==========================================

export type PortfolioProject = Project & { teamInitials: string[]; organizationName?: string };

/**
 * `organizationId` omitted = admin "All Clients" mode: every project across
 * every organization, labeled with its client's name. RLS only actually
 * returns cross-org rows for kind='admin' (see is_admin_person()) — a normal
 * client calling this without an id would just get their own single project
 * list back with no organizationName, since RLS still only shows their org.
 */
export async function fetchPortfolioProjects(organizationId?: string): Promise<PortfolioProject[]> {
  let projects: Project[];
  const orgNameByProjectId = new Map<string, string>();

  if (organizationId) {
    projects = await fetchOrganizationProjects(organizationId);
  } else {
    const { data, error } = await supabase
      .from("projects")
      .select("*, organizations(name)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    projects = rows.map(mapProject);
    for (const row of rows) {
      const orgRow = row.organizations as unknown as Record<string, unknown> | null;
      if (orgRow?.name) orgNameByProjectId.set(row.id as string, orgRow.name as string);
    }
  }

  const projectIds = projects.map(p => p.id);
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("project_team_members")
    .select("project_id, people(initials, full_name)")
    .in("project_id", projectIds);
  if (error) throw error;

  const teamByProject = new Map<string, string[]>();
  for (const row of data ?? []) {
    const person = row.people as unknown as Record<string, unknown> | null;
    const initials = (person?.initials as string) || (person?.full_name as string | undefined)?.slice(0, 2).toUpperCase();
    if (!initials) continue;
    const list = teamByProject.get(row.project_id as string) ?? [];
    list.push(initials);
    teamByProject.set(row.project_id as string, list);
  }

  return projects.map(p => ({
    ...p,
    teamInitials: teamByProject.get(p.id) ?? [],
    organizationName: orgNameByProjectId.get(p.id),
  }));
}

// ==========================================
// Analytics — cross-project aggregates for the org (or, for an admin with no
// org picked, across every client) layered on top of the Portfolio project list.
// ==========================================

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "completed";

export type AnalyticsData = {
  projects: PortfolioProject[];
  deliverablesByStatus: Record<DeliverableStatus, number>;
  tasksByStatus: Record<TaskStatus, number>;
};

export async function fetchAnalyticsData(organizationId?: string): Promise<AnalyticsData> {
  const projects = await fetchPortfolioProjects(organizationId);
  const deliverablesByStatus: Record<DeliverableStatus, number> = { pending: 0, review: 0, approved: 0, changes: 0 };
  const tasksByStatus: Record<TaskStatus, number> = { not_started: 0, in_progress: 0, blocked: 0, completed: 0 };

  const projectIds = projects.map(p => p.id);
  if (projectIds.length === 0) return { projects, deliverablesByStatus, tasksByStatus };

  const [deliverablesRes, tasksRes] = await Promise.all([
    supabase.from("deliverables").select("status").in("project_id", projectIds),
    supabase.from("tasks").select("status").in("project_id", projectIds),
  ]);
  if (deliverablesRes.error) throw deliverablesRes.error;
  if (tasksRes.error) throw tasksRes.error;

  for (const row of deliverablesRes.data ?? []) {
    const status = row.status as DeliverableStatus;
    if (status in deliverablesByStatus) deliverablesByStatus[status]++;
  }
  for (const row of tasksRes.data ?? []) {
    const status = row.status as TaskStatus;
    if (status in tasksByStatus) tasksByStatus[status]++;
  }

  return { projects, deliverablesByStatus, tasksByStatus };
}

// ==========================================
// Project detail — sprints, current-sprint task breakdown, activity, change requests
// ==========================================

export type SprintInfo = {
  id: string;
  label: string;
  velocityPoints: number | null;
  isCurrent: boolean;
};

export type SprintTaskBreakdown = {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  notStarted: number;
};

export type ChangeRequestStatus = "backlog" | "in-progress" | "review" | "approved";

export type ChangeRequest = {
  id: string;
  requestNumber: string;
  title: string;
  requestedByName: string;
  priority: ActionItemPriority;
  status: ChangeRequestStatus;
  assignedToName: string | null;
  dueLabel: string;
  progressPct: number;
};

export type ProjectDetail = {
  project: Project | null;
  projectManagerName: string | null;
  velocityHistory: SprintInfo[];
  currentSprint: SprintInfo | null;
  currentSprintBreakdown: SprintTaskBreakdown;
  recentActivity: ActivityEntry[];
  changeRequests: ChangeRequest[];
};

function mapSprint(row: Record<string, unknown>): SprintInfo {
  return {
    id: row.id as string,
    label: row.label as string,
    velocityPoints: (row.velocity_points as number) ?? null,
    isCurrent: Boolean(row.is_current),
  };
}

function mapChangeRequest(row: Record<string, unknown>, peopleById: Map<string, string>): ChangeRequest {
  const requestedById = (row.requested_by as string) ?? null;
  const assignedToId = (row.assigned_to as string) ?? null;
  return {
    id: row.id as string,
    requestNumber: row.request_number as string,
    title: row.title as string,
    requestedByName: (requestedById && peopleById.get(requestedById)) || (row.requested_by_text as string) || "Client",
    priority: row.priority as ActionItemPriority,
    status: row.status as ChangeRequestStatus,
    assignedToName: (assignedToId && peopleById.get(assignedToId)) || null,
    dueLabel: formatDueDate((row.due_date as string) ?? null),
    progressPct: (row.progress_pct as number) ?? 0,
  };
}

/** The org's primary project, in full: sprint velocity, current-sprint task breakdown, recent activity, and every change request — everything the Projects page's two tabs need. */
export async function fetchProjectDetail(organizationId: string): Promise<ProjectDetail> {
  const projects = await fetchOrganizationProjects(organizationId);
  const project = pickPrimaryProject(projects);

  const empty: ProjectDetail = {
    project: null,
    projectManagerName: null,
    velocityHistory: [],
    currentSprint: null,
    currentSprintBreakdown: { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0 },
    recentActivity: [],
    changeRequests: [],
  };
  if (!project) return empty;

  const [pmRes, sprintsRes, activityRes, crRes] = await Promise.all([
    project.projectManagerId
      ? supabase.from("people").select("full_name").eq("id", project.projectManagerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("sprints").select("*").eq("project_id", project.id).order("start_date", { ascending: true }),
    supabase
      .from("activity_log")
      .select("*, people(full_name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("change_requests").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
  ]);

  if (pmRes.error) throw pmRes.error;
  if (sprintsRes.error) throw sprintsRes.error;
  if (activityRes.error) throw activityRes.error;
  if (crRes.error) throw crRes.error;

  const crRows = crRes.data ?? [];
  const referencedPeopleIds = new Set<string>();
  for (const row of crRows) {
    if (row.requested_by) referencedPeopleIds.add(row.requested_by as string);
    if (row.assigned_to) referencedPeopleIds.add(row.assigned_to as string);
  }
  let peopleById = new Map<string, string>();
  if (referencedPeopleIds.size > 0) {
    const { data: peopleRows, error: peopleErr } = await supabase
      .from("people")
      .select("id, full_name")
      .in("id", [...referencedPeopleIds]);
    if (peopleErr) throw peopleErr;
    peopleById = new Map((peopleRows ?? []).map(p => [p.id as string, p.full_name as string]));
  }

  const sprints = (sprintsRes.data ?? []).map(mapSprint);
  const currentSprint = sprints.find(s => s.isCurrent) ?? null;

  const currentSprintBreakdown: SprintTaskBreakdown = { total: 0, completed: 0, inProgress: 0, blocked: 0, notStarted: 0 };
  if (currentSprint) {
    const { data: sprintTasks, error: tasksErr } = await supabase.from("tasks").select("status").eq("sprint_id", currentSprint.id);
    if (tasksErr) throw tasksErr;
    for (const row of sprintTasks ?? []) {
      currentSprintBreakdown.total++;
      if (row.status === "completed") currentSprintBreakdown.completed++;
      else if (row.status === "in_progress") currentSprintBreakdown.inProgress++;
      else if (row.status === "blocked") currentSprintBreakdown.blocked++;
      else currentSprintBreakdown.notStarted++;
    }
  }

  return {
    project,
    projectManagerName: ((pmRes.data as Record<string, unknown> | null)?.full_name as string) ?? null,
    velocityHistory: sprints,
    currentSprint,
    currentSprintBreakdown,
    recentActivity: (activityRes.data ?? []).map(mapActivity),
    changeRequests: crRows.map(row => mapChangeRequest(row, peopleById)),
  };
}

// ==========================================
// Shared formatting helpers for the modules below
// ==========================================

function formatDateLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ==========================================
// Team — the org's primary project's assigned staff (falls back to the
// full agency directory if no one's been assigned to the project yet)
// ==========================================

export type PresenceStatus = "online" | "busy" | "away" | "offline";

export type TeamMember = {
  id: string;
  fullName: string;
  role: string | null;
  initials: string;
  specialty: string | null;
  yearsExperience: number | null;
  availabilityText: string | null;
  presenceStatus: PresenceStatus | null;
  email: string | null;
  activeTaskCount: number;
};

function mapTeamMember(row: Record<string, unknown>): Omit<TeamMember, "activeTaskCount"> {
  const fullName = row.full_name as string;
  return {
    id: row.id as string,
    fullName,
    role: (row.role as string) ?? null,
    initials: (row.initials as string) || fullName.slice(0, 2).toUpperCase(),
    specialty: (row.specialty as string) ?? null,
    yearsExperience: (row.years_experience as number) ?? null,
    availabilityText: (row.availability_text as string) ?? null,
    presenceStatus: (row.presence_status as PresenceStatus) ?? null,
    email: (row.email as string) ?? null,
  };
}

/** The people actually assigned to the org's primary project; active-task counts are scoped to that same project (per-client visibility, not company-wide). */
export async function fetchProjectTeam(organizationId: string): Promise<TeamMember[]> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return [];

  const { data: memberRows, error: memberErr } = await supabase
    .from("project_team_members")
    .select("people(*)")
    .eq("project_id", project.id);
  if (memberErr) throw memberErr;

  let peopleRows = (memberRows ?? [])
    .map(r => r.people as unknown as Record<string, unknown> | null)
    .filter((p): p is Record<string, unknown> => p !== null);

  if (peopleRows.length === 0) {
    // Nobody explicitly assigned yet — show the agency staff directory instead.
    const { data, error } = await supabase.from("people").select("*").eq("kind", "team");
    if (error) throw error;
    peopleRows = data ?? [];
  }

  const { data: taskRows, error: taskErr } = await supabase
    .from("tasks")
    .select("assigned_to")
    .eq("project_id", project.id)
    .neq("status", "completed");
  if (taskErr) throw taskErr;

  const activeTaskCountByPerson = new Map<string, number>();
  for (const row of taskRows ?? []) {
    const id = row.assigned_to as string | null;
    if (!id) continue;
    activeTaskCountByPerson.set(id, (activeTaskCountByPerson.get(id) ?? 0) + 1);
  }

  return peopleRows.map(row => ({
    ...mapTeamMember(row),
    activeTaskCount: activeTaskCountByPerson.get(row.id as string) ?? 0,
  }));
}

// ==========================================
// Documents — the project's document vault
// ==========================================

export type DocumentCategory = "contracts" | "invoices" | "design" | "reports" | "meetings" | "brand";

export type DocumentItem = {
  id: string;
  name: string;
  category: DocumentCategory;
  fileType: string | null;
  version: string | null;
  fileUrl: string | null;
  fileSizeLabel: string;
  dateLabel: string;
};

function mapDocument(row: Record<string, unknown>): DocumentItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as DocumentCategory,
    fileType: (row.file_type as string) ?? null,
    version: (row.version as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    fileSizeLabel: formatFileSize((row.file_size_bytes as number) ?? null),
    dateLabel: formatDateLabel(row.created_at as string),
  };
}

export async function fetchDocuments(organizationId: string): Promise<DocumentItem[]> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDocument);
}

// ==========================================
// Meetings — upcoming schedule + past meetings with AI summaries.
// Action items for a past meeting are tasks sourced from it (source_type='meeting').
// ==========================================

export type MeetingType = "planning" | "review" | "design" | "retro";

export type MeetingItem = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string | null;
  durationLabel: string;
  type: MeetingType | null;
  attendeeInitials: string[];
  isPast: boolean;
  aiSummary: string | null;
  decisions: string[];
  actionItems: string[];
  recordingUrl: string | null;
  meetLink: string | null;
};

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  return `${minutes} min`;
}

function formatTimeLabel(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export async function fetchMeetings(organizationId: string): Promise<MeetingItem[]> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return [];

  const { data: rows, error } = await supabase
    .from("meetings")
    .select("*, meeting_attendees(people(initials, full_name))")
    .eq("project_id", project.id)
    .order("meeting_date", { ascending: false });
  if (error) throw error;

  const meetingRows = rows ?? [];
  const meetingIds = meetingRows.map(r => r.id as string);

  const actionItemsByMeeting = new Map<string, string[]>();
  if (meetingIds.length > 0) {
    const { data: taskRows, error: taskErr } = await supabase
      .from("tasks")
      .select("title, source_id")
      .eq("source_type", "meeting")
      .in("source_id", meetingIds);
    if (taskErr) throw taskErr;
    for (const row of taskRows ?? []) {
      const id = row.source_id as string;
      const list = actionItemsByMeeting.get(id) ?? [];
      list.push(row.title as string);
      actionItemsByMeeting.set(id, list);
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingRows = meetingRows
    .filter(r => (r.meeting_date as string) >= todayKey)
    .sort((a, b) => (a.meeting_date as string).localeCompare(b.meeting_date as string));
  const pastRows = meetingRows.filter(r => (r.meeting_date as string) < todayKey); // already newest-first from the query order

  return [...upcomingRows, ...pastRows].map(row => {
    const attendeeRows = (row.meeting_attendees as unknown as { people: Record<string, unknown> | null }[]) ?? [];
    const attendeeInitials = attendeeRows
      .map(a => (a.people?.initials as string) || (a.people?.full_name as string | undefined)?.slice(0, 2).toUpperCase())
      .filter((v): v is string => Boolean(v));
    const meetingDate = row.meeting_date as string;
    return {
      id: row.id as string,
      title: row.title as string,
      dateLabel: formatDateLabel(meetingDate),
      timeLabel: formatTimeLabel((row.start_time as string) ?? null),
      durationLabel: formatDuration((row.duration_minutes as number) ?? null),
      type: (row.type as MeetingType) ?? null,
      attendeeInitials,
      isPast: meetingDate < todayKey,
      aiSummary: (row.ai_summary as string) ?? null,
      decisions: (row.decisions as string[]) ?? [],
      actionItems: actionItemsByMeeting.get(row.id as string) ?? [],
      recordingUrl: (row.recording_url as string) ?? null,
      meetLink: (row.meet_link as string) ?? null,
    };
  });
}

/** Schedules a new meeting on the org's primary project. Attendees aren't collected here — the meeting shows up for the client (and team) as soon as it's created. */
export async function scheduleMeeting(organizationId: string, input: {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  type: MeetingType;
}): Promise<void> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) throw new Error("No project found to schedule this meeting on.");

  const { error } = await supabase.from("meetings").insert({
    project_id: project.id,
    title: input.title,
    meeting_date: input.date,
    start_time: input.time,
    duration_minutes: input.durationMinutes,
    type: input.type,
  });
  if (error) throw error;
}

/** Lazily creates (once) and returns the Google Meet link for a scheduled meeting — same link every time it's called for that meeting, so the client and the team land in the same room without ever exchanging a URL. */
export async function joinScheduledMeeting(meetingId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-meet-link", { body: { mode: "scheduled", meetingId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.meetLink as string;
}

/** A fresh, ad-hoc Google Meet link for "start a meeting right now" — not persisted anywhere. */
export async function startInstantMeeting(organizationId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-meet-link", { body: { mode: "instant", organizationId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.meetLink as string;
}

// ==========================================
// Billing — contract terms, retainer hour usage, and invoices
// ==========================================

export type ContractHourCategory = { category: string; hoursUsed: number };

export type BillingContract = {
  totalValue: number;
  hoursTotal: number;
  hoursUsed: number;
  hourCategories: ContractHourCategory[];
};

export type InvoiceStatus = "paid" | "pending" | "overdue";

export type InvoiceItem = {
  id: string;
  invoiceNumber: string;
  description: string | null;
  amount: number;
  paidAmount: number;
  issueDateLabel: string;
  dueDateLabel: string;
  dueDateRaw: string;
  status: InvoiceStatus;
};

export type MonthlySpend = { month: string; amount: number };

export type BillingData = {
  contract: BillingContract | null;
  invoices: InvoiceItem[];
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  nextDueLabel: string | null;
  monthlySpend: MonthlySpend[];
};

function mapInvoice(row: Record<string, unknown>): InvoiceItem {
  return {
    id: row.id as string,
    invoiceNumber: row.invoice_number as string,
    description: (row.description as string) ?? null,
    amount: Number(row.amount),
    paidAmount: Number(row.paid_amount ?? 0),
    issueDateLabel: formatDateLabel(row.issue_date as string),
    dueDateLabel: formatDateLabel(row.due_date as string),
    dueDateRaw: row.due_date as string,
    status: row.status as InvoiceStatus,
  };
}

export async function fetchBillingData(organizationId: string): Promise<BillingData> {
  const empty: BillingData = {
    contract: null, invoices: [], totalBilled: 0, totalPaid: 0, totalOutstanding: 0, nextDueLabel: null, monthlySpend: [],
  };
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return empty;

  const [contractRes, invoicesRes] = await Promise.all([
    supabase.from("contracts").select("*, contract_hour_categories(*)").eq("project_id", project.id).maybeSingle(),
    supabase.from("invoices").select("*").eq("project_id", project.id).order("issue_date", { ascending: false }),
  ]);
  if (contractRes.error) throw contractRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  const contractRow = contractRes.data as Record<string, unknown> | null;
  const contract: BillingContract | null = contractRow ? {
    totalValue: Number(contractRow.total_value ?? 0),
    hoursTotal: Number(contractRow.hours_total ?? 0),
    hoursUsed: Number(contractRow.hours_used ?? 0),
    hourCategories: ((contractRow.contract_hour_categories as Record<string, unknown>[]) ?? []).map(c => ({
      category: c.category as string,
      hoursUsed: Number(c.hours_used ?? 0),
    })),
  } : null;

  const invoiceRows = invoicesRes.data ?? [];
  const invoices = invoiceRows.map(mapInvoice);

  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
  const nextDue = [...invoices].filter(i => i.status !== "paid").sort((a, b) => a.dueDateRaw.localeCompare(b.dueDateRaw))[0];

  const monthKeys: { key: string; label: string }[] = [];
  const cursor = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    monthKeys.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short" }) });
  }
  const monthlySpend = monthKeys.map(({ key, label }) => ({
    month: label,
    amount: invoiceRows.filter(r => (r.issue_date as string)?.slice(0, 7) === key).reduce((sum, r) => sum + Number(r.amount), 0),
  }));

  return {
    contract,
    invoices,
    totalBilled,
    totalPaid,
    totalOutstanding,
    nextDueLabel: nextDue ? nextDue.dueDateLabel : null,
    monthlySpend,
  };
}

// ==========================================
// Deliverables — files up for review, with pin comments; approve/request-changes writes
// ==========================================

export type DeliverableType = "Design" | "Development" | "Report" | "Document";
export type DeliverableStatus = "pending" | "review" | "approved" | "changes";

export type DeliverableComment = {
  id: string;
  x: number;
  y: number;
  authorName: string;
  text: string;
  resolved: boolean;
  timeLabel: string;
};

export type DeliverableItem = {
  id: string;
  name: string;
  type: DeliverableType | null;
  status: DeliverableStatus;
  currentVersion: string | null;
  uploadedByName: string | null;
  fileUrl: string | null;
  previewUrl: string | null;
  fileSizeLabel: string;
  dateLabel: string;
  comments: DeliverableComment[];
};

function mapDeliverable(row: Record<string, unknown>, peopleById: Map<string, string>): Omit<DeliverableItem, "comments"> {
  const uploadedBy = row.uploaded_by as string | null;
  return {
    id: row.id as string,
    name: row.name as string,
    type: (row.type as DeliverableType) ?? null,
    status: row.status as DeliverableStatus,
    currentVersion: (row.current_version as string) ?? null,
    uploadedByName: (uploadedBy && peopleById.get(uploadedBy)) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    previewUrl: (row.preview_url as string) ?? null,
    fileSizeLabel: formatFileSize((row.file_size_bytes as number) ?? null),
    dateLabel: formatDateLabel(row.created_at as string),
  };
}

export async function fetchDeliverables(organizationId: string): Promise<DeliverableItem[]> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return [];

  const { data: rows, error } = await supabase
    .from("deliverables")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const deliverableRows = rows ?? [];
  const uploaderIds = [...new Set(deliverableRows.map(r => r.uploaded_by as string | null).filter((v): v is string => Boolean(v)))];
  let peopleById = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: peopleRows, error: peopleErr } = await supabase.from("people").select("id, full_name").in("id", uploaderIds);
    if (peopleErr) throw peopleErr;
    peopleById = new Map((peopleRows ?? []).map(p => [p.id as string, p.full_name as string]));
  }

  const deliverableIds = deliverableRows.map(r => r.id as string);
  const commentsByDeliverable = new Map<string, DeliverableComment[]>();
  if (deliverableIds.length > 0) {
    const { data: commentRows, error: commentErr } = await supabase
      .from("deliverable_comments")
      .select("*, people(full_name)")
      .in("deliverable_id", deliverableIds)
      .order("created_at", { ascending: true });
    if (commentErr) throw commentErr;
    for (const row of commentRows ?? []) {
      const author = row.people as Record<string, unknown> | null;
      const comment: DeliverableComment = {
        id: row.id as string,
        x: Number(row.x),
        y: Number(row.y),
        authorName: (author?.full_name as string) ?? "Client",
        text: row.text as string,
        resolved: Boolean(row.resolved),
        timeLabel: timeAgo(row.created_at as string),
      };
      const list = commentsByDeliverable.get(row.deliverable_id as string) ?? [];
      list.push(comment);
      commentsByDeliverable.set(row.deliverable_id as string, list);
    }
  }

  return deliverableRows.map(row => ({
    ...mapDeliverable(row, peopleById),
    comments: commentsByDeliverable.get(row.id as string) ?? [],
  }));
}

export async function setDeliverableStatus(deliverableId: string, status: DeliverableStatus): Promise<void> {
  const { error } = await supabase.from("deliverables").update({ status, updated_at: new Date().toISOString() }).eq("id", deliverableId);
  if (error) throw error;
}

// ==========================================
// Support Center — ticket queue (read + raise-a-ticket)
// ==========================================

export type SupportTicketStatus = "open" | "in-progress" | "resolved";
export type SupportTicketPriority = "high" | "medium" | "low";

export type SupportTicketItem = {
  id: string;
  ticketNumber: string;
  title: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assigneeName: string | null;
  createdLabel: string;
  slaLabel: string | null;
  resolutionHours: number | null;
  updatedAt: string;
};

function mapSupportTicket(row: Record<string, unknown>, peopleById: Map<string, string>): SupportTicketItem {
  const assigneeId = row.assignee_id as string | null;
  const slaDueAt = row.sla_due_at as string | null;
  const status = row.status as SupportTicketStatus;
  let slaLabel: string | null = null;
  if (status !== "resolved" && slaDueAt) {
    const diffHours = Math.round((new Date(slaDueAt).getTime() - Date.now()) / 3600000);
    slaLabel = diffHours > 0 ? `${diffHours}h` : "Overdue";
  }
  const createdAt = row.created_at as string;
  const updatedAt = row.updated_at as string;
  return {
    id: row.id as string,
    ticketNumber: row.ticket_number as string,
    title: row.title as string,
    priority: row.priority as SupportTicketPriority,
    status,
    assigneeName: (assigneeId && peopleById.get(assigneeId)) ?? null,
    createdLabel: formatDateLabel(createdAt),
    slaLabel,
    resolutionHours: status === "resolved" ? (new Date(updatedAt).getTime() - new Date(createdAt).getTime()) / 3600000 : null,
    updatedAt,
  };
}

export type SupportCenterData = {
  tickets: SupportTicketItem[];
  openCount: number;
  inProgressCount: number;
  resolvedLast30dCount: number;
  avgResolutionHours: number | null;
  projectId: string | null;
};

export async function fetchSupportTickets(organizationId: string): Promise<SupportCenterData> {
  const empty: SupportCenterData = { tickets: [], openCount: 0, inProgressCount: 0, resolvedLast30dCount: 0, avgResolutionHours: null, projectId: null };
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return empty;

  const { data: rows, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ticketRows = rows ?? [];
  const assigneeIds = [...new Set(ticketRows.map(r => r.assignee_id as string | null).filter((v): v is string => Boolean(v)))];
  let peopleById = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: peopleRows, error: peopleErr } = await supabase.from("people").select("id, full_name").in("id", assigneeIds);
    if (peopleErr) throw peopleErr;
    peopleById = new Map((peopleRows ?? []).map(p => [p.id as string, p.full_name as string]));
  }

  const tickets = ticketRows.map(row => mapSupportTicket(row, peopleById));
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000;
  const resolvedLast30d = tickets.filter(t => t.status === "resolved" && new Date(t.updatedAt).getTime() >= thirtyDaysAgo);
  const resolutionHoursList = tickets.map(t => t.resolutionHours).filter((v): v is number => v !== null);

  return {
    tickets,
    openCount: tickets.filter(t => t.status === "open").length,
    inProgressCount: tickets.filter(t => t.status === "in-progress").length,
    resolvedLast30dCount: resolvedLast30d.length,
    avgResolutionHours: resolutionHoursList.length > 0 ? resolutionHoursList.reduce((a, b) => a + b, 0) / resolutionHoursList.length : null,
    projectId: project.id,
  };
}

export async function createSupportTicket(projectId: string, title: string, priority: SupportTicketPriority): Promise<void> {
  const ticketNumber = `T-${Date.now().toString().slice(-6)}`;
  const { error } = await supabase.from("support_tickets").insert({
    ticket_number: ticketNumber,
    project_id: projectId,
    title,
    priority,
    status: "open",
  });
  if (error) throw error;
}

// ==========================================
// Notifications
// ==========================================

export type NotificationType = "deliverable" | "invoice" | "task" | "ai_summary" | "meeting" | "support_ticket";

export type NotificationItem = {
  id: string;
  title: string;
  description: string | null;
  type: NotificationType | null;
  read: boolean;
  timeLabel: string;
};

function mapNotification(row: Record<string, unknown>): NotificationItem {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    type: (row.notification_type as NotificationType) ?? null,
    read: Boolean(row.read),
    timeLabel: timeAgo(row.created_at as string),
  };
}

export async function fetchNotifications(personId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", personId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(personId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("recipient_id", personId).eq("read", false);
  if (error) throw error;
}

// ==========================================
// Settings — per-user client_settings row (upserted on first change)
// ==========================================

export type ClientSettings = {
  emailNotifications: boolean;
  inAppAlerts: boolean;
  smsAlerts: boolean;
  theme: string;
  dashboardLayout: string | null;
  dateTimeFormat: string | null;
  twoFactorEnabled: boolean;
};

const defaultClientSettings: ClientSettings = {
  emailNotifications: true,
  inAppAlerts: true,
  smsAlerts: false,
  theme: "dark",
  dashboardLayout: null,
  dateTimeFormat: null,
  twoFactorEnabled: false,
};

function mapClientSettings(row: Record<string, unknown>): ClientSettings {
  return {
    emailNotifications: Boolean(row.email_notifications),
    inAppAlerts: Boolean(row.in_app_alerts),
    smsAlerts: Boolean(row.sms_alerts),
    theme: (row.theme as string) ?? "dark",
    dashboardLayout: (row.dashboard_layout as string) ?? null,
    dateTimeFormat: (row.date_time_format as string) ?? null,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
  };
}

export async function fetchClientSettings(personId: string): Promise<ClientSettings> {
  const { data, error } = await supabase.from("client_settings").select("*").eq("person_id", personId).maybeSingle();
  if (error) throw error;
  return data ? mapClientSettings(data) : defaultClientSettings;
}

export async function updateClientSettings(personId: string, patch: Partial<ClientSettings>): Promise<void> {
  const row: Record<string, unknown> = { person_id: personId };
  if (patch.emailNotifications !== undefined) row.email_notifications = patch.emailNotifications;
  if (patch.inAppAlerts !== undefined) row.in_app_alerts = patch.inAppAlerts;
  if (patch.smsAlerts !== undefined) row.sms_alerts = patch.smsAlerts;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.dashboardLayout !== undefined) row.dashboard_layout = patch.dashboardLayout;
  if (patch.dateTimeFormat !== undefined) row.date_time_format = patch.dateTimeFormat;
  if (patch.twoFactorEnabled !== undefined) row.two_factor_enabled = patch.twoFactorEnabled;
  const { error } = await supabase.from("client_settings").upsert(row, { onConflict: "person_id" });
  if (error) throw error;
}

// ==========================================
// Knowledge Base — no separate articles table; it's documents + meetings'
// ai_summary, browsable and (client-side) searchable in one place.
// ==========================================

export type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  dateLabel: string;
  sourceType: "document" | "meeting";
  content: string | null;
};

export async function fetchKnowledgeArticles(organizationId: string): Promise<KnowledgeArticle[]> {
  const project = await fetchPrimaryProject(organizationId);
  if (!project) return [];

  const [docsRes, meetingsRes] = await Promise.all([
    supabase.from("documents").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    supabase.from("meetings").select("*").eq("project_id", project.id).not("ai_summary", "is", null).order("meeting_date", { ascending: false }),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (meetingsRes.error) throw meetingsRes.error;

  const docArticles: KnowledgeArticle[] = (docsRes.data ?? []).map(row => ({
    id: row.id as string,
    title: row.name as string,
    category: (row.category as string).replace(/^\w/, c => c.toUpperCase()),
    dateLabel: formatDateLabel(row.created_at as string),
    sourceType: "document",
    content: null,
  }));

  const meetingArticles: KnowledgeArticle[] = (meetingsRes.data ?? []).map(row => ({
    id: row.id as string,
    title: row.title as string,
    category: "Meeting Notes",
    dateLabel: formatDateLabel(row.meeting_date as string),
    sourceType: "meeting",
    content: (row.ai_summary as string) ?? null,
  }));

  return [...docArticles, ...meetingArticles].sort((a, b) => new Date(b.dateLabel).getTime() - new Date(a.dateLabel).getTime());
}

// ==========================================
// Activity Feed — full activity_log across every one of the org's projects
// ==========================================

export type ActivityFeedEntry = ActivityEntry & { projectName: string };

export async function fetchActivityFeed(organizationId: string): Promise<ActivityFeedEntry[]> {
  const projects = await fetchOrganizationProjects(organizationId);
  if (projects.length === 0) return [];
  const projectNameById = new Map(projects.map(p => [p.id, p.name]));

  const { data, error } = await supabase
    .from("activity_log")
    .select("*, people(full_name)")
    .in("project_id", projects.map(p => p.id))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map(row => ({
    ...mapActivity(row),
    projectName: projectNameById.get(row.project_id as string) ?? "Project",
  }));
}

// ==========================================
// Sidebar badges — small counts shown next to nav items
// ==========================================

export type SidebarBadgeCounts = {
  approvals: number;
  actionItems: number;
  notifications: number;
};

export async function fetchSidebarBadges(organizationId: string, personId: string): Promise<SidebarBadgeCounts> {
  const empty: SidebarBadgeCounts = { approvals: 0, actionItems: 0, notifications: 0 };
  const project = await fetchPrimaryProject(organizationId);

  const notificationsRes = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", personId)
    .eq("read", false);
  if (notificationsRes.error) throw notificationsRes.error;

  if (!project) return { ...empty, notifications: notificationsRes.count ?? 0 };

  const [deliverablesRes, tasksRes] = await Promise.all([
    supabase.from("deliverables").select("id", { count: "exact", head: true }).eq("project_id", project.id).in("status", ["pending", "review"]),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", project.id).neq("status", "completed").in("type", ["approval", "review", "upload", "invoice"]),
  ]);
  if (deliverablesRes.error) throw deliverablesRes.error;
  if (tasksRes.error) throw tasksRes.error;

  return {
    approvals: deliverablesRes.count ?? 0,
    actionItems: tasksRes.count ?? 0,
    notifications: notificationsRes.count ?? 0,
  };
}

// ==========================================
// AI Project Manager — grounds the chat's canned templates in real numbers
// (no LLM backend is wired up for client-erp yet; see AIProjectManager.tsx)
// ==========================================

export type AiManagerContext = {
  project: Project | null;
  projectManagerName: string | null;
  aiSummary: AiExecutiveSummary | null;
  pendingDeliverablesCount: number;
  blockedTasksCount: number;
  openTicketsCount: number;
  changeRequests: ChangeRequest[];
  recentActivity: ActivityEntry[];
};

export async function fetchAiManagerContext(organizationId: string): Promise<AiManagerContext> {
  const empty: AiManagerContext = {
    project: null, projectManagerName: null, aiSummary: null,
    pendingDeliverablesCount: 0, blockedTasksCount: 0, openTicketsCount: 0,
    changeRequests: [], recentActivity: [],
  };
  const detail = await fetchProjectDetail(organizationId);
  if (!detail.project) return empty;

  const [deliverables, aiRes, blockedRes, support] = await Promise.all([
    fetchDeliverables(organizationId),
    supabase.from("ai_executive_summaries").select("*").eq("project_id", detail.project.id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", detail.project.id).eq("status", "blocked"),
    fetchSupportTickets(organizationId),
  ]);
  if (aiRes.error) throw aiRes.error;
  if (blockedRes.error) throw blockedRes.error;

  return {
    project: detail.project,
    projectManagerName: detail.projectManagerName,
    aiSummary: aiRes.data ? mapAiSummary(aiRes.data) : null,
    pendingDeliverablesCount: deliverables.filter(d => d.status === "pending" || d.status === "review").length,
    blockedTasksCount: blockedRes.count ?? 0,
    openTicketsCount: support.openCount,
    changeRequests: detail.changeRequests,
    recentActivity: detail.recentActivity,
  };
}
