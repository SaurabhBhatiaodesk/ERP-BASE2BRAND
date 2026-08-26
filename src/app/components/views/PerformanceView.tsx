import React, { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Search, Gauge, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";
import {
  useAttendanceReport,
  useEmployeeProfiles,
  useLeaveRequests,
  usePublicHolidays,
  useProjectTasks,
} from "@/hooks/useSupabaseData";
import { findProfileForUser, type EmployeeProfile } from "@/lib/database";
import { isAdminRole } from "@/lib/auth";
import {
  buildHolidayCalendar,
  daysInMonthOf,
  monthLabel,
  toDateKey,
  SANDWICH_WINDOW_PAD_DAYS,
  type PayrollDay,
} from "@/lib/payroll";
import {
  computeAttendanceMeter,
  computeTaskCompletionMeter,
  computeShiftCompletionMeter,
  computeShiftHoursByDay,
  computeTaskCompletionByDay,
  attendanceDayBucket,
  ATTENDANCE_BUCKET_COLORS,
  kpiSeverity,
  KPI_SEVERITY_COLORS,
  type AttendanceMeter,
  type TaskCompletionMeter,
  type ShiftCompletionMeter,
  type DailyPoint,
  type AttendanceDayBucket,
} from "@/lib/performanceKpi";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";

type PerformanceRow = {
  profile: EmployeeProfile;
  attendanceMeter: AttendanceMeter;
  taskMeter: TaskCompletionMeter;
  shiftMeter: ShiftCompletionMeter;
};

function MeterBar({ label, percent, caption }: { label: string; percent: number; caption?: string }) {
  const colors = KPI_SEVERITY_COLORS[kpiSeverity(percent)];
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-bold font-['Geist_Mono'] ${colors.text}`}>{Math.round(percent)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: colors.track }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: colors.fill }} />
      </div>
      {caption && <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-1">{caption}</p>}
    </div>
  );
}

function EmployeeKpiCard({ row, onClick }: { row: PerformanceRow; onClick?: () => void }) {
  const { profile, attendanceMeter, taskMeter, shiftMeter } = row;
  return (
    <div
      onClick={onClick}
      className={`${cardCls} p-4 ${onClick ? "cursor-pointer hover:border-indigo-500/30 transition-colors" : ""}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <Avatar
          initials={profile.avatar || profile.name.slice(0, 2).toUpperCase()}
          src={profile.profileImageUrl || undefined}
          size="sm"
          color="bg-gradient-to-br from-indigo-600 to-violet-600"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{profile.name}</p>
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] truncate">{profile.role} · {profile.dept}</p>
        </div>
      </div>
      <div className="space-y-3">
        <MeterBar label="Attendance" percent={attendanceMeter.percent} caption={`${attendanceMeter.payableDays} of ${attendanceMeter.daysInMonth} days payable`} />
        <MeterBar
          label="Task Completion"
          percent={taskMeter.percent}
          caption={taskMeter.total > 0 ? `${taskMeter.done}/${taskMeter.total} done · ${taskMeter.onTime} on time` : "No tasks due this month"}
        />
        <MeterBar
          label="Shift Time"
          percent={shiftMeter.percent}
          caption={
            shiftMeter.totalDays > 0
              ? `${shiftMeter.totalHours.toFixed(1)}h of ${shiftMeter.expectedHours}h (8h/day × ${shiftMeter.totalDays} days)`
              : "No clock-ins this month"
          }
        />
      </div>
    </div>
  );
}

