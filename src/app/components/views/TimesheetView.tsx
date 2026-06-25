import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Clock, Download, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { Avatar } from "../ui";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useAttendance, useEmployeeProfiles, useProjects, useTimesheets } from "@/hooks/useSupabaseData";
import {
  addTimesheetEntry,
  deleteTimesheetEntry,
  formatTaskStatusLabel,
  namesMatch,
  saveTimesheetEntryEdit,
  type AttendanceEntry,
  type TimesheetEntry,
} from "@/lib/database";
import { isAdminRole, isExecutiveProfile } from "@/lib/auth";
import { isPersonalTaskRole } from "@/lib/database";
import { WorkFlowGuide } from "../ui/WorkFlowGuide";

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatIso(d = new Date()) {
  return formatLocalDate(d);
}

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatEntryDate(date: string) {
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRangeLabel(start: Date, end: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const yearSuffix =
    start.getFullYear() !== end.getFullYear()
      ? `, ${end.getFullYear()}`
      : "";
  return `${fmt(start)}–${fmt(end)}${yearSuffix}`;
}

function makeRangeFromDays(days: number) {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());
  start.setTime(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function getDefaultRange() {
  return makeRangeFromDays(30);
}

function entryDateIso(date: string): string | null {
  if (!date || date === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return formatLocalDate(d);
}

function isDateInRange(date: string, start: Date, end: Date) {
  const iso = entryDateIso(date);
  if (!iso) return false;
  return iso >= formatLocalDate(start) && iso <= formatLocalDate(end);
}

function formatHoursDisplay(hours: number) {
  if (hours <= 0) return "0h";
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatClockTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function downloadCsv(entries: TimesheetEntry[], attendance: AttendanceEntry[]) {
  const header = "Type,Project,Date,Hours,Person,Clock In,Clock Out,Notes\n";
  const projectRows = entries.map(e =>
    [
      "Project",
      `"${e.projectName.replace(/"/g, '""')}"`,
      `"${formatEntryDate(e.date)}"`,
      e.hours,
      `"${e.employee.replace(/"/g, '""')}"`,
      "",
      "",
      `"${e.description.replace(/"/g, '""')}"`,
    ].join(",")
  );
  const attendanceRows = attendance.map(a =>
    [
      "Office",
      "Office Attendance",
      `"${formatEntryDate(a.date)}"`,
      a.hours,
      `"${a.employee.replace(/"/g, '""')}"`,
      `"${formatClockTime(a.clockIn)}"`,
      a.clockOut ? `"${formatClockTime(a.clockOut)}"` : "",
      `"${(a.notes || "Office attendance").replace(/"/g, '""')}"`,
    ].join(",")
  );
  const blob = new Blob([header + [...attendanceRows, ...projectRows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheets-${formatIso(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const selectCls =
  "bg-[#1a2e2a] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-[#e2e8f7] outline-none focus:border-emerald-500/50 font-['Plus_Jakarta_Sans'] cursor-pointer appearance-none min-w-[130px]";
const inputCls =
  "w-full bg-[#1a2e2a] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-emerald-500/50 font-['Plus_Jakarta_Sans']";
const formInputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5";

type TimeTab = "office" | "project";

export function TimesheetView({
  userRole = "employee",
  userName = "",
  initialProjectId,
  initialTab,
  onNavConsumed,
}: {
  userRole?: string;
  userName?: string;
  initialProjectId?: string;
  initialTab?: TimeTab;
  onNavConsumed?: () => void;
}) {
  const { data: profiles, loading: pLoading, error: pError } = useEmployeeProfiles();
  const { data: projects, loading: prLoading, error: prError, refresh: refreshProjects } = useProjects();
  const { data: entries, loading: tLoading, error: tError, refresh: refreshTimesheets } = useTimesheets();
  const { data: attendance, loading: aLoading, error: aError } = useAttendance();

  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 60 | "custom">(30);
  const [rangeStart, setRangeStart] = useState(defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(defaultRange.end);
  const [timeTab, setTimeTab] = useState<TimeTab>("office");
  const [personFilter, setPersonFilter] = useState("everyone");
  const [projectFilter, setProjectFilter] = useState("all");
  const [textFilter, setTextFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    projectId: "",
    date: formatIso(new Date()),
    hours: "8",
    description: "",
  });
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [editForm, setEditForm] = useState({ date: "", hours: "", description: "" });
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loading = pLoading || prLoading || tLoading || aLoading;
  const error = pError || prError || tError || aError;

  const visibleProfiles = useMemo(() => {
    if (isAdminRole(userRole)) return profiles;
    return profiles.filter(p => !isExecutiveProfile(p));
  }, [profiles, userRole]);

  useEffect(() => {
    if (isAdminRole(userRole)) return;
    const mine = visibleProfiles.find(p => p.name.toLowerCase() === userName.toLowerCase());
    if (mine) setPersonFilter(mine.name);
  }, [visibleProfiles, userName, userRole]);

  useEffect(() => {
    if (!initialTab && !initialProjectId) return;
    if (initialTab) setTimeTab(initialTab);
    if (initialProjectId) {
      setTimeTab("project");
      setProjectFilter(initialProjectId);
    }
    onNavConsumed?.();
  }, [initialTab, initialProjectId, onNavConsumed]);

  const activeEmployee = useMemo(() => {
    if (personFilter === "everyone") {
      return visibleProfiles.find(p => p.name.toLowerCase() === userName.toLowerCase()) ?? visibleProfiles[0];
    }
    return visibleProfiles.find(p => p.name === personFilter) ?? visibleProfiles[0];
  }, [personFilter, visibleProfiles, userName]);

  const employeeProjects = useMemo(() => {
    const emp = activeEmployee;
    if (!emp) return projects;
    const mine = projects.filter(
      p =>
        p.team.some(m => m.toLowerCase() === emp.name.toLowerCase()) ||
        p.lead.toLowerCase() === emp.name.toLowerCase()
    );
    return mine;
  }, [projects, activeEmployee]);

  const filteredEntries = useMemo(() => {
    let list = [...entries];

    if (personFilter !== "everyone") {
      list = list.filter(
        e => e.employee.toLowerCase() === personFilter.toLowerCase()
      );
    } else if (!isAdminRole(userRole)) {
      const names = new Set(visibleProfiles.map(p => p.name.toLowerCase()));
      list = list.filter(e => names.has(e.employee.toLowerCase()));
    }

    if (projectFilter !== "all") {
      const projectName = projects.find(p => p.id === projectFilter)?.name?.toLowerCase();
      list = list.filter(
        e =>
          e.projectId === projectFilter ||
          (projectName && e.projectName.toLowerCase() === projectName)
      );
    }

    list = list.filter(e => isDateInRange(e.date, rangeStart, rangeEnd));

    if (textFilter.trim()) {
      const q = textFilter.toLowerCase();
      list = list.filter(
        e =>
          e.description.toLowerCase().includes(q) ||
          (e.workNotes || "").toLowerCase().includes(q) ||
          (e.taskTitle || "").toLowerCase().includes(q) ||
          e.employee.toLowerCase().includes(q) ||
          e.projectName.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, personFilter, projectFilter, rangeStart, rangeEnd, textFilter, userRole, visibleProfiles, projects]);

  const filteredAttendance = useMemo(() => {
    let list = [...attendance];

    if (personFilter !== "everyone") {
      list = list.filter(a => namesMatch(a.employee, personFilter));
    } else if (!isAdminRole(userRole)) {
      list = list.filter(a => namesMatch(a.employee, userName));
    }

    list = list.filter(a => isDateInRange(a.date, rangeStart, rangeEnd));

    if (textFilter.trim()) {
      const q = textFilter.toLowerCase();
      list = list.filter(
        a =>
          a.employee.toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.date.localeCompare(a.date) || b.clockIn.localeCompare(a.clockIn));
  }, [attendance, personFilter, rangeStart, rangeEnd, textFilter, userRole, userName]);

  const employeeTotals = useMemo(() => {
    const map = new Map<
      string,
      { name: string; officeHours: number; projectHours: number; days: Set<string> }
    >();

    for (const row of filteredAttendance) {
      const key = row.employee.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: row.employee, officeHours: 0, projectHours: 0, days: new Set() });
      }
      const item = map.get(key)!;
      item.officeHours += row.hours;
      if (row.hours > 0) item.days.add(row.date);
    }

    for (const row of filteredEntries) {
      const key = row.employee.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: row.employee, officeHours: 0, projectHours: 0, days: new Set() });
      }
      map.get(key)!.projectHours += row.hours;
    }

    return Array.from(map.values())
      .map(e => ({
        ...e,
        totalHours: e.officeHours + e.projectHours,
        daysWorked: e.days.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name));
  }, [filteredAttendance, filteredEntries]);

  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, AttendanceEntry[]>();
    for (const row of filteredAttendance) {
      const key = row.employee;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAttendance]);

  const groupedByProject = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    for (const entry of filteredEntries) {
      const key = entry.projectName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEntries]);

  const totalProjectHours = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.hours, 0),
    [filteredEntries]
  );

  const totalOfficeHours = useMemo(
    () => filteredAttendance.reduce((sum, a) => sum + a.hours, 0),
    [filteredAttendance]
  );

  const activeTabHours = timeTab === "office" ? totalOfficeHours : totalProjectHours;
  const activeTabEntryCount =
    timeTab === "office" ? filteredAttendance.length : filteredEntries.length;

  const rangePresets = [
    { label: "Last 7 days", days: 7 as const },
    { label: "Last 30 days", days: 30 as const },
    { label: "Last 60 days", days: 60 as const },
  ];

  function applyRangePreset(days: 7 | 30 | 60) {
    const { start, end } = makeRangeFromDays(days);
    setRangeDays(days);
    setRangeStart(start);
    setRangeEnd(end);
  }

  function applyCustomRange(startIso: string, endIso: string) {
    if (!startIso || !endIso) return;
    const start = startOfDay(parseLocalDate(startIso));
    const end = endOfDay(parseLocalDate(endIso));
    if (start > end) return;
    setRangeDays("custom");
    setRangeStart(start);
    setRangeEnd(end);
  }

  function clearFilters() {
    applyRangePreset(30);
    setProjectFilter("all");
    setTextFilter("");
    if (isAdminRole(userRole)) {
      setPersonFilter("everyone");
    } else {
      const mine = visibleProfiles.find(p => p.name.toLowerCase() === userName.toLowerCase());
      setPersonFilter(mine?.name || visibleProfiles[0]?.name || "");
    }
  }

  const hasActiveFilters =
    projectFilter !== "all" ||
    textFilter.trim() !== "" ||
    rangeDays !== 30 ||
    (isAdminRole(userRole) && personFilter !== "everyone");

  function canEditEntry(entry: TimesheetEntry) {
    if (isAdminRole(userRole)) return true;
    return namesMatch(entry.employee, userName);
  }

  function openEditEntry(entry: TimesheetEntry) {
    const iso = entryDateIso(entry.date) || formatIso(new Date());
    setEditingEntry(entry);
    setEditForm({
      date: iso,
      hours: String(entry.hours),
      description: (entry.workNotes || entry.description || "").trim(),
    });
    setEditError("");
  }

  function closeEditEntry() {
    setEditingEntry(null);
    setEditError("");
    setDeleting(false);
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    if (!editForm.description.trim()) {
      setEditError("Notes are required.");
      return;
    }
    const hours = parseFloat(editForm.hours);
    if (!hours || hours <= 0) {
      setEditError("Enter valid hours.");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      await saveTimesheetEntryEdit({
        projectId: editingEntry.projectId,
        entryId: editingEntry.id,
        kind: editingEntry.kind,
        taskId: editingEntry.taskId,
        date: editForm.date,
        hours,
        description: editForm.description.trim(),
      });
      closeEditEntry();
      refreshProjects();
      refreshTimesheets();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry() {
    if (!editingEntry || editingEntry.kind !== "manual") return;
    if (!window.confirm("Delete this time entry? This cannot be undone.")) return;
    setDeleting(true);
    setEditError("");
    try {
      await deleteTimesheetEntry({
        projectId: editingEntry.projectId,
        entryId: editingEntry.id,
      });
      closeEditEntry();
      refreshProjects();
      refreshTimesheets();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveEntry() {
    const logAs = personFilter === "everyone" ? activeEmployee : activeEmployee;
    if (!logAs || !form.projectId || !form.description.trim()) {
      setFormError("Project and notes are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await addTimesheetEntry({
        projectId: form.projectId,
        employee: logAs.name,
        employeeId: logAs.id,
        date: form.date,
        hours: parseFloat(form.hours) || 0,
        description: form.description.trim(),
      });
      setShowForm(false);
      setForm({ projectId: "", date: formatIso(new Date()), hours: "8", description: "" });
      refreshProjects();
      refreshTimesheets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save timesheet");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DataLoading label="Loading timesheets..." />;
  if (error) return <DataError message={error} />;
  if (visibleProfiles.length === 0) {
    return <DataEmpty message="No employee timesheet available for your access level." />;
  }

  const showWorkGuide = isPersonalTaskRole(userRole);

  return (
    <div className="space-y-0 -mx-2">
      {showWorkGuide && (
        <div className="px-2 pb-4">
          <WorkFlowGuide compact />
        </div>
      )}
      {/* Header */}
      <div className="px-2 pb-4">
        <p className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider mb-1">
          {timeTab === "office"
            ? "Clock In / Out · Office attendance"
            : "Project work · Manual log & completed tasks"}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">
            {timeTab === "office" ? "Office Attendance" : "Project Time"}
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 border ${
                timeTab === "office"
                  ? "bg-indigo-500/15 border-indigo-500/30"
                  : "bg-emerald-500/15 border-emerald-500/30"
              }`}
            >
              {timeTab === "office" ? (
                <Clock size={16} className="text-indigo-400" />
              ) : (
                <Briefcase size={16} className="text-emerald-400" />
              )}
              <span
                className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${
                  timeTab === "office" ? "text-indigo-300" : "text-emerald-300"
                }`}
              >
                {formatHoursDisplay(activeTabHours)} total
              </span>
            </div>
            {timeTab === "project" && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-semibold transition-colors"
              >
                <Plus size={15} /> Log Time
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setTimeTab("office")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-['Plus_Jakarta_Sans'] border transition-all ${
              timeTab === "office"
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-200"
                : "bg-[#0d1326] border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-white"
            }`}
          >
            <Clock size={15} />
            Office Attendance
            <span className="text-[10px] font-['Geist_Mono'] opacity-80">
              {formatHoursDisplay(totalOfficeHours)} · {filteredAttendance.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTimeTab("project")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold font-['Plus_Jakarta_Sans'] border transition-all ${
              timeTab === "project"
                ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-200"
                : "bg-[#0d1326] border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-white"
            }`}
          >
            <Briefcase size={15} />
            Project Log Time
            <span className="text-[10px] font-['Geist_Mono'] opacity-80">
              {formatHoursDisplay(totalProjectHours)} · {filteredEntries.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-2 pb-4 flex flex-wrap items-center gap-3">
        <select
          value={personFilter}
          onChange={e => setPersonFilter(e.target.value)}
          className={selectCls}
        >
          {isAdminRole(userRole) && <option value="everyone">Everyone</option>}
          {visibleProfiles.map(p => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {timeTab === "project" && (
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className={selectCls}
          >
            <option value="all">All projects</option>
            {[...new Set(entries.map(e => e.projectId))].map(pid => {
              const p = projects.find(pr => pr.id === pid);
              const name = p?.name || entries.find(e => e.projectId === pid)?.projectName || pid;
              return (
                <option key={pid} value={pid}>
                  {name}
                </option>
              );
            })}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangeDays === "custom" ? "custom" : String(rangeDays)}
            onChange={e => {
              const v = e.target.value;
              if (v === "custom") {
                setRangeDays("custom");
                return;
              }
              applyRangePreset(Number(v) as 7 | 30 | 60);
            }}
            className={selectCls}
          >
            {rangePresets.map(p => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom range</option>
          </select>
          <span className="text-xs text-emerald-400/80 font-['Geist_Mono'] whitespace-nowrap">
            {formatRangeLabel(rangeStart, rangeEnd)}
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={formatLocalDate(rangeStart)}
              max={formatLocalDate(rangeEnd)}
              onChange={e => applyCustomRange(e.target.value, formatLocalDate(rangeEnd))}
              className={`${selectCls} min-w-[140px] text-xs`}
              title="From date"
            />
            <span className="text-[#6b7fa8] text-xs">to</span>
            <input
              type="date"
              value={formatLocalDate(rangeEnd)}
              min={formatLocalDate(rangeStart)}
              onChange={e => applyCustomRange(formatLocalDate(rangeStart), e.target.value)}
              className={`${selectCls} min-w-[140px] text-xs`}
              title="To date"
            />
          </div>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
          <input
            value={textFilter}
            onChange={e => setTextFilter(e.target.value)}
            placeholder="Filter..."
            className={`${inputCls} pl-9`}
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-[#6b7fa8] hover:text-white font-['Plus_Jakarta_Sans'] px-2 py-1 rounded-lg border border-emerald-500/20"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-[#6b7fa8] font-['Geist_Mono'] ml-auto">
          {activeTabEntryCount} {activeTabEntryCount === 1 ? "entry" : "entries"}
        </span>

        <button
          type="button"
          onClick={() =>
            downloadCsv(
              timeTab === "project" ? filteredEntries : [],
              timeTab === "office" ? filteredAttendance : []
            )
          }
          className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-['Plus_Jakarta_Sans'] transition-colors"
        >
          <Download size={14} />
          Download CSV
        </button>
      </div>

      {/* Employee summary — CEO sees everyone's total per tab */}
      {isAdminRole(userRole) &&
        personFilter === "everyone" &&
        employeeTotals.length > 0 &&
        timeTab === "office" && (
        <div className="px-2 pb-6">
          <div className="bg-[#131a35]/60 border border-indigo-500/20 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-indigo-500/20 bg-[#0f1530]/80">
              <span className="text-[10px] font-['Geist_Mono'] text-indigo-400/80 uppercase tracking-widest">
                Team Office Hours
              </span>
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] ml-3">
                {formatRangeLabel(rangeStart, rangeEnd)}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_120px_120px] border-b border-indigo-500/15 bg-[#0f1530]/40">
              {["Employee", "Days", "Office Hours"].map((col, i) => (
                <div
                  key={col}
                  className={`px-5 py-2.5 text-[10px] font-['Geist_Mono'] text-indigo-400/70 uppercase tracking-wider ${
                    i > 0 ? "border-l border-dashed border-indigo-500/15 text-right" : ""
                  }`}
                >
                  {col}
                </div>
              ))}
            </div>
            {employeeTotals
              .filter(emp => emp.officeHours > 0)
              .map(emp => (
              <div
                key={emp.name}
                className="grid grid-cols-[1fr_120px_120px] border-b border-indigo-500/10 hover:bg-indigo-500/5 transition-colors"
              >
                <div className="px-5 py-3 flex items-center gap-2">
                  <Avatar
                    initials={emp.name.slice(0, 2).toUpperCase()}
                    size="sm"
                    color="bg-gradient-to-br from-indigo-600 to-violet-600"
                  />
                  <p className="text-sm text-white font-['Plus_Jakarta_Sans']">{emp.name}</p>
                </div>
                <div className="px-5 py-3 text-sm text-[#a8b5d1] font-['Geist_Mono'] text-right border-l border-dashed border-indigo-500/10">
                  {emp.daysWorked}
                </div>
                <div className="px-5 py-3 text-sm font-bold text-indigo-300 font-['Geist_Mono'] text-right border-l border-dashed border-indigo-500/10">
                  {formatHoursDisplay(emp.officeHours)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdminRole(userRole) &&
        personFilter === "everyone" &&
        employeeTotals.length > 0 &&
        timeTab === "project" && (
        <div className="px-2 pb-6">
          <div className="bg-[#1a2e2a]/60 border border-emerald-500/20 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-emerald-500/20 bg-[#152622]/80">
              <span className="text-[10px] font-['Geist_Mono'] text-emerald-400/80 uppercase tracking-widest">
                Team Project Hours
              </span>
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] ml-3">
                {formatRangeLabel(rangeStart, rangeEnd)}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_120px] border-b border-emerald-500/15 bg-[#152622]/40">
              {["Employee", "Project Hours"].map((col, i) => (
                <div
                  key={col}
                  className={`px-5 py-2.5 text-[10px] font-['Geist_Mono'] text-emerald-400/70 uppercase tracking-wider ${
                    i > 0 ? "border-l border-dashed border-emerald-500/15 text-right" : ""
                  }`}
                >
                  {col}
                </div>
              ))}
            </div>
            {employeeTotals
              .filter(emp => emp.projectHours > 0)
              .map(emp => (
              <div
                key={emp.name}
                className="grid grid-cols-[1fr_120px] border-b border-emerald-500/10 hover:bg-emerald-500/5 transition-colors"
              >
                <div className="px-5 py-3 flex items-center gap-2">
                  <Avatar
                    initials={emp.name.slice(0, 2).toUpperCase()}
                    size="sm"
                    color="bg-gradient-to-br from-emerald-600 to-teal-600"
                  />
                  <p className="text-sm text-white font-['Plus_Jakarta_Sans']">{emp.name}</p>
                </div>
                <div className="px-5 py-3 text-sm font-bold text-emerald-300 font-['Geist_Mono'] text-right border-l border-dashed border-emerald-500/10">
                  {formatHoursDisplay(emp.projectHours)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 px-2">
        {timeTab === "office" && groupedByEmployee.map(([employeeName, rows]) => {
          const empHours = rows.reduce((sum, r) => sum + r.hours, 0);
          return (
            <div
              key={`att-${employeeName}`}
              className="bg-[#131a35]/40 border border-indigo-500/15 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-indigo-500/20 bg-[#0f1530]/80 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-['Geist_Mono'] text-indigo-400/80 uppercase tracking-widest mr-3">
                    Office Attendance
                  </span>
                  <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {employeeName}
                  </span>
                  <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] ml-2">
                    ({rows.length} {rows.length === 1 ? "day" : "days"})
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 rounded-full px-3 py-1.5 shrink-0">
                  <Clock size={13} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300 font-['Plus_Jakarta_Sans']">
                    {formatHoursDisplay(empHours)} total
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[140px_80px_120px_120px_1fr] border-b-2 border-indigo-500/25 bg-[#0f1530]/50">
                {["Date", "Hours", "Clock In", "Clock Out", "Status"].map((col, i) => (
                  <div
                    key={col}
                    className={`px-5 py-3 text-[10px] font-['Geist_Mono'] text-indigo-400/80 uppercase tracking-wider ${
                      i > 0 ? "border-l border-dashed border-indigo-500/15" : ""
                    }`}
                  >
                    {col}
                  </div>
                ))}
              </div>

              {rows.map(row => (
                <div
                  key={row.id}
                  className="grid grid-cols-[140px_80px_120px_120px_1fr] border-b border-indigo-500/10 hover:bg-indigo-500/5 transition-colors"
                >
                  <div className="px-5 py-4 text-sm text-[#c8d4e8] font-['Plus_Jakarta_Sans'] border-r border-dashed border-indigo-500/10">
                    {formatEntryDate(row.date)}
                  </div>
                  <div className="px-5 py-4 text-sm font-semibold text-white font-['Geist_Mono'] border-r border-dashed border-indigo-500/10">
                    {formatHoursDisplay(row.hours)}
                  </div>
                  <div className="px-5 py-4 text-sm text-[#c8d4e8] font-['Geist_Mono'] border-r border-dashed border-indigo-500/10">
                    {formatClockTime(row.clockIn)}
                  </div>
                  <div className="px-5 py-4 text-sm text-[#c8d4e8] font-['Geist_Mono'] border-r border-dashed border-indigo-500/10">
                    {row.clockOut ? formatClockTime(row.clockOut) : "—"}
                  </div>
                  <div className="px-5 py-4 text-sm font-['Plus_Jakarta_Sans']">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : row.status === "paused"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-[#1a2e2a] text-[#a8b5d1] border border-emerald-500/15"
                      }`}
                    >
                      {row.status === "active"
                        ? "Clocked In"
                        : row.status === "paused"
                          ? row.notes?.replace(/^Break:\s*/, "On Break") || "On Break"
                          : "Completed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {timeTab === "office" && groupedByEmployee.length === 0 && (
          <div className="bg-[#131a35]/60 border border-indigo-500/15 rounded-xl p-12 text-center">
            <p className="text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-1">
              No office attendance for this period.
            </p>
            <p className="text-xs text-[#6b7fa8] font-['Geist_Mono']">
              {personFilter !== "everyone" ? personFilter : "Everyone"} · {formatRangeLabel(rangeStart, rangeEnd)}
            </p>
            <p className="text-xs text-indigo-400/80 font-['Plus_Jakarta_Sans'] mt-3">
              Use Dashboard → Clock In / Out to record office time.
            </p>
          </div>
        )}

        {timeTab === "project" && groupedByProject.length === 0 && (
          <div className="bg-[#1a2e2a]/60 border border-emerald-500/15 rounded-xl p-12 text-center">
            <p className="text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-1">
              No project time logged for this period.
            </p>
            <p className="text-xs text-[#6b7fa8] font-['Geist_Mono'] mb-3">
              {personFilter !== "everyone" ? personFilter : "Everyone"}
              {" · "}
              {projectFilter === "all"
                ? "All projects"
                : projects.find(p => p.id === projectFilter)?.name || "Project"}
              {" · "}
              {formatRangeLabel(rangeStart, rangeEnd)}
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold"
            >
              + Log your first project entry
            </button>
          </div>
        )}

        {timeTab === "project" && groupedByProject.map(([projectName, projectEntries]) => {
            const projectHours = projectEntries.reduce((sum, e) => sum + e.hours, 0);
            return (
            <div
              key={projectName}
              className="bg-[#1a2e2a]/40 border border-emerald-500/15 rounded-xl overflow-hidden"
            >
              {/* Project header */}
              <div className="px-5 py-3 border-b border-emerald-500/20 bg-[#152622]/80 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-['Geist_Mono'] text-emerald-500/70 uppercase tracking-widest mr-3">
                    Project
                  </span>
                  <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {projectName}
                  </span>
                  <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] ml-2">
                    ({projectEntries.length} {projectEntries.length === 1 ? "entry" : "entries"})
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5 shrink-0">
                  <Clock size={13} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300 font-['Plus_Jakarta_Sans']">
                    {projectHours.toFixed(2)}h total
                  </span>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[140px_80px_160px_1fr_72px] border-b-2 border-emerald-500/30 bg-[#152622]/50">
                {["Date", "Hours", "Person", "Notes", ""].map((col, i) => (
                  <div
                    key={col}
                    className={`px-5 py-3 text-[10px] font-['Geist_Mono'] text-emerald-400/80 uppercase tracking-wider ${
                      i > 0 ? "border-l border-dashed border-emerald-500/15" : ""
                    }`}
                  >
                    {col}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {projectEntries.map(entry => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[140px_80px_160px_1fr_72px] border-b border-emerald-500/10 hover:bg-emerald-500/5 transition-colors group"
                >
                  <div className="px-5 py-4 text-sm text-[#c8d4e8] font-['Plus_Jakarta_Sans'] border-r border-dashed border-emerald-500/10">
                    {formatEntryDate(entry.date)}
                  </div>
                  <div className="px-5 py-4 text-sm font-semibold text-white font-['Geist_Mono'] border-r border-dashed border-emerald-500/10">
                    {entry.hours}
                  </div>
                  <div className="px-5 py-4 border-r border-dashed border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <Avatar
                        initials={entry.employee.slice(0, 2).toUpperCase()}
                        size="sm"
                        color="bg-gradient-to-br from-emerald-600 to-teal-600"
                      />
                      <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">
                        {entry.employee}
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4 text-sm font-['Plus_Jakarta_Sans'] leading-relaxed">
                    {entry.taskTitle && (
                      <p className="text-[11px] text-sky-400 mb-1.5">
                        <span className="text-[#6b7fa8]">
                          {formatTaskStatusLabel(entry.taskStatus)}:{" "}
                        </span>
                        {entry.taskTitle}
                      </p>
                    )}
                    <p className="text-[#e2e8f7] whitespace-pre-wrap">
                      {entry.workNotes || entry.description}
                    </p>
                  </div>
                  <div className="px-2 py-4 flex items-center justify-center border-l border-dashed border-emerald-500/10">
                    {canEditEntry(entry) && (
                      <button
                        type="button"
                        onClick={() => openEditEntry(entry)}
                        title="Edit entry"
                        className="p-2 rounded-lg text-[#6b7fa8] hover:text-emerald-400 hover:bg-emerald-500/10 opacity-70 group-hover:opacity-100 transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Project subtotal row */}
              <div className="grid grid-cols-[140px_80px_160px_1fr_72px] bg-[#152622]/60 border-t border-emerald-500/20">
                <div className="px-5 py-3 text-xs font-semibold text-[#a8b5d1] font-['Plus_Jakarta_Sans']">
                  Subtotal
                </div>
                <div className="px-5 py-3 text-sm font-bold text-emerald-400 font-['Geist_Mono'] border-l border-dashed border-emerald-500/15">
                  {projectHours.toFixed(2)}h
                </div>
                <div className="col-span-3 border-l border-dashed border-emerald-500/15" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit entry modal */}
      {editingEntry && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closeEditEntry}
        >
          <div
            className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-1 font-['Plus_Jakarta_Sans']">
              Edit Time Entry
            </h3>
            <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
              {editingEntry.projectName}
              {editingEntry.taskTitle ? ` · ${editingEntry.taskTitle}` : ""}
            </p>
            {editingEntry.kind === "task" && (
              <p className="mb-3 text-[11px] text-sky-400/90 font-['Plus_Jakarta_Sans']">
                Linked to a project task — hours and notes update the task record (any status).
              </p>
            )}
            {editError && <p className="mb-3 text-xs text-rose-400">{editError}</p>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className={formInputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hours *</label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={editForm.hours}
                    onChange={e => setEditForm({ ...editForm, hours: e.target.value })}
                    className={formInputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes *</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  className={`${formInputCls} resize-none`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-6">
              {editingEntry.kind === "manual" ? (
                <button
                  type="button"
                  onClick={handleDeleteEntry}
                  disabled={deleting || saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-60"
                >
                  <Trash2 size={13} /> {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditEntry}
                  className="px-4 py-2 text-xs text-[#6b7fa8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving || deleting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl"
                >
                  <Save size={13} /> {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log time modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-4 font-['Plus_Jakarta_Sans']">
              Log Time — {activeEmployee?.name}
            </h3>
            {formError && <p className="mb-3 text-xs text-rose-400">{formError}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Project *</label>
                <select
                  value={form.projectId}
                  onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className={formInputCls}
                >
                  <option value="">Select project</option>
                  {(employeeProjects.length ? employeeProjects : projects).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className={formInputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hours *</label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={form.hours}
                    onChange={e => setForm({ ...form, hours: e.target.value })}
                    className={formInputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="What did you work on? e.g. Fixed filter issue on dashboard"
                  className={`${formInputCls} resize-none`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs text-[#6b7fa8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEntry}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl"
              >
                <Save size={13} /> {saving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
