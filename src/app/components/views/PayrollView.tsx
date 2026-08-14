import React, { useMemo, useState } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Search, X, Users, Wallet,
  AlertTriangle, Pencil, ShieldAlert, IndianRupee,
} from "lucide-react";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";
import { useAttendanceReport, useEmployeeProfiles, useLeaveRequests } from "@/hooks/useSupabaseData";
import { initialsFromName, updateEmployeeProfile, type EmployeeProfile } from "@/lib/database";
import { isPayrollRole } from "@/lib/auth";
import {
  buildPayrollForEmployee,
  daysInMonthOf,
  formatDayLabel,
  formatDays,
  formatMoney,
  formatSalaryForStorage,
  monthLabel,
  parseSalaryAmount,
  toDateKey,
  PAID_LEAVE_QUOTA_PER_QUARTER,
  type PayrollResult,
} from "@/lib/payroll";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";

type PayrollRow = {
  profile: EmployeeProfile;
  payroll: PayrollResult;
};

export function PayrollView({ userRole = "ceo" }: { userRole?: string }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  }));
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salaryDraft, setSalaryDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const allowed = isPayrollRole(userRole);

  const range = useMemo(() => {
    const { year, monthIndex } = cursor;
    return {
      startDate: toDateKey(new Date(year, monthIndex, 1)),
      endDate: toDateKey(new Date(year, monthIndex, daysInMonthOf(year, monthIndex))),
    };
  }, [cursor]);

  const {
    data: profiles,
    loading: profilesLoading,
    error: profilesError,
    refresh: refreshProfiles,
  } = useEmployeeProfiles();
  const { data: leaveRequests, loading: leavesLoading } = useLeaveRequests();
  const { data: attendance, loading: attendanceLoading, error: attendanceError } =
    useAttendanceReport(allowed ? range : { startDate: range.startDate, endDate: range.startDate });

  const todayKey = useMemo(() => toDateKey(today), [today]);
  const isCurrentMonth =
    cursor.year === today.getFullYear() && cursor.monthIndex === today.getMonth();

  const rows: PayrollRow[] = useMemo(() => {
    if (!allowed) return [];
    return profiles
      .filter(p => p.name !== "CEO Admin")
      .map(profile => ({
        profile,
        payroll: buildPayrollForEmployee({
          profile: {
            id: profile.id,
            name: profile.name,
            salary: profile.salary,
            joined: profile.joined,
          },
          year: cursor.year,
          monthIndex: cursor.monthIndex,
          attendance,
          leaveRequests,
          today: todayKey,
        }),
      }))
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name));
  }, [allowed, profiles, attendance, leaveRequests, cursor, todayKey]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r => r.profile.name.toLowerCase().includes(q) || r.profile.role.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let payable = 0;
    let unset = 0;
    let deductionDays = 0;
    for (const row of rows) {
      if (row.payroll.baseSalary === null) unset++;
      else payable += row.payroll.netPay;
      deductionDays += row.payroll.deductionDays;
    }
    return { payable, unset, deductionDays, headcount: rows.length };
  }, [rows]);

  const selected = visibleRows.find(r => r.profile.id === selectedId) ?? null;

  function shiftMonth(delta: number) {
    setCursor(prev => {
      const next = new Date(prev.year, prev.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
  }

  async function handleSaveSalary(profile: EmployeeProfile) {
    const raw = salaryDraft[profile.id] ?? "";
    const amount = parseSalaryAmount(raw);
    if (amount === null) {
      setSaveError(`Enter a valid monthly salary for ${profile.name}.`);
      return;
    }

    setSavingId(profile.id);
    setSaveError("");
    try {
      await updateEmployeeProfile(profile.id, { salary: formatSalaryForStorage(amount) });
      setSalaryDraft(prev => {
        const next = { ...prev };
        delete next[profile.id];
        return next;
      });
      setEditingId(null);
      refreshProfiles();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save salary.");
    } finally {
      setSavingId(null);
    }
  }

  if (!allowed) {
    return (
      <div className={`${cardCls} p-8 max-w-lg mx-auto text-center`}>
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={22} className="text-rose-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5 font-['Plus_Jakarta_Sans']">
          Payroll is restricted
        </h3>
        <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          Salary data is visible to HR and CEO accounts only. Contact your HR administrator if you
          need access.
        </p>
      </div>
    );
  }

  const loading = profilesLoading || attendanceLoading || leavesLoading;
  const error = profilesError || attendanceError;

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className={`${cardCls} p-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
              Payroll Dashboard
            </h2>
            <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">
              Sat &amp; Sun paid · {PAID_LEAVE_QUOTA_PER_QUARTER} paid leaves per quarter
            </p>
          </div>

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

        {isCurrentMonth && (
          <p className="mt-3 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 font-['Plus_Jakarta_Sans']">
            This month is still running — days after {formatDayLabel(todayKey)} are not counted yet,
            so net pay is a running projection.
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Net Payable",
            value: formatMoney(totals.payable),
            icon: Wallet,
            cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Employees",
            value: String(totals.headcount),
            icon: Users,
            cls: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          },
          {
            label: "Salary Not Set",
            value: String(totals.unset),
            icon: AlertTriangle,
            cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Deduction Days",
            value: formatDays(totals.deductionDays),
            icon: IndianRupee,
            cls: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          },
        ].map(tile => (
          <div key={tile.label} className={`${tile.cls} border rounded-xl p-4 flex items-center gap-3`}>
            <span className={`w-10 h-10 rounded-full ${tile.cls} border flex items-center justify-center shrink-0`}>
              <tile.icon size={16} />
            </span>
            <div className="min-w-0">
              <div className={`text-lg font-bold ${tile.cls.split(" ")[0]} font-['Plus_Jakarta_Sans'] truncate`}>
                {tile.value}
              </div>
              <div className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide">
                {tile.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by employee name or role..."
          className={`${inputCls} pl-11`}
        />
      </div>

      {saveError && <DataError message={saveError} />}
      {error && <DataError message={error} />}

      {loading && rows.length === 0 ? (
        <DataLoading label="Calculating payroll..." />
      ) : visibleRows.length === 0 ? (
        <DataEmpty message={search ? "No employees match that search." : "No employees found."} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRows.map(({ profile, payroll }) => {
            const isEditing = editingId === profile.id || payroll.baseSalary === null;
            return (
              <div
                key={profile.id}
                className={`${cardCls} p-5 transition-colors hover:border-[rgba(99,102,241,0.3)]`}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={profile.profileImageUrl}
                    initials={profile.avatar || initialsFromName(profile.name)}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans'] truncate">
                      {profile.name}
                    </p>
                    <p className="text-xs text-violet-300/80 font-['Plus_Jakarta_Sans'] truncate">
                      {profile.role}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide">
                      Net Pay
                    </p>
                    {payroll.baseSalary === null ? (
                      <p className="text-lg font-bold text-rose-400 font-['Plus_Jakarta_Sans']">N/A</p>
                    ) : (
                      <p className="text-lg font-bold text-emerald-400 font-['Plus_Jakarta_Sans']">
                        {formatMoney(payroll.netPay)}
                      </p>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
                    <label className="block text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide mb-2">
                      {payroll.baseSalary === null
                        ? "Monthly salary not set — enter it to run payroll"
                        : "Update monthly salary"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={salaryDraft[profile.id] ?? (payroll.baseSalary ?? "")}
                        onChange={e =>
                          setSalaryDraft(prev => ({ ...prev, [profile.id]: e.target.value }))
                        }
                        placeholder="e.g. 30000"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveSalary(profile)}
                        disabled={savingId === profile.id}
                        className="px-5 py-2.5 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans']"
                      >
                        {savingId === profile.id ? "Saving..." : "Save"}
                      </button>
                      {payroll.baseSalary !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setSalaryDraft(prev => {
                              const next = { ...prev };
                              delete next[profile.id];
                              return next;
                            });
                          }}
                          className="px-3 py-2.5 shrink-0 text-xs text-[#8fa0c4] hover:text-white transition-colors font-['Plus_Jakarta_Sans']"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    className="mt-4 w-full bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl p-4 grid grid-cols-3 divide-x divide-[rgba(99,102,241,0.12)] hover:border-indigo-500/30 transition-colors text-left"
                  >
                    <div className="px-1">
                      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide mb-1">
                        Base Salary
                      </p>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                          {formatMoney(payroll.baseSalary ?? 0)}
                        </span>
                        <Pencil
                          size={11}
                          className="text-[#6b7fa8] hover:text-indigo-300 transition-colors"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingId(profile.id);
                          }}
                        />
                      </span>
                    </div>
                    <div className="px-3">
                      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide mb-1">
                        Payable Days
                      </p>
                      <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                        {formatDays(payroll.payableDays)} / {payroll.daysInMonth}
                      </p>
                    </div>
                    <div className="px-3">
                      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide mb-1">
                        Deductions
                      </p>
                      <p
                        className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${
                          payroll.deductionDays > 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {formatDays(payroll.deductionDays)} Days
                      </p>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <PayslipModal row={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function PayslipModal({ row, onClose }: { row: PayrollRow; onClose: () => void }) {
  const { profile, payroll } = row;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl shadow-indigo-900/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h3 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
            Payslip Breakdown
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6b7fa8] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-6 overflow-y-auto space-y-5">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile.profileImageUrl}
              initials={profile.avatar || initialsFromName(profile.name)}
              size="xl"
            />
            <div className="min-w-0">
              <p className="text-lg font-bold text-white font-['Plus_Jakarta_Sans'] truncate">
                {profile.name}
              </p>
              <p className="text-sm text-violet-300/80 font-['Plus_Jakarta_Sans'] truncate">
                {profile.role}
              </p>
            </div>
          </div>

          <div className="bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl divide-y divide-[rgba(99,102,241,0.08)]">
            <Line label="Base Salary (Monthly)" value={formatMoney(payroll.baseSalary ?? 0)} />
            <Line
              label="Payable Days"
              value={`${formatDays(payroll.payableDays)} / ${payroll.daysInMonth}`}
            />
            <Line
              label="Paid Leave Used"
              value={`${formatDays(payroll.paidLeaveUsed)} · ${formatDays(payroll.quotaLeft)} left this quarter`}
            />
            <Line
              label="Gross Net Pay"
              value={formatMoney(payroll.netPay)}
              valueCls="text-emerald-400 font-bold"
            />
          </div>

          <div>
            <h4 className="text-base font-bold text-white mb-3 font-['Plus_Jakarta_Sans']">
              Deduction Breakdown
            </h4>
            {payroll.deductions.length === 0 ? (
              <div className="bg-[#131a35]/70 border border-emerald-500/20 rounded-xl px-4 py-5 text-center">
                <p className="text-sm text-emerald-400 font-['Plus_Jakarta_Sans']">
                  No deductions — full salary payable.
                </p>
              </div>
            ) : (
              <div className="bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl divide-y divide-[rgba(99,102,241,0.08)]">
                {payroll.deductions.map(day => (
                  <div key={day.date} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] shrink-0">
                      {formatDayLabel(day.date)}
                    </span>
                    <span className="text-sm text-rose-400/90 font-['Plus_Jakarta_Sans'] truncate text-center flex-1">
                      {day.label}
                    </span>
                    <span className="text-sm font-semibold text-rose-400 font-['Plus_Jakarta_Sans'] shrink-0">
                      - {formatDays(day.deduct)} Day
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, valueCls = "text-white" }: {
  label: string;
  value: string;
  valueCls?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-sm text-[#8fa0c4] font-['Plus_Jakarta_Sans']">{label}</span>
      <span className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${valueCls}`}>{value}</span>
    </div>
  );
}
