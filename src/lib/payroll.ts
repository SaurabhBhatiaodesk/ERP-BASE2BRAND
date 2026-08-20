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
 *   4. Listed public holidays are paid non-working days (`PAYROLL_HOLIDAYS`).
 *   5. SANDWICH LEAVE — a weekend/holiday gap with leave or absence on BOTH
 *      sides is itself counted as leave. Off on Friday and the following
 *      Monday? That Saturday and Sunday are billed too.
 *   6. Net pay = (base salary / days in month) × payable days.
 */

/** Paid leaves granted per calendar quarter. Bump this to change the policy. */
export const PAID_LEAVE_QUOTA_PER_QUARTER = 3;

/**
 * Company-wide paid holidays, "YYYY-MM-DD" → name.
 *
 * HR owns this list in the `public_holidays` table (see
 * `supabase/public_holidays.sql`) — there is deliberately no hardcoded copy,
 * because a stale fallback would quietly pay the wrong salary. A weekday that
 * is NOT in the calendar reads as "Absent" for everyone who did not clock in,
 * so callers must treat a failed load as an error, never as an empty calendar.
 */
export type HolidayCalendar = ReadonlyMap<string, string>;

/** For months genuinely outside any holiday, and for tests. */
export const EMPTY_HOLIDAY_CALENDAR: HolidayCalendar = new Map();

export function buildHolidayCalendar(
  rows: Iterable<{ date: string; name: string }>,
): HolidayCalendar {
  return new Map([...rows].map(row => [row.date, row.name]));
}

/**
 * Longest run of non-working days a sandwich will swallow. 2 covers the plain
 * Fri→Mon weekend; 3 also covers a weekend with a public holiday stuck to it
 * (leave Fri 6 Nov, off Sat 7 + Diwali Sun 8/Mon 9, leave Tue 10). Anything
 * longer is a genuine company shutdown, not a stretched weekend.
 */
export const SANDWICH_MAX_BRIDGE_DAYS = 3;

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
  /**
   * Dates with at least one clock session. Covers a few days either side of
   * the month as well, so a sandwich straddling the month boundary is visible.
   */
  workedDates: ReadonlySet<string>;
  /** Approved leave days falling inside this month. */
  leaveByDate: ReadonlyMap<string, PayrollLeaveDay>;
  /**
   * Working days — inside the month AND a few days either side of it — that
   * the employee was off: approved leave or unexplained absence. These are the
   * days that can flank a weekend and turn it into a sandwich.
   */
  sandwichAnchorDates: ReadonlySet<string>;
  /** HR's paid-holiday calendar, loaded from `public_holidays`. */
  holidays: HolidayCalendar;
  /** Paid-leave allowance still unused when this month began. */
  quotaAtMonthStart: number;
  /** "YYYY-MM-DD" or null when unknown. */
  joinedOn: string | null;
};

/** Mutable scratchpad threaded through the day loop. */
export type PayrollState = {
  quotaLeft: number;
  /** Weekend/holiday days this month that a sandwich has claimed. */
  sandwichDates: ReadonlySet<string>;
};

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

/** "Republic Day", or null when the date is an ordinary one. */
export function holidayName(dateKey: string, holidays: HolidayCalendar): string | null {
  return holidays.get(dateKey) ?? null;
}

export function isHoliday(dateKey: string, holidays: HolidayCalendar) {
  return holidays.has(dateKey);
}

/** Mon–Fri and not a listed holiday — the only days that can ever be cut. */
export function isWorkingDay(dateKey: string, holidays: HolidayCalendar) {
  return !isWeekend(dateKey) && !isHoliday(dateKey, holidays);
}

/** "2026-08-17" + 3 → "2026-08-20". Negative deltas walk backwards. */
export function shiftDateKey(dateKey: string, deltaDays: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + deltaDays));
}

