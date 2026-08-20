import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  fetchEmployees,
  fetchLeads,
  fetchLeadsAsClients,
  fetchProjects,
  fetchEmployeeProfiles,
  fetchTimesheetEntries,
  fetchAttendanceEntries,
  fetchAttendanceForReport,
  fetchAttendanceReportPage,
  fetchAttendanceReportSummaryHours,
  fetchTimesheetEntriesForReport,
  fetchTimesheetReportPage,
  fetchReportTeamSummaries,
  REPORT_PAGE_SIZE,
  type AttendanceReportPage,
  type TimesheetReportPage,
  type ReportPagination,
  type EmployeeHoursSummary,
  fetchProjectTasks,
  fetchProjectTasksForAssignee,
  projectTasksCacheKey,
  warmProjectTasksStageHistory,
  fetchTodayTasksForEmployee,
  fetchLeaveRequests,
  fetchPublicHolidays,
  type PublicHoliday,
  type Employee,
  type Lead,
  type ClientProfile,
  type Project,
  type EmployeeProfile,
  type AppTask,
  type TimesheetEntry,
  type AttendanceEntry,
  type LeaveRequest,
  type AttendanceReportFilter,
  type TimesheetReportFilter,
  fetchATSVacancies,
  fetchATSInterviews,
  type ATSVacancy,
  type ATSInterview,
} from "@/lib/database";
import { CACHE_KEYS, invalidateDataCache, invalidateDataCachePrefix, peekCached, subscribeDataCache } from "@/lib/dataCache";
import { supabase } from "@/lib/supabase";

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const DEFAULT_TTL = 30_000;
const PROJECT_TASKS_TTL = 60_000;

function useQuery<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  fallback: T,
  deps: unknown[] = [],
  ttl = DEFAULT_TTL,
  disabled = false
): LoadState<T> {
  const [data, setData] = useState<T>(() => peekCached<T>(cacheKey, ttl) ?? fallback);
  const [loading, setLoading] = useState(() => !disabled && !peekCached<T>(cacheKey, ttl));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    invalidateDataCache(cacheKey);
    setTick(t => t + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = peekCached<T>(cacheKey, ttl);
    if (!cached) setLoading(true);
    setError(null);

    loader()
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || "Failed to load data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, disabled, tick, ttl, ...deps]);

  useEffect(() => {
    return subscribeDataCache(cacheKey, () => {
      const fresh = peekCached<T>(cacheKey, ttl);
      if (fresh !== undefined) setData(fresh);
    });
  }, [cacheKey, ttl]);

  return { data, loading, error, refresh };
}

export function useEmployees() {
  return useQuery(CACHE_KEYS.employees, fetchEmployees, [] as Employee[], [], 60_000);
}

export function useLeads() {
  return useQuery(CACHE_KEYS.leads, fetchLeads, [] as Lead[]);
}

/**
 * HR's paid-holiday calendar. The `[]` fallback here is only what renders
 * while `loading` is true or `error` is set — payroll must check both before
 * trusting it, since an empty calendar bills every holiday as an absence.
 */
export function usePublicHolidays() {
  return useQuery(
    CACHE_KEYS.publicHolidays,
    fetchPublicHolidays,
    [] as PublicHoliday[],
    [],
    10 * 60_000,
  );
}

export function useATSVacancies() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel("ats_vacancies_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ats_vacancies" }, () =>
        setTick(t => t + 1)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return useQuery("ats_vacancies", fetchATSVacancies, [] as ATSVacancy[], [tick]);
}

export function useATSInterviews() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel("ats_interviews_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ats_interviews" }, () =>
        setTick(t => t + 1)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return useQuery("ats_interviews", fetchATSInterviews, [] as ATSInterview[], [tick]);
}

export function useLeadsAsClients() {
  return useQuery(CACHE_KEYS.leadsAsClients, fetchLeadsAsClients, [] as ClientProfile[]);
}

export function useProjects() {
  return useQuery(CACHE_KEYS.projects, fetchProjects, [] as Project[]);
}

