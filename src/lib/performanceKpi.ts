/**
 * Employee Performance / KPI module — pure metric computation.
 *
 * No DB access here. Every function takes data the caller already fetched
 * elsewhere (attendance report, leave requests, holiday calendar, project
 * tasks) and turns it into one of three independent meters: Attendance, Task
 * Completion, Shift Completed. There is deliberately no blended "overall
 * score" — confirmed with the user these stay separate.
 */
import type { AttendanceEntry, AppTask, LeaveRequest } from "./database";
import {
  buildPayrollForEmployee,
  daysInMonthOf,
  toDateKey,
  type HolidayCalendar,
  type PayrollDay,
} from "./payroll";

export type KpiSeverity = "good" | "watch" | "attention";

const GOOD_THRESHOLD = 85;
const WATCH_THRESHOLD = 70;

export function kpiSeverity(percent: number): KpiSeverity {
  if (percent >= GOOD_THRESHOLD) return "good";
  if (percent >= WATCH_THRESHOLD) return "watch";
  return "attention";
}

export const KPI_SEVERITY_COLORS: Record<KpiSeverity, { fill: string; track: string; text: string }> = {
  good: { fill: "#10b981", track: "rgba(16,185,129,0.15)", text: "text-emerald-400" },
  watch: { fill: "#f59e0b", track: "rgba(245,158,11,0.15)", text: "text-amber-400" },
  attention: { fill: "#f43f5e", track: "rgba(244,63,94,0.15)", text: "text-red-400" },
};

export type KpiMeter = {
  percent: number;
  severity: KpiSeverity;
};

export type AttendanceMeter = KpiMeter & {
  payableDays: number;
  daysInMonth: number;
  /** Day-by-day breakdown from the payroll engine — worked/weekend/holiday/leave/absent/etc, one per calendar day. */
  days: PayrollDay[];
};

/** Thin wrapper around the payroll engine — reuses its weekend/holiday/sandwich-leave rules. */
export function computeAttendanceMeter(input: {
  profile: { id: string; name: string; salary: string; joined: string };
  year: number;
  monthIndex: number;
  attendance: { employeeId: string | null; employee: string; date: string }[];
  leaveRequests: LeaveRequest[];
  holidays: HolidayCalendar;
  today?: string;
}): AttendanceMeter {
  const payroll = buildPayrollForEmployee(input);
  const daysInMonth = daysInMonthOf(input.year, input.monthIndex);
  const percent = daysInMonth > 0 ? (payroll.payableDays / daysInMonth) * 100 : 0;
  return {
    percent,
    severity: kpiSeverity(percent),
    payableDays: payroll.payableDays,
    daysInMonth,
    days: payroll.days,
  };
}

/** Which of the payroll engine's day kinds map to which visual bucket on the Attendance day-strip. */
export type AttendanceDayBucket = "worked" | "off" | "leave" | "attention" | "future";

export function attendanceDayBucket(kind: PayrollDay["kind"]): AttendanceDayBucket {
  switch (kind) {
    case "worked":
      return "worked";
    case "weekend":
    case "holiday":
      return "off";
    case "paid-leave":
      return "leave";
    case "unpaid-leave":
    case "absent":
      return "attention";
    case "upcoming":
    case "pre-joining":
    default:
      return "future";
  }
}

export const ATTENDANCE_BUCKET_COLORS: Record<AttendanceDayBucket, { fill: string; label: string }> = {
  worked: { fill: "#10b981", label: "Present" },
  off: { fill: "rgba(99,102,241,0.35)", label: "Weekend / Holiday" },
  leave: { fill: "#6366f1", label: "Paid Leave" },
  attention: { fill: "#f43f5e", label: "Absent / Unpaid Leave" },
  future: { fill: "rgba(148,163,184,0.18)", label: "Upcoming / N/A" },
};

export type TaskCompletionMeter = KpiMeter & {
  total: number;
  done: number;
  onTime: number;
};

