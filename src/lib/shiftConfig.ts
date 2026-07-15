/** Shared shift / timeline configuration — 4 AM → 4 AM (full 24-hour cycle). */

export type TimelineAxis = {
  /** Clock minute where the axis starts (4 AM = 240). */
  start: number;
  end: number;
  duration: number;
};

/** Timeline starts at 4 AM. */
export const SHIFT_AXIS_START_MIN = 4 * 60;
/** Timeline ends at 4 AM next day. */
export const SHIFT_AXIS_END_CLOCK_MIN = 4 * 60;
/** Full 24-hour cycle. */
export const SHIFT_AXIS_DURATION_MIN = 24 * 60;

/** Hours each employee works per shift. */
export const SHIFT_HOURS = 9;
export const SHIFT_DURATION = SHIFT_HOURS * 60;

export const DEFAULT_SHIFT_START = "10:00";

export const DEFAULT_TIMELINE_AXIS: TimelineAxis = {
  start: SHIFT_AXIS_START_MIN,
  end: SHIFT_AXIS_START_MIN + SHIFT_AXIS_DURATION_MIN,
  duration: SHIFT_AXIS_DURATION_MIN,
};

/** @deprecated use DEFAULT_TIMELINE_AXIS.start */
export const TIMELINE_AXIS_START = SHIFT_AXIS_START_MIN;
/** @deprecated use DEFAULT_TIMELINE_AXIS.end */
export const TIMELINE_AXIS_END = SHIFT_AXIS_END_CLOCK_MIN;
/** @deprecated use DEFAULT_TIMELINE_AXIS.duration */
export const TIMELINE_AXIS_DURATION = DEFAULT_TIMELINE_AXIS.duration;

export function resolveTimelineAxis(_employeeShiftStartsMin: number[] = []): TimelineAxis {
  return DEFAULT_TIMELINE_AXIS;
}

export function normalizeClockMin(clockMin: number) {
  return ((clockMin % (24 * 60)) + 24 * 60) % (24 * 60);
}

/** Map wall-clock time onto the 4 AM → 4 AM axis. */
export function clockMinToAxisMin(clockMin: number, axis: TimelineAxis = DEFAULT_TIMELINE_AXIS): number {
  const c = normalizeClockMin(clockMin);
  if (c >= axis.start) return c - axis.start;
  return (24 * 60 - axis.start) + c;
}

export function axisMinToClockMin(axisMin: number, axis: TimelineAxis = DEFAULT_TIMELINE_AXIS): number {
  const sameDaySpan = 24 * 60 - axis.start;
  if (axisMin < sameDaySpan) return axis.start + axisMin;
  return axisMin - sameDaySpan;
}

export function computeShiftEndMin(shiftStartMin: number) {
  return normalizeClockMin(shiftStartMin + SHIFT_DURATION);
}

export function isOvernightEmployeeShift(shiftStartMin: number, _shiftEndMin: number) {
  return shiftStartMin + SHIFT_DURATION >= 24 * 60;
}

