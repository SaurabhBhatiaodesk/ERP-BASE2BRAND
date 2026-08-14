/**
 * Payroll rules engine — Base2Brand.
 *
 * Every rule is a `PayrollFactor` in the ordered `PAYROLL_FACTORS` list below.
 * Adding a new factor (sandwich leave, overtime, PF, tax slabs, incentives…)
 * means appending one entry to that array — no other file changes.
 *
 * Two kinds of factor:
 *   • `classify` — owns a single calendar day. The FIRST factor that returns a
 *     verdict wins that day; later factors never see it. Order matters.
 *   • `adjust`   — a whole-month money change applied after all days are
 *     classified (e.g. "-12% PF", "+₹5,000 bonus").
 *
 * Current policy (confirmed with HR):
 *   1. Saturday + Sunday are always paid and never deducted (5-day week).
 *   2. 3 paid leaves per CALENDAR QUARTER (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec).
 *      They may be burnt all in one month or spread across the quarter; the
 *      4th+ approved leave in a quarter is unpaid.
 *   3. A Mon–Fri day with no clock-in and no approved leave is "Absent" and is
 *      always cut — it never consumes the paid-leave quota.
 *   4. Net pay = (base salary / days in month) × payable days.
 */

/** Paid leaves granted per calendar quarter. Bump this to change the policy. */
export const PAID_LEAVE_QUOTA_PER_QUARTER = 3;

/**
 * Company-wide paid holidays as "YYYY-MM-DD". Empty for now — a weekday
 * holiday that nobody clocks in on will read as "Absent" until it is listed
 * here. Fill this in (or swap it for a DB-backed list) when HR supplies dates.
 */
export const PAYROLL_HOLIDAYS: readonly string[] = [];

/** 0 = Sunday, 6 = Saturday. Both are paid non-working days. */
const WEEKEND_WEEKDAYS = new Set([0, 6]);

// ─── Types ───────────────────────────────────────────────────────────────────

export type PayrollDayKind =
  | "worked"
  | "weekend"
  | "holiday"
  | "paid-leave"
  | "unpaid-leave"
  | "absent"
  | "upcoming"
  | "pre-joining";

export type PayrollDayVerdict = {
  kind: PayrollDayKind;
  /** Human label shown in the payslip breakdown. */
  label: string;
  /** Days of salary lost. 0 = fully paid, 0.5 = half day, 1 = full day. */
  deduct: number;
};

export type PayrollDay = PayrollDayVerdict & {
  date: string;
  factorId: string;
};

export type PayrollLeaveDay = {
  date: string;
  leaveType: string;
  /** 1 for a full day, 0.5 for a half day. */
  days: number;
};

export type PayrollContext = {
  /** "YYYY-MM" */
  month: string;
  year: number;
  /** 0–11 */
  monthIndex: number;
  daysInMonth: number;
  /** "YYYY-MM-DD" — days after this are "upcoming", not deducted. */
  today: string;
  baseSalary: number;
  /** Dates with at least one clock session. */
  workedDates: ReadonlySet<string>;
  /** Approved leave days falling inside this month. */
  leaveByDate: ReadonlyMap<string, PayrollLeaveDay>;
  /** Paid-leave allowance still unused when this month began. */
  quotaAtMonthStart: number;
  /** "YYYY-MM-DD" or null when unknown. */
  joinedOn: string | null;
};

/** Mutable scratchpad threaded through the day loop. */
export type PayrollState = { quotaLeft: number };

export type PayrollAdjustment = {
  factorId: string;
  label: string;
  /** Negative = deduction, positive = earning. */
  amount: number;
};

export type PayrollSubtotal = {
  perDayRate: number;
  payableDays: number;
  grossNetPay: number;
};

export type PayrollFactor = {
  id: string;
  label: string;
  description: string;
  classify?: (date: string, ctx: PayrollContext, state: PayrollState) => PayrollDayVerdict | null;
  adjust?: (subtotal: PayrollSubtotal, ctx: PayrollContext) => PayrollAdjustment | null;
};