/** Tasks due within the given month, for the given employee. */
export function computeTaskCompletionMeter(
  tasks: AppTask[],
  employeeId: string,
  { year, monthIndex }: { year: number; monthIndex: number },
): TaskCompletionMeter {
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const inMonth = tasks.filter(
    t => t.assigneeId === employeeId && t.dueIso && t.dueIso.slice(0, 7) === monthKey,
  );
  const done = inMonth.filter(t => t.status === "done");
  // `dueIso` is a plain "YYYY-MM-DD" date; `statusEnteredAt` is a full ISO
  // timestamp (or the literal sentinel "paused" when unavailable) — compare
  // date-only so a same-day completion isn't misread as late.
  const onTime = done.filter(t => {
    if (!t.statusEnteredAt || t.statusEnteredAt === "paused") return true;
    return t.statusEnteredAt.slice(0, 10) <= t.dueIso;
  });
  const total = inMonth.length;
  const percent = total > 0 ? (done.length / total) * 100 : 0;
  return { percent, severity: kpiSeverity(percent), total, done: done.length, onTime: onTime.length };
}

export type ShiftCompletionMeter = KpiMeter & {
  totalHours: number;
  totalDays: number;
  expectedHours: number;
};

/** Standard shift length used as the 100% target for every employee, regardless of their configured start time. */
const STANDARD_SHIFT_HOURS = 8;

/**
 * Total worked hours (summed across every clocked session, so a paused/
 * resumed day is counted correctly) vs. a flat 8-hours-per-worked-day target.
 * No shift-start time is involved — only how many hours were actually
 * logged. Days with no clock-in at all are excluded (that's an attendance
 * problem, not a shift-completion one).
 */
export function computeShiftCompletionMeter(
  attendance: AttendanceEntry[],
  employeeId: string,
): ShiftCompletionMeter {
  const hoursByDate = new Map<string, number>();

  for (const entry of attendance) {
    if (entry.employeeId !== employeeId) continue;
    hoursByDate.set(entry.date, (hoursByDate.get(entry.date) ?? 0) + (Number(entry.hours) || 0));
  }

  const totalDays = hoursByDate.size;
  const totalHours = [...hoursByDate.values()].reduce((sum, h) => sum + h, 0);
  const expectedHours = totalDays * STANDARD_SHIFT_HOURS;
  // Capped at 100 — overtime shouldn't inflate "shift completed" past a full shift.
  // The caption below still shows the real hours, so overtime is visible there.
  const percent = expectedHours > 0 ? Math.min(100, (totalHours / expectedHours) * 100) : 0;
  return { percent, severity: kpiSeverity(percent), totalHours, totalDays, expectedHours };
}

export type DailyPoint = { date: string; day: number; value: number };

/** Hours worked per calendar day of the given month (0 for a day with no session) — feeds the Shift Time trend graph. */
export function computeShiftHoursByDay(
  attendance: AttendanceEntry[],
  employeeId: string,
  { year, monthIndex }: { year: number; monthIndex: number },
): DailyPoint[] {
  const hoursByDate = new Map<string, number>();
  for (const entry of attendance) {
    if (entry.employeeId !== employeeId) continue;
    hoursByDate.set(entry.date, (hoursByDate.get(entry.date) ?? 0) + (Number(entry.hours) || 0));
  }
  const total = daysInMonthOf(year, monthIndex);
  return Array.from({ length: total }, (_, i) => {
    const date = toDateKey(new Date(year, monthIndex, i + 1));
    return { date, day: i + 1, value: Math.round((hoursByDate.get(date) ?? 0) * 100) / 100 };
  });
}

/** Tasks completed per calendar day of the given month (by completion timestamp) — feeds the Task Completion trend graph. */
export function computeTaskCompletionByDay(
  tasks: AppTask[],
  employeeId: string,
  { year, monthIndex }: { year: number; monthIndex: number },
): DailyPoint[] {
  const countByDate = new Map<string, number>();
  for (const task of tasks) {
    if (task.assigneeId !== employeeId || task.status !== "done") continue;
    if (!task.statusEnteredAt || task.statusEnteredAt === "paused") continue;
    const date = task.statusEnteredAt.slice(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }
  const total = daysInMonthOf(year, monthIndex);
  return Array.from({ length: total }, (_, i) => {
    const date = toDateKey(new Date(year, monthIndex, i + 1));
    return { date, day: i + 1, value: countByDate.get(date) ?? 0 };
  });
}