/** A day a sandwich can swallow: a weekend or a paid public holiday. */
function isBridgeableDay(dateKey: string, holidays: HolidayCalendar) {
  return isWeekend(dateKey) || isHoliday(dateKey, holidays);
}

/**
 * How far outside the month we have to look to spot a sandwich that straddles
 * the boundary — e.g. leave on Fri 31 Jul + Mon 3 Aug bills 1–2 Aug.
 */
export const SANDWICH_WINDOW_PAD_DAYS = SANDWICH_MAX_BRIDGE_DAYS + 1;

/**
 * The weekend/holiday days OF THIS MONTH that get billed as leave because the
 * employee was off on both sides of them.
 *
 * Walks a padded window, finds every unbroken run of non-working days, and
 * keeps the runs whose immediate neighbours are both anchors. A run the
 * employee actually clocked into is left alone.
 */
export function computeSandwichDates(ctx: PayrollContext): ReadonlySet<string> {
  const sandwiched = new Set<string>();
  const monthDays = monthDateKeys(ctx.year, ctx.monthIndex);
  if (monthDays.length === 0) return sandwiched;

  const windowEnd = shiftDateKey(monthDays[monthDays.length - 1], SANDWICH_WINDOW_PAD_DAYS);
  let cursor = shiftDateKey(monthDays[0], -SANDWICH_WINDOW_PAD_DAYS);

  while (cursor <= windowEnd) {
    if (!isBridgeableDay(cursor, ctx.holidays)) {
      cursor = shiftDateKey(cursor, 1);
      continue;
    }

    const run: string[] = [];
    while (cursor <= windowEnd && isBridgeableDay(cursor, ctx.holidays)) {
      run.push(cursor);
      cursor = shiftDateKey(cursor, 1);
    }

    if (run.length > SANDWICH_MAX_BRIDGE_DAYS) continue;
    // A run touching the window edge has an unknown neighbour, so the lookups
    // below miss and it is correctly left alone.
    if (!ctx.sandwichAnchorDates.has(shiftDateKey(run[0], -1))) continue;
    if (!ctx.sandwichAnchorDates.has(shiftDateKey(run[run.length - 1], 1))) continue;

    for (const date of run) {
      if (date.startsWith(`${ctx.month}-`) && !ctx.workedDates.has(date)) sandwiched.add(date);
    }
  }

  return sandwiched;
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
 * Spends `needed` days of the quarterly allowance and reports what that bought.
 * Whatever the quota could not cover is deducted. Days are settled in calendar
 * order, so the earliest leave in a quarter is the one that gets paid.
 */
function spendLeaveQuota(
  state: PayrollState,
  needed: number,
  labels: { paid: string; unpaid: string },
): PayrollDayVerdict {
  const covered = Math.min(state.quotaLeft, needed);
  state.quotaLeft = Math.max(0, state.quotaLeft - covered);
  const uncovered = Math.max(0, needed - covered);

  return uncovered <= 0
    ? { kind: "paid-leave", label: labels.paid, deduct: 0 }
    : { kind: "unpaid-leave", label: labels.unpaid, deduct: uncovered };
}

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
    // Sits ABOVE weekend/holiday on purpose: it exists precisely to overrule
    // them on the days it claims.
    id: "sandwich-leave",
    label: "Sandwich leave",
    description:
      "A weekend or holiday with leave/absence on BOTH sides is billed as leave — " +
      "off Friday and Monday and the weekend between them counts too.",
    classify: (date, _ctx, state) =>
      state.sandwichDates.has(date)
        ? spendLeaveQuota(state, 1, {
            paid: "Paid Leave — Sandwich",
            unpaid: "Unpaid Leave — Sandwich (quarter quota used)",
          })
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
    classify: (date, ctx) => {
      const name = holidayName(date, ctx.holidays);
      return name ? { kind: "holiday", label: `${name} (paid holiday)`, deduct: 0 } : null;
    },
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

      return spendLeaveQuota(state, leave.days, {
        paid: `Paid Leave — ${leave.leaveType}`,
        unpaid: `Unpaid Leave — ${leave.leaveType} (quarter quota used)`,
      });
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
  const state: PayrollState = {
    quotaLeft: ctx.quotaAtMonthStart,
    // Needs the whole month in view, so it is resolved once up front rather
    // than day by day inside the factor.
    sandwichDates: computeSandwichDates(ctx),
  };
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
export function expandLeaveDays(
  request: PayrollLeaveInput,
  holidays: HolidayCalendar,
): PayrollLeaveDay[] {
  const workingDays = inclusiveDateKeys(request.startDate, request.endDate).filter(date =>
    isWorkingDay(date, holidays),
  );
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
  /** HR's calendar from `public_holidays`. Never pass an empty map as a
   *  stand-in for "still loading" — every holiday would bill as an absence. */
  holidays: HolidayCalendar;
  today?: string;
}): PayrollResult {
  const { profile, year, monthIndex, holidays } = input;
  const today = input.today ?? toDateKey(new Date());
  const month = monthKey(year, monthIndex);

  const idMatch = profile.id;
  const nameMatch = normalizeName(profile.name);
  const belongsToEmployee = (employeeId: string | null | undefined, employeeName: string) =>
    (employeeId && employeeId === idMatch) ||
    (!employeeId && normalizeName(employeeName) === nameMatch) ||
    normalizeName(employeeName) === nameMatch;

  // Padded either side of the month so a Fri–Mon sandwich spanning the
  // boundary can see both of its anchors. `input.attendance` must cover this
  // window too, or the extra days read as absences.
  const monthDays = monthDateKeys(year, monthIndex);
  const windowStart = shiftDateKey(monthDays[0], -SANDWICH_WINDOW_PAD_DAYS);
  const windowEnd = shiftDateKey(monthDays[monthDays.length - 1], SANDWICH_WINDOW_PAD_DAYS);

  const workedDates = new Set<string>();
  for (const entry of input.attendance) {
    if (entry.date < windowStart || entry.date > windowEnd) continue;
    if (belongsToEmployee(entry.employeeId, entry.employee)) workedDates.add(entry.date);
  }

  const approved = input.leaveRequests.filter(
    r => r.status === "Approved" && belongsToEmployee(r.employeeId, r.employeeName),
  );

  const leaveByDate = new Map<string, PayrollLeaveDay>();
  const quarterStart = monthKey(year, quarterStartMonthIndex(monthIndex));
  let quotaUsedBeforeMonth = 0;

  for (const request of approved) {
    for (const day of expandLeaveDays(request, holidays)) {
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
  const joinedOn = parseJoinedDate(profile.joined);

  // Anything the employee owed us a day for and did not deliver — approved
  // leave and plain absence alike — can anchor a sandwich. Absence has to
  // count, or skipping the leave form would be the cheaper way to take a long
  // weekend.
  const sandwichAnchorDates = new Set<string>();
  for (const date of inclusiveDateKeys(windowStart, windowEnd)) {
    if (!isWorkingDay(date, holidays)) continue;
    if (date > today) continue;
    if (joinedOn && date < joinedOn) continue;
    if (workedDates.has(date)) continue;
    sandwichAnchorDates.add(date);
  }

  const ctx: PayrollContext = {
    month,
    year,
    monthIndex,
    daysInMonth: daysInMonthOf(year, monthIndex),
    today,
    baseSalary: parseSalaryAmount(profile.salary) ?? 0,
    workedDates,
    leaveByDate,
    sandwichAnchorDates,
    holidays,
    quotaAtMonthStart,
    joinedOn,
  };

  const result = computeMonthlyPayroll(ctx, {
    employeeId: profile.id,
    employeeName: profile.name,
  });

  return { ...result, baseSalary: parseSalaryAmount(profile.salary) };
}