export type PayrollResult = {
  employeeId: string;
  employeeName: string;
  month: string;
  /** null when HR has not set a salary yet. */
  baseSalary: number | null;
  daysInMonth: number;
  payableDays: number;
  deductionDays: number;
  perDayRate: number;
  grossNetPay: number;
  netPay: number;
  days: PayrollDay[];
  /** Only the days that cost money — this is the payslip breakdown list. */
  deductions: PayrollDay[];
  paidLeaveUsed: number;
  quotaAtMonthStart: number;
  quotaLeft: number;
  adjustments: PayrollAdjustment[];
};

// ─── Date helpers ────────────────────────────────────────────────────────────

export function daysInMonthOf(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-08" */
export function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** "August 2026" */
export function monthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** "03-08-2026" — matches the payslip mock. */
export function formatDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  return `${d}-${m}-${y}`;
}

export function monthDateKeys(year: number, monthIndex: number) {
  const total = daysInMonthOf(year, monthIndex);
  const keys: string[] = [];
  for (let day = 1; day <= total; day++) keys.push(toDateKey(new Date(year, monthIndex, day)));
  return keys;
}

/** First month index of the calendar quarter containing `monthIndex`. */
export function quarterStartMonthIndex(monthIndex: number) {
  return Math.floor(monthIndex / 3) * 3;
}

export function isWeekend(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKEND_WEEKDAYS.has(new Date(y, m - 1, d).getDay());
}

export function isHoliday(dateKey: string) {
  return PAYROLL_HOLIDAYS.includes(dateKey);
}

/** Mon–Fri and not a listed holiday — the only days that can ever be cut. */
export function isWorkingDay(dateKey: string) {
  return !isWeekend(dateKey) && !isHoliday(dateKey);
}

// ─── Money helpers ───────────────────────────────────────────────────────────

/**
 * Reads whatever `employee_profiles.salary` happens to hold. Legacy rows use
 * several shapes: "₹85,000", "₹75.0K" and "₹1.3L" (written by
 * `formatCurrency`), or a bare number. Returns null when no salary is set —
 * "₹0", "—" and "" all mean "HR has not entered one yet".
 */
export function parseSalaryAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw > 0 ? raw : null;

  const cleaned = raw.replace(/[₹,\s]/g, "");
  const match = /^(-?\d*\.?\d+)([KkLl])?$/.exec(cleaned);
  if (!match) return null;

  let value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  if (match[2]) value *= match[2].toLowerCase() === "k" ? 1_000 : 100_000;

  return value > 0 ? value : null;
}

/**
 * Written back to `employee_profiles.salary`. Deliberately NOT `formatCurrency`
 * — that compresses 75000 to "₹75.0K" and would round payroll figures.
 */
