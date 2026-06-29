import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  fetchEmployees,
  fetchLeads,
  fetchLeadsAsClients,
  fetchProjects,
  fetchEmployeeProfiles,
  fetchTimesheetEntries,
  fetchAttendanceEntries,
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
  fetchATSVacancies,
  fetchATSInterviews,
  type ATSVacancy,
  type ATSInterview,
} from "@/lib/database";
import { supabase } from "@/lib/supabase";

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

function useQuery<T>(loader: () => Promise<T>, fallback: T, deps: unknown[] = []): LoadState<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refresh };
}

export function useEmployees() {
  return useQuery(fetchEmployees, [] as Employee[]);
}

export function useLeads() {
  return useQuery(fetchLeads, [] as Lead[]);
}

export function useATSVacancies() {
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const channel = supabase.channel("ats_vacancies_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ats_vacancies" }, () => setTick(t => t + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return useQuery(fetchATSVacancies, [] as ATSVacancy[], [tick]);
}

export function useATSInterviews() {
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const channel = supabase.channel("ats_interviews_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ats_interviews" }, () => setTick(t => t + 1))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return useQuery(fetchATSInterviews, [] as ATSInterview[], [tick]);
}

export function useLeadsAsClients() {
  return useQuery(fetchLeadsAsClients, [] as ClientProfile[]);
}

export function useProjects() {
  return useQuery(fetchProjects, [] as Project[]);
}

export function useEmployeeProfiles() {
  const instanceId = useId();
  const result = useQuery(fetchEmployeeProfiles, [] as EmployeeProfile[]);

  useEffect(() => {
    const room = supabase
      .channel(`employee-profiles-live:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_profiles" },
        () => result.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(room);
    };
  }, [instanceId, result.refresh]);

  return result;
}

export function useProjectTasks() {
  const [data, setData] = useState<AppTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await fetchProjectTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      void load(true);
    }, 250);
  }, [load]);

  useEffect(() => {
    load(false);
  }, [load]);

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
  return useQuery(
    () =>
      employeeId || employeeName
        ? fetchTodayTasksForEmployee({ employeeId, employeeName })
        : Promise.resolve([] as AppTask[]),
    [] as AppTask[],
    [employeeId, employeeName]
  );
}

export function useTimesheets() {
  return useQuery(fetchTimesheetEntries, [] as TimesheetEntry[]);
}

export function useAttendance() {
  return useQuery(fetchAttendanceEntries, [] as AttendanceEntry[]);
}

export function useLeaveRequests() {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const leaves = await fetchLeaveRequests();
      setData(leaves);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Subscribe to realtime updates for leave_requests
    const channel = supabase.channel("public:leave_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  return { data, loading, error, refresh: loadData };
}