// ── Self-view: 3 separate graph cards ────────────────────────────
function GraphCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className={`${cardCls} p-5`}>
      <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{title}</h3>
      {subtitle && <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-0.5 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function dayTickLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DailyBarChart({
  data,
  color,
  unit,
  targetLine,
}: {
  data: DailyPoint[];
  color: string;
  unit: string;
  targetLine?: number;
}) {
  const tickInterval = Math.max(0, Math.ceil(data.length / 7) - 1);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={8} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "#6b7fa8", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis tick={{ fill: "#6b7fa8", fontSize: 9 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(99,102,241,0.06)" }}
          contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "#e2e8f7" }}
          formatter={(value: number) => [`${value}${unit}`, ""]}
          labelFormatter={(day: number) => {
            const point = data.find(d => d.day === day);
            return point ? dayTickLabel(point.date) : `Day ${day}`;
          }}
        />
        {targetLine != null && (
          <ReferenceLine y={targetLine} stroke="#f59e0b" strokeDasharray="4 4" />
        )}
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AttendanceDayStrip({ days }: { days: PayrollDay[] }) {
  const bucketOrder: AttendanceDayBucket[] = ["worked", "off", "leave", "attention", "future"];
  return (
    <div>
      <div className="flex gap-[3px] h-10">
        {days.map(d => {
          const colors = ATTENDANCE_BUCKET_COLORS[attendanceDayBucket(d.kind)];
          return (
            <div
              key={d.date}
              title={`${dayTickLabel(d.date)} — ${d.label}`}
              className="flex-1 h-full rounded-sm"
              style={{ background: colors.fill }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {bucketOrder.map(key => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ATTENDANCE_BUCKET_COLORS[key].fill }} />
            <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{ATTENDANCE_BUCKET_COLORS[key].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeGraphDetail({
  row,
  dailyShift,
  dailyTasks,
  onBack,
}: {
  row: PerformanceRow;
  dailyShift: DailyPoint[];
  dailyTasks: DailyPoint[];
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-4 flex items-center gap-3`}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans'] shrink-0 mr-1"
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}
        <Avatar
          initials={row.profile.avatar || row.profile.name.slice(0, 2).toUpperCase()}
          src={row.profile.profileImageUrl || undefined}
          size="lg"
          color="bg-gradient-to-br from-indigo-600 to-violet-600"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{row.profile.name}</p>
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] truncate">{row.profile.role} · {row.profile.dept}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <GraphCard
          title="Task Completion"
          subtitle={row.taskMeter.total > 0 ? `${row.taskMeter.done}/${row.taskMeter.total} done this month` : "No tasks due this month"}
        >
          <DailyBarChart data={dailyTasks} color="#8b5cf6" unit=" done" />
        </GraphCard>

        <GraphCard title="Attendance" subtitle={`${row.attendanceMeter.payableDays} of ${row.attendanceMeter.daysInMonth} days payable`}>
          <AttendanceDayStrip days={row.attendanceMeter.days} />
        </GraphCard>

        <GraphCard
          title="Shift Time"
          subtitle={row.shiftMeter.totalDays > 0 ? `${row.shiftMeter.totalHours.toFixed(1)}h logged · 8h/day target` : "No clock-ins this month"}
        >
          <DailyBarChart data={dailyShift} color="#6366f1" unit="h" targetLine={8} />
        </GraphCard>
      </div>
    </div>
  );
}

export function PerformanceView({
  userRole = "",
  userName = "",
  userEmail = "",
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), monthIndex: today.getMonth() }));
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const range = useMemo(() => {
    const { year, monthIndex } = cursor;
    const pad = SANDWICH_WINDOW_PAD_DAYS;
    return {
      startDate: toDateKey(new Date(year, monthIndex, 1 - pad)),
      endDate: toDateKey(new Date(year, monthIndex, daysInMonthOf(year, monthIndex) + pad)),
    };
  }, [cursor]);

  const { data: profiles, loading: profilesLoading, error: profilesError } = useEmployeeProfiles();
  const { data: leaveRequests, loading: leavesLoading } = useLeaveRequests();
  const { data: holidayRows, loading: holidaysLoading, error: holidaysError } = usePublicHolidays();

  const viewerProfile = useMemo(
    () => findProfileForUser(profiles, userName, userEmail),
    [profiles, userName, userEmail]
  );

  const visibleProfiles = useMemo(() => {
    if (userRole === "teamlead") {
      if (!viewerProfile) return [];
      return profiles.filter(p => p.dept === viewerProfile.dept);
    }
    if (isAdminRole(userRole)) {
      return profiles.filter(p => p.dept !== "Executive" && p.name !== "CEO Admin");
    }
    return viewerProfile ? [viewerProfile] : [];
  }, [profiles, userRole, viewerProfile]);

  const soloEmployeeId = visibleProfiles.length === 1 ? visibleProfiles[0].id : undefined;

  const { data: attendance, loading: attendanceLoading, error: attendanceError } = useAttendanceReport({
    ...range,
    employeeId: soloEmployeeId,
  });
  const { data: tasks, loading: tasksLoading } = useProjectTasks(
    soloEmployeeId ? { assigneeId: soloEmployeeId } : undefined
  );

  const holidays = useMemo(() => buildHolidayCalendar(holidayRows), [holidayRows]);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.monthIndex === today.getMonth();

  const rows: PerformanceRow[] = useMemo(() => {
    if (holidaysLoading || holidaysError) return [];
    return visibleProfiles
      .map(profile => ({
        profile,
        attendanceMeter: computeAttendanceMeter({
          profile: { id: profile.id, name: profile.name, salary: profile.salary, joined: profile.joined },
          year: cursor.year,
          monthIndex: cursor.monthIndex,
          attendance,
          leaveRequests,
          holidays,
          today: todayKey,
        }),
        taskMeter: computeTaskCompletionMeter(tasks, profile.id, cursor),
        shiftMeter: computeShiftCompletionMeter(attendance, profile.id),
      }))
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name));
  }, [visibleProfiles, attendance, leaveRequests, holidays, holidaysLoading, holidaysError, cursor, tasks, todayKey]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r => r.profile.name.toLowerCase().includes(q) || r.profile.role.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Daily trend series — for the self-view (soloEmployeeId) or whichever
  // employee card was clicked in the admin/Team-Lead grid (selectedEmployeeId).
  const dailyEmployeeId = soloEmployeeId ?? selectedEmployeeId ?? undefined;
  const dailyShift = useMemo(
    () => (dailyEmployeeId ? computeShiftHoursByDay(attendance, dailyEmployeeId, cursor) : []),
    [attendance, dailyEmployeeId, cursor]
  );
  const dailyTasks = useMemo(
    () => (dailyEmployeeId ? computeTaskCompletionByDay(tasks, dailyEmployeeId, cursor) : []),
    [tasks, dailyEmployeeId, cursor]
  );

  function shiftMonth(delta: number) {
    setCursor(prev => {
      const next = new Date(prev.year, prev.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
  }

  const loading = profilesLoading || leavesLoading || holidaysLoading || attendanceLoading || tasksLoading;
  const error = profilesError || holidaysError || attendanceError;

  if (loading && rows.length === 0) return <DataLoading label="Loading performance data..." />;
  if (error) return <DataError message={error} />;
  if (!viewerProfile && visibleProfiles.length === 0) {
    return <DataEmpty message="Your employee profile was not found. Contact HR." />;
  }

  // True whenever this role can see more than one employee (ceo/superadmin/hr
  // see everyone, teamlead sees their dept) — independent of search filtering,
  // so a search narrowing to one match doesn't accidentally flip into detail mode.
  const isMultiEmployeeContext = visibleProfiles.length > 1;
  const selectedRow = selectedEmployeeId ? rows.find(r => r.profile.id === selectedEmployeeId) ?? null : null;
  const showingGrid = isMultiEmployeeContext && !selectedRow;

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <Gauge size={15} className="text-indigo-400" /> Performance
            </h2>
            <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">
              {userRole === "teamlead" && viewerProfile ? `${viewerProfile.dept} team · ` : ""}
              Attendance · Task Completion · Shift Completed
            </p>
          </div>

          <div className="flex items-center gap-3">
            {showingGrid && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search employee..."
                  className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl pl-9 pr-4 py-2 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']"
                />
              </div>
            )}
            <div className="flex items-center bg-[#131a35] border border-indigo-500/30 rounded-lg overflow-hidden shadow-sm shadow-indigo-500/10">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="px-3 py-2 text-[#8fa0c4] hover:text-white hover:bg-indigo-500/10 transition-colors border-r border-[rgba(99,102,241,0.15)]"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-5 py-2 flex items-center justify-center gap-2 min-w-[180px]">
                <Calendar size={14} className="text-indigo-400" />
                <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                  {monthLabel(cursor.year, cursor.monthIndex)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                disabled={isCurrentMonth}
                className="px-3 py-2 text-[#8fa0c4] hover:text-white hover:bg-indigo-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-l border-[rgba(99,102,241,0.15)]"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showingGrid ? (
        visibleRows.length === 0 ? (
          <DataEmpty message="No employees to show for this period." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleRows.map(row => (
              <EmployeeKpiCard key={row.profile.id} row={row} onClick={() => setSelectedEmployeeId(row.profile.id)} />
            ))}
          </div>
        )
      ) : selectedRow ? (
        <EmployeeGraphDetail
          row={selectedRow}
          dailyShift={dailyShift}
          dailyTasks={dailyTasks}
          onBack={() => setSelectedEmployeeId(null)}
        />
      ) : visibleRows[0] ? (
        <EmployeeGraphDetail row={visibleRows[0]} dailyShift={dailyShift} dailyTasks={dailyTasks} />
      ) : (
        <DataEmpty message="No employees to show for this period." />
      )}
    </div>
  );
}