export function hhmm(h: number, m: number) {
  const hour = h % 24;
  const period = hour >= 12 ? "PM" : "AM";
  const displayH = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export function clockMinutesToLabel(clockMin: number) {
  const normalized = normalizeClockMin(clockMin);
  return hhmm(Math.floor(normalized / 60), Math.floor(normalized % 60));
}

export function timelineAxisRangeLabel(axis: TimelineAxis = DEFAULT_TIMELINE_AXIS) {
  return `${clockMinutesToLabel(axis.start)} → ${clockMinutesToLabel(SHIFT_AXIS_END_CLOCK_MIN)}`;
}

export function isoToTimelineMinutes(iso: string, axis: TimelineAxis = DEFAULT_TIMELINE_AXIS) {
  const d = new Date(iso);
  const clockMinFractional = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const pos = clockMinToAxisMin(clockMinFractional, axis);
  return Math.max(0, Math.min(axis.duration, pos));
}

export function currentTimelineNowMin(axis: TimelineAxis = DEFAULT_TIMELINE_AXIS) {
  const now = new Date();
  const clockMinFractional = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return clockMinToAxisMin(clockMinFractional, axis);
}

export function minToLabel(min: number, axis: TimelineAxis = DEFAULT_TIMELINE_AXIS) {
  return clockMinutesToLabel(axisMinToClockMin(min, axis));
}

function compactHourLabel(hour24: number) {
  const h = hour24 % 24;
  if (h === 0) return "12AM";
  if (h === 12) return "12PM";
  if (h < 12) return `${h}AM`;
  return `${h - 12}PM`;
}

/** Hour labels: 4AM … 1AM · 3AM (full day cycle). */
export function timelineHourLabels(axis: TimelineAxis = DEFAULT_TIMELINE_AXIS, compact = true) {
  if (compact && axis.duration >= 24 * 60) {
    // 4 AM → 4 AM cycle: every 3h + 3 AM before cycle end
    const hours = [4, 7, 10, 13, 16, 19, 22, 1, 3];
    return hours.map(h => compactHourLabel(h));
  }

  const labels: string[] = [];
  for (let axisMin = 0; axisMin < axis.duration; axisMin += 60) {
    const clock = axisMinToClockMin(axisMin, axis);
    labels.push(compact ? compactHourLabel(Math.floor(clock / 60)) : clockMinutesToLabel(clock));
  }
  return labels;
}

export function parseShiftStartMinutes(value?: string | null) {
  if (!value?.trim()) return 10 * 60;
  const t = value.trim().toUpperCase();
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const ap = m12[3];
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  return 10 * 60;
}

export function formatShiftStartLabel(value?: string | null) {
  return clockMinutesToLabel(parseShiftStartMinutes(value));
}

function formatShiftOptionLabel(hour24: number) {
  return clockMinutesToLabel(hour24 * 60);
}

/** Shift start options — full 4 AM → 4 AM cycle (all 24 hours). */
export function buildShiftStartOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 4; h <= 23; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    options.push({ value, label: formatShiftOptionLabel(h) });
  }
  for (let h = 0; h <= 3; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    options.push({ value, label: formatShiftOptionLabel(h) });
  }
  return options;
}

export const SHIFT_START_OPTIONS = buildShiftStartOptions();

/** Handle overnight blocks on axis (e.g. 11 PM → 3 AM). */
export function timelineBlockEndOnAxis(
  start: number,
  end: number | null,
  nowMin: number,
  axis: TimelineAxis = DEFAULT_TIMELINE_AXIS,
) {
  const cappedNow = Math.max(0, Math.min(nowMin, axis.duration));
  if (end === null) return cappedNow;
  const rawEnd = Math.max(0, Math.min(end, axis.duration));
  if (rawEnd < start) return axis.duration;
  return rawEnd;
}

export function timelineBlockDurationOnAxis(
  start: number,
  end: number | null,
  nowMin: number,
  axis: TimelineAxis = DEFAULT_TIMELINE_AXIS,
) {
  const cappedNow = Math.max(0, Math.min(nowMin, axis.duration));
  if (end === null) {
    if (cappedNow <= start) return 0;
    return cappedNow - start;
  }
  const rawEnd = Math.max(0, Math.min(end, axis.duration));
  if (rawEnd < start) return axis.duration - start + rawEnd;
  return Math.max(0, rawEnd - start);
}

export function shiftWindowOnAxis(
  shiftStartMin: number,
  shiftEndMin: number,
  axis: TimelineAxis = DEFAULT_TIMELINE_AXIS,
) {
  const startPos = clockMinToAxisMin(shiftStartMin, axis);
  const endPos = clockMinToAxisMin(shiftEndMin, axis);
  let widthPos = endPos - startPos;
  if (widthPos <= 0) widthPos += axis.duration;

  widthPos = Math.max(0, widthPos);
  const left = (startPos / axis.duration) * 100;
  const width = (widthPos / axis.duration) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(0, Math.min(100 - left, width)),
  };
}