export function formatSalaryForStorage(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatMoney(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Trims the trailing ".0" so 13.5 stays "13.5" but 13.0 reads "13". */
export function formatDays(days: number) {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

// ─── Factors ─────────────────────────────────────────────────────────────────

/**
 * Ordered. The first `classify` that returns non-null owns the day.
 * Append new factors here — put a factor ABOVE the ones it should override.
 */
export const PAYROLL_FACTORS: PayrollFactor[] = [
  {
    id: "pre-joining",
    label: "Before joining",
    description: "Days before the employee's joining date are not payable.",
    classify: (date, ctx) =>
      ctx.joinedOn && date < ctx.joinedOn
        ? { kind: "pre-joining", label: "Before joining", deduct: 1 }
        : null,
  },
  {
    id: "weekend",
    label: "Weekend",
    description: "Saturday and Sunday are always paid and never deducted.",
    classify: date =>
      isWeekend(date) ? { kind: "weekend", label: "Weekend (paid)", deduct: 0 } : null,
  },
  {
    id: "holiday",
    label: "Public holiday",
    description: "Listed company holidays are paid non-working days.",
    classify: date =>
      isHoliday(date) ? { kind: "holiday", label: "Public holiday (paid)", deduct: 0 } : null,
  },
  {
    id: "upcoming",
    label: "Not yet due",
    description: "Days later than today are not judged — the month is still running.",
    classify: (date, ctx) =>
      date > ctx.today ? { kind: "upcoming", label: "Not yet due", deduct: 0 } : null,
  },
  {
    id: "worked",
    label: "Present",
    description: "A clock-in exists for this day.",
    classify: (date, ctx) =>
      ctx.workedDates.has(date) ? { kind: "worked", label: "Present", deduct: 0 } : null,
  },
  {
    id: "leave-quota",
    label: "Paid leave quota",
    description: `${PAID_LEAVE_QUOTA_PER_QUARTER} paid leaves per calendar quarter, then unpaid.`,
    classify: (date, ctx, state) => {
      const leave = ctx.leaveByDate.get(date);
      if (!leave) return null;

      const needed = leave.days;
      const covered = Math.min(state.quotaLeft, needed);
      state.quotaLeft = Math.max(0, state.quotaLeft - covered);
      const uncovered = Math.max(0, needed - covered);

      if (uncovered <= 0) {
        return { kind: "paid-leave", label: `Paid Leave — ${leave.leaveType}`, deduct: 0 };
      }
      return {
        kind: "unpaid-leave",
        label: `Unpaid Leave — ${leave.leaveType} (quarter quota used)`,
        deduct: uncovered,
      };
    },
  },
  {
    id: "absent",
    label: "Absent",
    description: "Working day with no clock-in and no approved leave.",
    classify: () => ({ kind: "absent", label: "Absent", deduct: 1 }),
  },
];

// ─── Engine ──────────────────────────────────────────────────────────────────

export function computeMonthlyPayroll(
  ctx: PayrollContext,
  identity: { employeeId: string; employeeName: string },
  factors: PayrollFactor[] = PAYROLL_FACTORS,
): PayrollResult {
  const state: PayrollState = { quotaLeft: ctx.quotaAtMonthStart };
  const days: PayrollDay[] = [];

  for (const date of monthDateKeys(ctx.year, ctx.monthIndex)) {
    let verdict: PayrollDay | null = null;
    for (const factor of factors) {
      const result = factor.classify?.(date, ctx, state);
      if (result) {
        verdict = { ...result, date, factorId: factor.id };
        break;
      }
    }
    // Unreachable while the `absent` catch-all is last, but keeps the loop
    // total if someone reorders the factor list.
    days.push(verdict ?? { date, kind: "worked", label: "Present", deduct: 0, factorId: "none" });
  }

  const deductionDays = days.reduce((sum, d) => sum + d.deduct, 0);
  const payableDays = Math.max(0, ctx.daysInMonth - deductionDays);
  const perDayRate = ctx.daysInMonth > 0 ? ctx.baseSalary / ctx.daysInMonth : 0;
  const grossNetPay = perDayRate * payableDays;

  const subtotal: PayrollSubtotal = { perDayRate, payableDays, grossNetPay };
  const adjustments = factors
    .map(f => f.adjust?.(subtotal, ctx) ?? null)
    .filter((a): a is PayrollAdjustment => a !== null);

  const netPay = adjustments.reduce((sum, a) => sum + a.amount, grossNetPay);

  return {
    employeeId: identity.employeeId,
    employeeName: identity.employeeName,
    month: ctx.month,
    baseSalary: ctx.baseSalary,
    daysInMonth: ctx.daysInMonth,
    payableDays,
    deductionDays,
    perDayRate,
    grossNetPay,
    netPay: Math.max(0, netPay),
    days,
    deductions: days.filter(d => d.deduct > 0),
    paidLeaveUsed: Math.max(0, ctx.quotaAtMonthStart - state.quotaLeft),
    quotaAtMonthStart: ctx.quotaAtMonthStart,
    quotaLeft: state.quotaLeft,
    adjustments,
  };
}

// ─── Building a context from app data ────────────────────────────────────────

/** Structural shapes — kept local so this module stays free of DB imports. */
export type PayrollLeaveInput = {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export type PayrollAttendanceInput = {
  employeeId: string | null;
  employee: string;
  date: string;
};

export type PayrollProfileInput = {
  id: string;
  name: string;
  salary: string;
  joined: string;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function inclusiveDateKeys(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate || startDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];

  const keys: string[] = [];
  const cursor = new Date(start);
  // Guard against a corrupt range spanning years.
  for (let i = 0; i < 400 && cursor <= end; i++) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Explodes an approved leave request into the working days it covers.
 * A single-date request logged as 0.5 days becomes a half day; everything else
 * is one full day per working day in the range.
 */
export function expandLeaveDays(request: PayrollLeaveInput): PayrollLeaveDay[] {
  const workingDays = inclusiveDateKeys(request.startDate, request.endDate).filter(isWorkingDay);
  if (workingDays.length === 0) return [];

  const isHalfDay = workingDays.length === 1 && request.days > 0 && request.days < 1;
  return workingDays.map(date => ({
    date,
    leaveType: request.leaveType || "Leave",
    days: isHalfDay ? request.days : 1,
  }));
}

/**
 * `employee_profiles.joined` is a display string ("Aug 2026"), so this is
 * month-precision at best. Returns null when it cannot be parsed.
 */
export function parseJoinedDate(joined: string): string | null {
  if (!joined?.trim()) return null;
  const parsed = new Date(joined.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

/**
 * Assembles the context for one employee/month and runs the engine.
 *
 * `leaveRequests` must be the employee's FULL history (not just this month) —
 * the quarterly quota carry-in is derived from the earlier months of the same
 * quarter.
 */
export function buildPayrollForEmployee(input: {
  profile: PayrollProfileInput;
  year: number;
  monthIndex: number;
  attendance: PayrollAttendanceInput[];
  leaveRequests: PayrollLeaveInput[];
  today?: string;
}): PayrollResult {
  const { profile, year, monthIndex } = input;
  const today = input.today ?? toDateKey(new Date());
  const month = monthKey(year, monthIndex);
  const monthPrefix = `${month}-`;

  const idMatch = profile.id;
  const nameMatch = normalizeName(profile.name);
  const belongsToEmployee = (employeeId: string | null | undefined, employeeName: string) =>
    (employeeId && employeeId === idMatch) ||
    (!employeeId && normalizeName(employeeName) === nameMatch) ||
    normalizeName(employeeName) === nameMatch;

  const workedDates = new Set<string>();
  for (const entry of input.attendance) {
    if (!entry.date.startsWith(monthPrefix)) continue;
    if (belongsToEmployee(entry.employeeId, entry.employee)) workedDates.add(entry.date);
  }

  const approved = input.leaveRequests.filter(
    r => r.status === "Approved" && belongsToEmployee(r.employeeId, r.employeeName),
  );

  const leaveByDate = new Map<string, PayrollLeaveDay>();
  const quarterStart = monthKey(year, quarterStartMonthIndex(monthIndex));
  let quotaUsedBeforeMonth = 0;

  for (const request of approved) {
    for (const day of expandLeaveDays(request)) {
      const dayMonth = day.date.slice(0, 7);
      if (dayMonth === month) {
        // A day already claimed by an earlier request keeps the larger claim.
        const existing = leaveByDate.get(day.date);
        if (!existing || day.days > existing.days) leaveByDate.set(day.date, day);
      } else if (dayMonth >= quarterStart && dayMonth < month) {
        quotaUsedBeforeMonth += day.days;
      }
    }
  }

  const quotaAtMonthStart = Math.max(0, PAID_LEAVE_QUOTA_PER_QUARTER - quotaUsedBeforeMonth);

  const ctx: PayrollContext = {
    month,
    year,
    monthIndex,
    daysInMonth: daysInMonthOf(year, monthIndex),
    today,
    baseSalary: parseSalaryAmount(profile.salary) ?? 0,
    workedDates,
    leaveByDate,
    quotaAtMonthStart,
    joinedOn: parseJoinedDate(profile.joined),
  };

  const result = computeMonthlyPayroll(ctx, {
    employeeId: profile.id,
    employeeName: profile.name,
  });

  return { ...result, baseSalary: parseSalaryAmount(profile.salary) };
}