export function useEmployeeProfiles() {
  const instanceId = useId();
  const result = useQuery(
    CACHE_KEYS.employeeProfiles,
    fetchEmployeeProfiles,
    [] as EmployeeProfile[],
    [],
    60_000
  );

  useEffect(() => {
    const room = supabase
      .channel(`employee-profiles-live:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_profiles" },
        () => {
          invalidateDataCache(CACHE_KEYS.employeeProfiles);
          invalidateDataCache(CACHE_KEYS.employees);
          result.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(room);
    };
  }, [instanceId, result.refresh]);

  return result;
}

type ProjectTasksRealtimeListener = () => void;

let projectTasksChannel: ReturnType<typeof supabase.channel> | null = null;
let projectTasksHandlersRegistered = false;
let projectTasksRealtimeRefCount = 0;
let projectTasksBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
const projectTasksRealtimeListeners = new Set<ProjectTasksRealtimeListener>();

function broadcastProjectTasksRealtimeChange() {
  if (projectTasksBroadcastTimer) clearTimeout(projectTasksBroadcastTimer);
  projectTasksBroadcastTimer = setTimeout(() => {
    projectTasksBroadcastTimer = null;
    invalidateDataCache(CACHE_KEYS.projectTasks);
    invalidateDataCachePrefix(`${CACHE_KEYS.projectTasks}:assignee:`);
    for (const listener of projectTasksRealtimeListeners) {
      listener();
    }
  }, 250);
}

function removeStaleProjectTasksChannels() {
  for (const channel of supabase.getChannels()) {
    const topic = (channel as { topic?: string }).topic ?? "";
    if (topic.includes("project-tasks-live")) {
      void supabase.removeChannel(channel);
    }
  }
  projectTasksChannel = null;
  projectTasksHandlersRegistered = false;
}

function ensureProjectTasksChannel() {
  if (projectTasksChannel && projectTasksHandlersRegistered) return;

  removeStaleProjectTasksChannels();

  projectTasksChannel = supabase
    .channel("project-tasks-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "project_tasks" },
      broadcastProjectTasksRealtimeChange
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "projects" },
      broadcastProjectTasksRealtimeChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_status_history" },
      broadcastProjectTasksRealtimeChange
    )
    .subscribe();
  projectTasksHandlersRegistered = true;
}

function subscribeProjectTasksRealtime(listener: ProjectTasksRealtimeListener) {
  projectTasksRealtimeListeners.add(listener);
  projectTasksRealtimeRefCount += 1;

  ensureProjectTasksChannel();

  return () => {
    projectTasksRealtimeListeners.delete(listener);
    projectTasksRealtimeRefCount -= 1;
    if (projectTasksRealtimeRefCount <= 0) {
      if (projectTasksBroadcastTimer) {
        clearTimeout(projectTasksBroadcastTimer);
        projectTasksBroadcastTimer = null;
      }
      if (projectTasksChannel) {
        void supabase.removeChannel(projectTasksChannel);
        projectTasksChannel = null;
      }
      projectTasksHandlersRegistered = false;
      projectTasksRealtimeRefCount = 0;
    }
  };
}

export function useProjectTasks(options?: { assigneeId?: string; disabled?: boolean }) {
  const assigneeId = options?.assigneeId?.trim() || "";
  const disabled = Boolean(options?.disabled);
  const cacheKey = projectTasksCacheKey(assigneeId || undefined);
  const fetchTasks = useCallback(() => {
    return assigneeId ? fetchProjectTasksForAssignee(assigneeId) : fetchProjectTasks();
  }, [assigneeId]);

  const [data, setData] = useState<AppTask[]>(
    () => peekCached<AppTask[]>(cacheKey, PROJECT_TASKS_TTL) ?? []
  );
  const [loading, setLoading] = useState(
    () => !disabled && !peekCached<AppTask[]>(cacheKey, PROJECT_TASKS_TTL)
  );
  const [error, setError] = useState<string | null>(null);
  const enrichKeyRef = useRef("");

  const load = useCallback(async (silent = false) => {
    if (disabled) {
      setLoading(false);
      return;
    }
    const cached = peekCached<AppTask[]>(cacheKey, PROJECT_TASKS_TTL);
    if (!silent && !cached) setLoading(true);
    else if (cached?.length) setLoading(false);
    setError(null);
    try {
      const tasks = await fetchTasks();
      setData(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, disabled, fetchTasks]);

  const refresh = useCallback(() => {
    invalidateDataCache(cacheKey);
    enrichKeyRef.current = "";
    void load(true);
  }, [cacheKey, load]);

  const onRealtimeChange = useCallback(() => {
    enrichKeyRef.current = "";
    void load(true);
  }, [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    return subscribeDataCache(cacheKey, () => {
      const fresh = peekCached<AppTask[]>(cacheKey, PROJECT_TASKS_TTL);
      if (fresh) setData(fresh);
    });
  }, [cacheKey]);

  useEffect(() => {
    return subscribeProjectTasksRealtime(onRealtimeChange);
  }, [onRealtimeChange]);

  useEffect(() => {
    if (loading || data.length === 0) return;
    const key = data.map(t => t.taskId).join("|");
    if (!key || key === enrichKeyRef.current) return;
    enrichKeyRef.current = key;

    let cancelled = false;
    void warmProjectTasksStageHistory(cacheKey, data)
      .then(enriched => {
        if (!cancelled) setData(enriched);
      })
      .catch(() => {
        enrichKeyRef.current = "";
      });

    return () => {
      cancelled = true;
    };
  }, [loading, data, cacheKey]);

  return { data, loading, error, refresh };
}

export function useTodayTasks(employeeId: string, employeeName = "") {
  const cacheKey = `${CACHE_KEYS.todayTasks}:${employeeId}:${employeeName}`;
  return useQuery(
    cacheKey,
    () =>
      employeeId || employeeName
        ? fetchTodayTasksForEmployee({ employeeId, employeeName })
        : Promise.resolve([] as AppTask[]),
    [] as AppTask[],
    [employeeId, employeeName],
    15_000
  );
}

export function useTimesheets() {
  return useQuery(CACHE_KEYS.timesheets, fetchTimesheetEntries, [] as TimesheetEntry[]);
}

export function useAttendance() {
  return useQuery(CACHE_KEYS.attendance, fetchAttendanceEntries, [] as AttendanceEntry[], [], 20_000);
}

export function useAttendanceReport(filter: AttendanceReportFilter) {
  const cacheKey = `${CACHE_KEYS.attendance}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.employeeName ?? "all"}:${filter.search ?? ""}`;
  return useQuery(
    cacheKey,
    () => fetchAttendanceForReport(filter),
    [] as AttendanceEntry[],
    [filter.startDate, filter.endDate, filter.employeeId, filter.employeeName, filter.search],
    20_000
  );
}

const EMPTY_ATTENDANCE_PAGE: AttendanceReportPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: REPORT_PAGE_SIZE,
  totalPages: 1,
  summaryHours: 0,
};

export function useAttendanceReportPage(
  filter: AttendanceReportFilter | null,
  pagination: ReportPagination,
  disabled = false,
) {
  const cacheKey = filter
    ? `${CACHE_KEYS.attendance}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.search ?? ""}:p${pagination.page}:s${pagination.pageSize}`
    : `${CACHE_KEYS.attendance}:idle`;

  return useQuery(
    cacheKey,
    () => (filter ? fetchAttendanceReportPage(filter, pagination) : Promise.resolve(EMPTY_ATTENDANCE_PAGE)),
    EMPTY_ATTENDANCE_PAGE,
    filter
      ? [filter.startDate, filter.endDate, filter.employeeId, filter.search, pagination.page, pagination.pageSize]
      : [],
    20_000,
    disabled || !filter,
  );
}

/**
 * Total hours across the whole filtered range. Fetched independently of the
 * page above (that full-range sum is the expensive part) so it never blocks
 * the table from rendering — it fills in the badge once ready.
 */
export function useAttendanceReportSummaryHours(
  filter: AttendanceReportFilter | null,
  disabled = false,
) {
  const cacheKey = filter
    ? `${CACHE_KEYS.attendance}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.search ?? ""}:summaryHours`
    : `${CACHE_KEYS.attendance}:summaryHours:idle`;

  return useQuery(
    cacheKey,
    () => (filter ? fetchAttendanceReportSummaryHours(filter) : Promise.resolve(0)),
    0,
    filter ? [filter.startDate, filter.endDate, filter.employeeId, filter.search] : [],
    20_000,
    disabled || !filter,
  );
}

const EMPTY_TIMESHEET_PAGE: TimesheetReportPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: REPORT_PAGE_SIZE,
  totalPages: 1,
  summaryHours: 0,
};

export function useTimesheetReportPage(
  filter: TimesheetReportFilter | null,
  pagination: ReportPagination,
  disabled = false,
) {
  const cacheKey = filter
    ? `${CACHE_KEYS.timesheetReport}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.projectId ?? "all"}:${filter.search ?? ""}:p${pagination.page}:s${pagination.pageSize}`
    : `${CACHE_KEYS.timesheetReport}:idle`;

  return useQuery(
    cacheKey,
    () => (filter ? fetchTimesheetReportPage(filter, pagination) : Promise.resolve(EMPTY_TIMESHEET_PAGE)),
    EMPTY_TIMESHEET_PAGE,
    filter
      ? [filter.startDate, filter.endDate, filter.employeeId, filter.projectId, filter.search, pagination.page, pagination.pageSize]
      : [],
    DEFAULT_TTL,
    disabled || !filter,
  );
}

export function useReportTeamSummaries(
  attendanceFilter: AttendanceReportFilter | null,
  timesheetFilter: TimesheetReportFilter | null,
  disabled = false,
) {
  const cacheKey =
    attendanceFilter && timesheetFilter
      ? `${CACHE_KEYS.attendance}:${attendanceFilter.startDate}:team:${timesheetFilter.startDate}:${attendanceFilter.employeeId ?? "all"}`
      : `${CACHE_KEYS.attendance}:team:idle`;

  return useQuery(
    cacheKey,
    () =>
      attendanceFilter && timesheetFilter
        ? fetchReportTeamSummaries(attendanceFilter, timesheetFilter)
        : Promise.resolve([] as EmployeeHoursSummary[]),
    [] as EmployeeHoursSummary[],
    attendanceFilter && timesheetFilter
      ? [
          attendanceFilter.startDate,
          attendanceFilter.endDate,
          attendanceFilter.employeeId,
          attendanceFilter.search,
          timesheetFilter.startDate,
          timesheetFilter.endDate,
          timesheetFilter.employeeId,
          timesheetFilter.search,
        ]
      : [],
    20_000,
    disabled || !attendanceFilter || !timesheetFilter,
  );
}

export function useTimesheetReport(filter: TimesheetReportFilter | null, disabled = false) {
  const cacheKey = filter
    ? `${CACHE_KEYS.timesheetReport}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.employeeName ?? "all"}:${filter.projectId ?? "all"}:${filter.search ?? ""}:full`
    : `${CACHE_KEYS.timesheetReport}:idle`;

  return useQuery(
    cacheKey,
    () => (filter ? fetchTimesheetEntriesForReport(filter) : Promise.resolve([] as TimesheetEntry[])),
    [] as TimesheetEntry[],
    filter
      ? [
          filter.startDate,
          filter.endDate,
          filter.employeeId,
          filter.employeeName,
          filter.projectId,
          filter.search,
        ]
      : [],
    DEFAULT_TTL,
    disabled || !filter
  );
}

export function useLeaveRequests() {
  const [data, setData] = useState<LeaveRequest[]>(
    () => peekCached<LeaveRequest[]>(CACHE_KEYS.leaveRequests, DEFAULT_TTL) ?? []
  );
  const [loading, setLoading] = useState(() => !peekCached(CACHE_KEYS.leaveRequests, DEFAULT_TTL));
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent && !peekCached(CACHE_KEYS.leaveRequests, DEFAULT_TTL)) setLoading(true);
    try {
      setData(await fetchLeaveRequests());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("public:leave_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        invalidateDataCache(CACHE_KEYS.leaveRequests);
        void loadData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    return subscribeDataCache(CACHE_KEYS.leaveRequests, () => {
      const fresh = peekCached<LeaveRequest[]>(CACHE_KEYS.leaveRequests, DEFAULT_TTL);
      if (fresh) setData(fresh);
    });
  }, []);

  return {
    data,
    loading,
    error,
    refresh: () => {
      invalidateDataCache(CACHE_KEYS.leaveRequests);
      void loadData(true);
    },
  };
}
