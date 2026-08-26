import React, { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, IndianRupee, KeyRound, Loader2, Lock, Wallet } from "lucide-react";
import bcrypt from "bcryptjs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";
import { useAttendanceReport, useEmployeeProfiles, useLeaveRequests, usePublicHolidays } from "@/hooks/useSupabaseData";
import { findProfileForUser, fetchPayrollPinHash, setPayrollPinHash, initialsFromName } from "@/lib/database";
import {
  buildHolidayCalendar,
  buildPayrollForEmployee,
  daysInMonthOf,
  formatDayLabel,
  formatDays,
  formatMoney,
  monthLabel,
  parseJoinedDate,
  toDateKey,
  SANDWICH_WINDOW_PAD_DAYS,
  type PayrollResult,
} from "@/lib/payroll";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const btnPrimary =
  "flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 transition-all font-['Plus_Jakarta_Sans']";

function Line({ label, value, valueCls = "text-white" }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-sm text-[#8fa0c4] font-['Plus_Jakarta_Sans']">{label}</span>
      <span className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${valueCls}`}>{value}</span>
    </div>
  );
}

// ── PIN gate ──────────────────────────────────────────────────
type GateStep = "loading" | "set" | "enter" | "forgot-verify" | "forgot-set";

function PayrollPinGate({
  employeeId,
  userEmail,
  onUnlock,
}: {
  employeeId: string;
  userEmail: string;
  onUnlock: () => void;
}) {
  const [step, setStep] = useState<GateStep>("loading");
  const [existingHash, setExistingHash] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const hash = await fetchPayrollPinHash(employeeId);
      setExistingHash(hash);
      setStep(hash ? "enter" : "set");
    })();
  }, [employeeId]);

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pin.length < 4) { setError("PIN must be at least 4 characters."); return; }
    if (pin !== confirmPin) { setError("PINs do not match."); return; }
    setSubmitting(true);
    const hash = await bcrypt.hash(pin, 10);
    const ok = await setPayrollPinHash(employeeId, hash);
    setSubmitting(false);
    if (!ok) { setError("Could not save your PIN. Please try again."); return; }
    toast.success(step === "forgot-set" ? "PIN reset." : "PIN set.");
    onUnlock();
  }

  async function handleEnterPin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!existingHash) return;
    setSubmitting(true);
    const matches = await bcrypt.compare(pin, existingHash);
    setSubmitting(false);
    if (!matches) { setError("Incorrect PIN."); return; }
    onUnlock();
  }

  async function handleVerifyAccountPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!userEmail) { setError("Your account email isn't available — please reload and try again."); return; }
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: userEmail, password: accountPassword });
    setSubmitting(false);
    if (authError) { setError("Incorrect account password."); return; }
    setPin("");
    setConfirmPin("");
    setAccountPassword("");
    setStep("forgot-set");
  }

  if (step === "loading") {
    return (
      <div className={`${cardCls} p-8 max-w-md mx-auto text-center`}>
        <Loader2 size={22} className="animate-spin text-indigo-400 mx-auto" />
      </div>
    );
  }

  if (step === "forgot-verify") {
    return (
      <div className={`${cardCls} p-8 max-w-md mx-auto`}>
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
          <KeyRound size={22} className="text-indigo-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5 text-center font-['Plus_Jakarta_Sans']">Confirm your account password</h3>
        <p className="text-xs text-[#6b7fa8] mb-5 text-center font-['Plus_Jakarta_Sans']">
          Enter your regular ERP login password to reset your Payroll PIN.
        </p>
        <form onSubmit={handleVerifyAccountPassword} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={accountPassword}
            onChange={e => setAccountPassword(e.target.value)}
            placeholder="Account password"
            className={inputCls}
          />
          {error && <p className="text-xs text-red-400 font-['Plus_Jakarta_Sans']">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? <Loader2 size={15} className="animate-spin" /> : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => { setError(""); setAccountPassword(""); setStep("enter"); }}
            className="w-full text-xs text-[#8fa0c4] hover:text-white transition-colors font-['Plus_Jakarta_Sans']"
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  if (step === "set" || step === "forgot-set") {
    return (
      <div className={`${cardCls} p-8 max-w-md mx-auto`}>
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
          <KeyRound size={22} className="text-indigo-400" />
        </div>
        <h3 className="text-base font-bold text-white mb-1.5 text-center font-['Plus_Jakarta_Sans']">
          {step === "forgot-set" ? "Set a new PIN" : "Set a Payroll PIN"}
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-5 text-center font-['Plus_Jakarta_Sans']">
          This PIN protects only your own pay details — nobody else can see or reset it but you.
        </p>
        <form onSubmit={handleSetPin} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="New PIN"
            className={inputCls}
          />
          <input
            type="password"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value)}
            placeholder="Confirm PIN"
            className={inputCls}
          />
          {error && <p className="text-xs text-red-400 font-['Plus_Jakarta_Sans']">{error}</p>}
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? <Loader2 size={15} className="animate-spin" /> : "Save PIN"}
          </button>
        </form>
      </div>
    );
  }

  // step === "enter"
  return (
    <div className={`${cardCls} p-8 max-w-md mx-auto`}>
      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock size={22} className="text-indigo-400" />
      </div>
      <h3 className="text-base font-bold text-white mb-1.5 text-center font-['Plus_Jakarta_Sans']">My Payroll is locked</h3>
      <p className="text-xs text-[#6b7fa8] mb-5 text-center font-['Plus_Jakarta_Sans']">Enter your Payroll PIN to continue.</p>
      <form onSubmit={handleEnterPin} className="space-y-3">
        <input
          type="password"
          autoFocus
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="PIN"
          className={inputCls}
        />
        {error && <p className="text-xs text-red-400 font-['Plus_Jakarta_Sans']">{error}</p>}
        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : "Unlock"}
        </button>
        <button
          type="button"
          onClick={() => { setError(""); setPin(""); setStep("forgot-verify"); }}
          className="w-full text-xs text-[#8fa0c4] hover:text-white transition-colors font-['Plus_Jakarta_Sans']"
        >
          Forgot PIN?
        </button>
      </form>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
export function MyPayrollView({
  userName = "",
  userEmail = "",
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), monthIndex: today.getMonth() }));

  const { data: profiles, loading: profilesLoading, error: profilesError } = useEmployeeProfiles();
  const viewerProfile = useMemo(() => findProfileForUser(profiles, userName, userEmail), [profiles, userName, userEmail]);

  const range = useMemo(() => {
    const { year, monthIndex } = cursor;
    const pad = SANDWICH_WINDOW_PAD_DAYS;
    return {
      startDate: toDateKey(new Date(year, monthIndex, 1 - pad)),
      endDate: toDateKey(new Date(year, monthIndex, daysInMonthOf(year, monthIndex) + pad)),
    };
  }, [cursor]);

  const { data: leaveRequests, loading: leavesLoading } = useLeaveRequests();
  const { data: holidayRows, loading: holidaysLoading, error: holidaysError } = usePublicHolidays();
  const { data: attendance, loading: attendanceLoading, error: attendanceError } = useAttendanceReport({
    ...range,
    employeeId: viewerProfile?.id,
  });

  const holidays = useMemo(() => buildHolidayCalendar(holidayRows), [holidayRows]);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.monthIndex === today.getMonth();

  // Don't let the month picker go earlier than the employee's own start date.
  // Per the user: the start date is the profile's actual creation date
  // (`created_at`) — not a manually-entered "join date" field. Falls back to
  // the explicit `joinDate` (if HR set one) and then the month-precision
  // `joined` text, only when `created_at` itself is unavailable.
  const joinedOn = useMemo(() => {
    if (!viewerProfile) return null;
    if (viewerProfile.createdAt) {
      const d = new Date(viewerProfile.createdAt);
      if (!Number.isNaN(d.getTime())) return toDateKey(d);
    }
    if (viewerProfile.joinDate) {
      const d = new Date(`${viewerProfile.joinDate}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return toDateKey(d);
    }
    return parseJoinedDate(viewerProfile.joined);
  }, [viewerProfile]);
  const joinFloor = useMemo(() => {
    if (!joinedOn) return null;
    const d = new Date(`${joinedOn}T00:00:00`);
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  }, [joinedOn]);
  const isBeforeOrAtJoinMonth = joinFloor
    ? cursor.year < joinFloor.year || (cursor.year === joinFloor.year && cursor.monthIndex <= joinFloor.monthIndex)
    : false;
  const isJoinMonth = joinFloor ? cursor.year === joinFloor.year && cursor.monthIndex === joinFloor.monthIndex : false;

  const payroll: PayrollResult | null = useMemo(() => {
    if (!viewerProfile || holidaysLoading || holidaysError) return null;
    return buildPayrollForEmployee({
      // `payroll.ts` parses this via the same `parseJoinedDate` — reusing the
      // same resolved `joinedOn` (created_at first) keeps the payroll engine's
      // own pre-joining day exclusion consistent with the month-nav floor above.
      profile: { id: viewerProfile.id, name: viewerProfile.name, salary: viewerProfile.salary, joined: joinedOn || viewerProfile.joined },
      year: cursor.year,
      monthIndex: cursor.monthIndex,
      attendance,
      leaveRequests,
      holidays,
      today: todayKey,
    });
  }, [viewerProfile, attendance, leaveRequests, holidays, holidaysLoading, holidaysError, cursor, todayKey, joinedOn]);

  function shiftMonth(delta: number) {
    setCursor(prev => {
      const next = new Date(prev.year, prev.monthIndex + delta, 1);
      let year = next.getFullYear();
      let monthIndex = next.getMonth();
      if (joinFloor && (year < joinFloor.year || (year === joinFloor.year && monthIndex < joinFloor.monthIndex))) {
        year = joinFloor.year;
        monthIndex = joinFloor.monthIndex;
      }
      return { year, monthIndex };
    });
  }

  const loading = profilesLoading || leavesLoading || holidaysLoading || attendanceLoading;
  const error = profilesError || holidaysError || attendanceError;

  if (profilesLoading) return <DataLoading label="Loading your profile..." />;
  if (profilesError) return <DataError message={profilesError} />;
  if (!viewerProfile) return <DataEmpty message="Your employee profile was not found. Contact HR." />;

  if (!unlocked) {
    return <PayrollPinGate employeeId={viewerProfile.id} userEmail={userEmail} onUnlock={() => setUnlocked(true)} />;
  }

  if (loading && !payroll) return <DataLoading label="Loading your payroll..." />;
  if (error) return <DataError message={error} />;
  if (!payroll) return <DataLoading label="Loading your payroll..." />;

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-['Plus_Jakarta_Sans']">
              <IndianRupee size={15} className="text-indigo-400" /> My Payroll
            </h2>
            <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">Your own pay — visible only to you</p>
          </div>
          <div className="flex items-center bg-[#131a35] border border-indigo-500/30 rounded-lg overflow-hidden shadow-sm shadow-indigo-500/10">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={isBeforeOrAtJoinMonth}
              className="px-3 py-2 text-[#8fa0c4] hover:text-white hover:bg-indigo-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-r border-[rgba(99,102,241,0.15)]"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-5 py-2 flex items-center justify-center gap-2 min-w-[180px]">
              <Calendar size={14} className="text-indigo-400" />
              <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{monthLabel(cursor.year, cursor.monthIndex)}</span>
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
        {isJoinMonth && joinedOn && (
          <p className="mt-3 text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 font-['Plus_Jakarta_Sans']">
            You joined on {formatDayLabel(joinedOn)} — this is your first month, so only days from then onward are counted. Earlier months aren't available.
          </p>
        )}
        {isCurrentMonth && (
          <p className="mt-3 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 font-['Plus_Jakarta_Sans']">
            This month is still running — days after {formatDayLabel(todayKey)} are not counted yet, so net pay is a running projection.
          </p>
        )}
      </div>

      <div className={`${cardCls} p-6`}>
        <div className="flex items-center gap-4 mb-5">
          <Avatar
            src={viewerProfile.profileImageUrl}
            initials={viewerProfile.avatar || initialsFromName(viewerProfile.name)}
            size="xl"
          />
          <div className="min-w-0">
            <p className="text-lg font-bold text-white font-['Plus_Jakarta_Sans'] truncate">{viewerProfile.name}</p>
            <p className="text-sm text-violet-300/80 font-['Plus_Jakarta_Sans'] truncate">{viewerProfile.role}</p>
          </div>
          <div className="ml-auto text-right shrink-0">
            <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wide mb-1">Net Pay</p>
            {payroll.baseSalary === null ? (
              <p className="text-2xl font-bold text-rose-400 font-['Plus_Jakarta_Sans']">N/A</p>
            ) : (
              <p className="text-2xl font-bold text-emerald-400 font-['Plus_Jakarta_Sans']">{formatMoney(payroll.netPay)}</p>
            )}
          </div>
        </div>

        {payroll.baseSalary === null && (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-400 font-['Plus_Jakarta_Sans']">
              HR hasn't set your monthly salary yet, so net pay can't be calculated. Contact HR to get this set up.
            </p>
          </div>
        )}

        <div className="bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl divide-y divide-[rgba(99,102,241,0.08)]">
          <Line label="Base Salary (Monthly)" value={formatMoney(payroll.baseSalary ?? 0)} />
          <Line label="Payable Days" value={`${formatDays(payroll.payableDays)} / ${payroll.daysInMonth}`} />
          <Line
            label="Paid Leave Used"
            value={`${formatDays(payroll.paidLeaveUsed)} · ${formatDays(payroll.quotaLeft)} left this quarter`}
          />
          <Line label="Net Pay" value={formatMoney(payroll.netPay)} valueCls="text-emerald-400 font-bold" />
        </div>

        <div className="mt-5">
          <h4 className="text-base font-bold text-white mb-3 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <Wallet size={15} className="text-indigo-400" /> Deduction Breakdown
          </h4>
          {payroll.deductions.length === 0 ? (
            <div className="bg-[#131a35]/70 border border-emerald-500/20 rounded-xl px-4 py-5 text-center">
              <p className="text-sm text-emerald-400 font-['Plus_Jakarta_Sans']">No deductions — full salary payable.</p>
            </div>
          ) : (
            <div className="bg-[#131a35]/70 border border-[rgba(99,102,241,0.12)] rounded-xl divide-y divide-[rgba(99,102,241,0.08)]">
              {payroll.deductions.map(day => (
                <div key={day.date} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] shrink-0">{formatDayLabel(day.date)}</span>
                  <span className="text-sm text-rose-400/90 font-['Plus_Jakarta_Sans'] truncate text-center flex-1">{day.label}</span>
                  <span className="text-sm font-semibold text-rose-400 font-['Plus_Jakarta_Sans'] shrink-0">- {formatDays(day.deduct)} Day</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
