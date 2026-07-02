/** Shared in-memory cache — dedupes concurrent fetches and avoids reload on every view switch. */

type CacheEntry<T = unknown> = {
  data?: T;
  fetchedAt: number;
  promise?: Promise<T>;
};

const store = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

export const CACHE_KEYS = {
  employeeProfiles: "employee_profiles",
  employees: "employees",
  projects: "projects",
  projectTasks: "project_tasks",
  todayTasks: "today_tasks",
  timesheets: "timesheets",
  attendance: "attendance",
  timesheetReport: "timesheet_report",
  leads: "leads",
  leadsAsClients: "leads_as_clients",
  leaveRequests: "leave_requests",
  chatUnread: "chat_unread",
} as const;

export function invalidateDataCache(key?: string) {
  if (key) {
    store.delete(key);
    notify(key);
    return;
  }
  const keys = [...store.keys()];
  store.clear();
  for (const k of keys) notify(k);
}

export function invalidateDataCachePrefix(prefix: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      notify(key);
    }
  }
}

export function peekCached<T>(key: string, ttlMs: number): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry?.data || Date.now() - entry.fetchedAt >= ttlMs) return undefined;
  return entry.data;
}

export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 30_000
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry?.data && now - entry.fetchedAt < ttlMs) {
    return entry.data;
  }
  if (entry?.promise) {
    return entry.promise;
  }

  const promise = loader()
    .then(data => {
      store.set(key, { data, fetchedAt: Date.now() });
      notify(key);
      return data;
    })
    .catch(err => {
      store.delete(key);
      throw err;
    });

  store.set(key, { ...(entry || {}), promise, fetchedAt: entry?.fetchedAt ?? 0 });
  return promise;
}

export function subscribeDataCache(key: string, listener: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
  };
}

function notify(key: string) {
  listeners.get(key)?.forEach(fn => fn());
}
