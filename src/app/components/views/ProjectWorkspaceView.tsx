import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Layers,
} from "lucide-react";
import { Avatar } from "../ui";
import { DataLoading, DataError } from "../ui/DataStatus";
import { TasksView } from "./CRMTasksViews";
import { useEmployeeProfiles, useProjects, useTimesheets } from "@/hooks/useSupabaseData";
import {
  addTimesheetEntry,
  namesMatch,
  type Project,
  type TimesheetEntry,
} from "@/lib/database";
import { isAdminRole } from "@/lib/auth";

type WorkspaceTool = "tasks" | "time";

const DAILY_STANDARD_HOURS = 8;
const WEEKLY_STANDARD_HOURS = 40;

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatEntryDate(date: string) {
  const d = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getWeekStart(d = new Date()) {
  const monday = new Date(d);
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatHours(h: number) {
  if (h <= 0) return "0h";
  return `${Math.round(h * 100) / 100}h`;
}

function projectTeamMembers(project: Project) {
  const members = new Set<string>();
  if (project.lead) members.add(project.lead);
  project.team.forEach(m => members.add(m));
  return [...members].sort((a, b) => a.localeCompare(b));
}

function calcProjectTimeStats(entries: TimesheetEntry[], projectId: string, employee: string) {
  const today = formatLocalDate(new Date());
  const weekStart = formatLocalDate(getWeekStart());
  const mine = entries.filter(
    e => e.projectId === projectId && namesMatch(e.employee, employee)
  );
  const todayHours = mine
    .filter(e => e.date.slice(0, 10) === today)
    .reduce((sum, e) => sum + e.hours, 0);
  const weekHours = mine
    .filter(e => e.date.slice(0, 10) >= weekStart)
    .reduce((sum, e) => sum + e.hours, 0);
  const dailyOvertime = Math.max(0, todayHours - DAILY_STANDARD_HOURS);
  const weeklyOvertime = Math.max(0, weekHours - WEEKLY_STANDARD_HOURS);
  const totalHours = mine.reduce((sum, e) => sum + e.hours, 0);
  return {
    todayHours,
    weekHours,
    totalHours,
    overtime: Math.max(dailyOvertime, weeklyOvertime),
    dailyOvertime,
    weeklyOvertime,
  };
}

function ProjectTrackTimePanel({
  project,
  userName,
  userRole,
  onOpenFullTimesheet,
}: {
  project: Project;
  userName: string;
  userRole: string;
  onOpenFullTimesheet?: () => void;
}) {
  const { data: entries, loading, error, refresh } = useTimesheets();
  const { data: profiles } = useEmployeeProfiles();
  const team = useMemo(() => projectTeamMembers(project), [project]);

  const defaultPerson = useMemo(() => {
    const mine = team.find(m => namesMatch(m, userName));
    return mine || team[0] || userName;
  }, [team, userName]);

  const [person, setPerson] = useState(defaultPerson);
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const projectEntries = useMemo(
    () =>
      entries
        .filter(e => e.projectId === project.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, project.id]
  );

  const stats = useMemo(
    () => calcProjectTimeStats(entries, project.id, person),
    [entries, project.id, person]
  );

  const personProfile = profiles.find(p => namesMatch(p.name, person));
  const canPickPerson = isAdminRole(userRole) || team.length > 1;

  async function handleAdd() {
    const h = parseFloat(hours);
    if (!h || h <= 0) {
      setFormError("Enter valid hours.");
      return;
    }
    if (!person) {
      setFormError("Select a person.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await addTimesheetEntry({
        projectId: project.id,
        employee: person,
        employeeId: personProfile?.id,
        date,
        hours: h,
        description: notes.trim() || `Work on ${project.name}`,
      });
      setHours("");
      setNotes("");
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add time");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DataLoading label="Loading project time..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-2xl overflow-hidden shadow-2xl max-w-5xl mx-auto">
      <div className="px-6 py-5 border-b border-[rgba(99,102,241,0.12)]">
        <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
          Track time spent on this project
        </h2>
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { label: "Today", value: formatHours(stats.todayHours), color: "text-sky-300" },
            { label: "This week", value: formatHours(stats.weekHours), color: "text-indigo-300" },
            { label: "All time", value: formatHours(stats.totalHours), color: "text-emerald-300" },
            {
              label: "Overtime",
              value: formatHours(stats.overtime),
              color: stats.overtime > 0 ? "text-amber-400" : "text-[#6b7fa8]",
            },
          ].map(s => (
            <div
              key={s.label}
              className="bg-[#131a35] border border-[rgba(99,102,241,0.1)] rounded-lg px-3 py-2 min-w-[88px]"
            >
              <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase">{s.label}</p>
              <p className={`text-sm font-bold font-['Geist_Mono'] ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {stats.overtime > 0 && (
          <p className="text-xs text-amber-400/90 font-['Plus_Jakarta_Sans'] mt-3">
            Overtime on this project — today: {formatHours(stats.dailyOvertime)} · week: {formatHours(stats.weeklyOvertime)}
            {" "}(over {DAILY_STANDARD_HOURS}h/day or {WEEKLY_STANDARD_HOURS}h/week)
          </p>
        )}
      </div>

      <div className="grid grid-cols-[120px_72px_140px_1fr_72px] border-b border-[rgba(99,102,241,0.12)] bg-[#080c1f]/60">
        {["Date", "Hours", "Person", "Notes", ""].map((col, i) => (
          <div
            key={col || "action"}
            className={`px-4 py-2.5 text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider ${
              i > 0 ? "border-l border-dashed border-[rgba(99,102,241,0.1)]" : ""
            }`}
          >
            {col}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[120px_72px_140px_1fr_72px] border-b border-[rgba(99,102,241,0.12)] bg-[#131a35]/40">
        <div className="px-3 py-3 border-r border-dashed border-[rgba(99,102,241,0.08)]">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-transparent text-sm text-[#e2e8f7] outline-none font-['Geist_Mono']"
          />
        </div>
        <div className="px-3 py-3 border-r border-dashed border-[rgba(99,102,241,0.08)]">
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent text-sm text-white outline-none font-['Geist_Mono']"
          />
        </div>
        <div className="px-2 py-2 border-r border-dashed border-[rgba(99,102,241,0.08)]">
          {canPickPerson ? (
            <select
              value={person}
              onChange={e => setPerson(e.target.value)}
              className="w-full bg-transparent text-sm text-[#e2e8f7] outline-none font-['Plus_Jakarta_Sans'] cursor-pointer"
            >
              {team.map(m => (
                <option key={m} value={m} className="bg-[#0d1326]">
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 px-1 py-1">
              <Avatar initials={person.slice(0, 2).toUpperCase()} size="sm" />
              <span className="text-sm text-[#e2e8f7] truncate font-['Plus_Jakarta_Sans']">{person}</span>
            </div>
          )}
        </div>
        <div className="px-3 py-3 border-r border-dashed border-[rgba(99,102,241,0.08)]">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full bg-transparent text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none font-['Plus_Jakarta_Sans']"
          />
        </div>
        <div className="px-2 py-2 flex items-center justify-center">
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg font-['Plus_Jakarta_Sans']"
          >
            {saving ? "..." : "Add"}
          </button>
        </div>
      </div>

      {formError && (
        <p className="px-6 py-2 text-xs text-rose-400 font-['Plus_Jakarta_Sans']">{formError}</p>
      )}

      <div className="max-h-[420px] overflow-y-auto">
        {projectEntries.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
            No time logged on this project yet. Add your first entry above.
          </p>
        ) : (
          projectEntries.map(entry => (
            <div
              key={entry.id}
              className="grid grid-cols-[120px_72px_140px_1fr] border-b border-[rgba(99,102,241,0.06)] hover:bg-white/[0.02] transition-colors"
            >
              <div className="px-4 py-4 text-sm text-[#c8d4e8] font-['Plus_Jakarta_Sans'] border-r border-dashed border-[rgba(99,102,241,0.06)]">
                {formatEntryDate(entry.date)}
              </div>
              <div className="px-4 py-4 text-sm font-semibold text-white font-['Geist_Mono'] border-r border-dashed border-[rgba(99,102,241,0.06)]">
                {entry.hours}
              </div>
              <div className="px-3 py-3 border-r border-dashed border-[rgba(99,102,241,0.06)]">
                <div className="flex items-center gap-2">
                  <Avatar initials={entry.employee.slice(0, 2).toUpperCase()} size="sm" />
                  <span className="text-sm text-[#e2e8f7] truncate font-['Plus_Jakarta_Sans']">
                    {entry.employee.split(" ")[0]}
                  </span>
                </div>
              </div>
              <div className="px-4 py-4 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] leading-relaxed whitespace-pre-wrap">
                {entry.workNotes || entry.description}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-4 border-t border-[rgba(99,102,241,0.1)] bg-[#080c1f]/40">
        <button
          type="button"
          onClick={onOpenFullTimesheet}
          className="text-sm text-sky-400 hover:text-sky-300 font-['Plus_Jakarta_Sans'] transition-colors"
        >
          See the full timesheet to edit entries →
        </button>
      </div>
    </div>
  );
}

export function ProjectWorkspaceView({
  projectId,
  userRole = "employee",
  userName = "",
  initialTool = "tasks",
  onBack,
  onOpenFullTimesheet,
}: {
  projectId: string;
  userRole?: string;
  userName?: string;
  initialTool?: WorkspaceTool;
  onBack?: () => void;
  onOpenFullTimesheet?: () => void;
}) {
  const { data: projects, loading, error } = useProjects();
  const [activeTool, setActiveTool] = useState<WorkspaceTool>(initialTool);

  const project = useMemo(
    () => projects.find(p => p.id === projectId) ?? null,
    [projects, projectId]
  );

  if (loading) return <DataLoading label="Loading project..." />;
  if (error) return <DataError message={error} />;
  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-4">Project not found.</p>
        <button type="button" onClick={onBack} className="text-indigo-400 text-sm">
          ← Back to projects
        </button>
      </div>
    );
  }

  const tools: { id: WorkspaceTool; label: string; hint: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: "tasks", label: "Tasks", hint: "To-dos & kanban for this project", icon: Layers },
    { id: "time", label: "Log Time", hint: "Hours spent on this project", icon: Clock },
  ];

  return (
    <div className="space-y-5 -mx-1">
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-sm transition-colors font-['Plus_Jakarta_Sans'] mt-1"
        >
          <ArrowLeft size={16} /> Projects
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans'] truncate">
            {project.name}
          </h1>
          <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">
            {project.client} · Lead: {project.lead} · {project.status}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map(tool => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={`flex flex-col items-start px-4 py-2.5 rounded-xl text-left border transition-all min-w-[140px] ${
                active
                  ? "bg-indigo-600/20 border-indigo-500/40"
                  : "bg-[#0d1326] border-[rgba(99,102,241,0.12)] hover:border-indigo-500/25"
              }`}
            >
              <span className={`flex items-center gap-2 text-sm font-semibold font-['Plus_Jakarta_Sans'] ${active ? "text-indigo-200" : "text-[#a8b5d1]"}`}>
                <Icon size={15} />
                {tool.label}
              </span>
              <span className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5 pl-[23px]">
                {tool.hint}
              </span>
            </button>
          );
        })}
      </div>

      {activeTool === "tasks" && (
        <div className="bg-[#0d1326]/40 border border-[rgba(99,102,241,0.1)] rounded-2xl p-4">
          <TasksView
            userName={userName}
            userRole={userRole}
            fixedProjectId={projectId}
            embedded
          />
        </div>
      )}

      {activeTool === "time" && (
        <ProjectTrackTimePanel
          project={project}
          userName={userName}
          userRole={userRole}
          onOpenFullTimesheet={onOpenFullTimesheet}
        />
      )}
    </div>
  );
}
