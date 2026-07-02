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
  fetchTimesheetEntriesForReport,
  fetchProjectTasks,
  fetchTodayTasksForEmployee,
  fetchLeaveRequests,
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
import { CACHE_KEYS, invalidateDataCache, peekCached, subscribeDataCache } from "@/lib/dataCache";
import { supabase } from "@/lib/supabase";

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const DEFAULT_TTL = 30_000;

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

export function useProjectTasks() {
  const [data, setData] = useState<AppTask[]>(
    () => peekCached<AppTask[]>(CACHE_KEYS.projectTasks, DEFAULT_TTL) ?? []
  );
  const [loading, setLoading] = useState(() => !peekCached(CACHE_KEYS.projectTasks, DEFAULT_TTL));
  const [error, setError] = useState<string | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent && !peekCached(CACHE_KEYS.projectTasks, DEFAULT_TTL)) setLoading(true);
    setError(null);
    try {
      setData(await fetchProjectTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    invalidateDataCache(CACHE_KEYS.projectTasks);
    void load(true);
  }, [load]);

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      invalidateDataCache(CACHE_KEYS.projectTasks);
      void load(true);
    }, 250);
  }, [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    return subscribeDataCache(CACHE_KEYS.projectTasks, () => {
      const fresh = peekCached<AppTask[]>(CACHE_KEYS.projectTasks, DEFAULT_TTL);
      if (fresh) setData(fresh);
    });
  }, []);

  useEffect(() => {
    const room = supabase
      .channel("project-tasks-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects" },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_status_history" },
        scheduleRealtimeReload
      )
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      supabase.removeChannel(room);
    };
  }, [scheduleRealtimeReload]);

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
  const cacheKey = `${CACHE_KEYS.attendance}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}:${filter.employeeName ?? "all"}`;
  return useQuery(
    cacheKey,
    () => fetchAttendanceForReport(filter),
    [] as AttendanceEntry[],
    [filter.startDate, filter.endDate, filter.employeeId, filter.employeeName],
    20_000
  );
}

export function useTimesheetReport(filter: TimesheetReportFilter | null) {
  const cacheKey = filter
    ? `${CACHE_KEYS.timesheetReport}:${filter.startDate}:${filter.endDate}:${filter.employeeId ?? "all"}`
    : `${CACHE_KEYS.timesheetReport}:idle`;

  return useQuery(
    cacheKey,
    () => (filter ? fetchTimesheetEntriesForReport(filter) : Promise.resolve([] as TimesheetEntry[])),
    [] as TimesheetEntry[],
    filter ? [filter.startDate, filter.endDate, filter.employeeId] : [],
    DEFAULT_TTL,
    !filter
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
