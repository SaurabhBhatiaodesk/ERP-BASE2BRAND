import React, { useMemo, useState } from "react";
import { FolderOpen, Search, Star, Edit2, X, Target, Settings, Users, Plus } from "lucide-react";
import { Avatar } from "../ui";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useEmployeeProfiles, useProjectTasks, useProjects } from "@/hooks/useSupabaseData";
import {
  filterTasksForUser,
  findProfileForUser,
  getEmployeeProjects,
  namesMatch,
  updateProjectDetails,
  assignProjectTeam,
  type EmployeeProfile,
  type Project,
} from "@/lib/database";
import { isAdminRole } from "@/lib/auth";

const FAVORITES_KEY = "b2b_project_favorites";

const CARD_ACCENTS = [
  "from-[#1a2d4a] to-[#121c30]",
  "from-[#1a3344] to-[#101820]",
  "from-[#2a2440] to-[#161022]",
  "from-[#1a2e2a] to-[#101a18]",
  "from-[#2e2418] to-[#1a140e]",
  "from-[#2a1a2e] to-[#18101c]",
];

const AVATAR_COLORS = [
  "bg-gradient-to-br from-rose-500 to-pink-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-sky-500 to-indigo-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
];

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function cardAccent(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % CARD_ACCENTS.length;
  return CARD_ACCENTS[hash];
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function memberPhoto(profiles: EmployeeProfile[], memberName: string) {
  return profiles.find(p => namesMatch(p.name, memberName))?.profileImageUrl || "";
}

function statusStyle(status: string) {
  const s = status.toLowerCase();
  if (s.includes("progress")) return "bg-indigo-500/20 text-indigo-300 border-indigo-500/25";
  if (s.includes("ready-for-test") || s.includes("review")) {
    return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  }
  if (s.includes("complete") || s.includes("done")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  return "bg-white/5 text-[#a8b5d1] border-white/10";
}

function ProjectCard({
  project,
  profiles,
  favorite,
  openTasks,
  onToggleFavorite,
  onClick,
  onClickEdit,
}: {
  project: Project;
  profiles: EmployeeProfile[];
  favorite: boolean;
  openTasks: number;
  onToggleFavorite: () => void;
  onClick: () => void;
  onClickEdit?: () => void;
}) {
  const team = project.team.length > 0 ? project.team : [project.lead].filter(Boolean);
  const visibleTeam = team.slice(0, 6);
  const overflow = team.length - visibleTeam.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col text-left w-full min-h-[176px] rounded-2xl border border-white/[0.08] bg-gradient-to-br ${cardAccent(project.id)} p-5 shadow-lg shadow-black/30 hover:border-indigo-400/40 hover:shadow-indigo-500/15 hover:-translate-y-1 transition-all duration-200`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className={`inline-flex text-[10px] font-semibold font-['Plus_Jakarta_Sans'] px-2 py-0.5 rounded-full border ${statusStyle(project.status)}`}
        >
          {project.status || "Active"}
        </span>
        <div className="flex items-center gap-1">
          {onClickEdit && (
            <div
              role="button"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                onClickEdit();
              }}
              className="p-1 rounded-md text-[#6b7fa8] hover:text-white hover:bg-white/5 transition-colors"
              title="Edit Project"
            >
              <Edit2 size={15} />
            </div>
          )}
          <div
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }
            }}
            className="p-1 -mr-1 rounded-md text-[#6b7fa8] hover:text-amber-400 transition-colors"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={16}
              className={favorite ? "fill-amber-400 text-amber-400" : "opacity-45 group-hover:opacity-100"}
            />
          </div>
        </div>
      </div>

      <h3 className="text-[17px] font-bold text-white font-['Plus_Jakarta_Sans'] leading-snug line-clamp-2 pr-1">
        {project.name}
      </h3>
      <p className="text-xs text-[#8b9cc4] font-['Plus_Jakarta_Sans'] mt-1 truncate">
        {project.client || "Base2Brand"}
      </p>

      {openTasks > 0 && (
        <p className="text-[11px] text-indigo-300/90 font-['Geist_Mono'] mt-3">
          {openTasks} open task{openTasks === 1 ? "" : "s"}
        </p>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
        <div className="flex items-center">
          {visibleTeam.map((member, i) => (
            <div
              key={`${project.id}-${member}`}
              className={`rounded-full ring-2 ring-[#101828] ${i > 0 ? "-ml-2.5" : ""}`}
              style={{ zIndex: visibleTeam.length - i }}
            >
              <Avatar
                initials={memberInitials(member)}
                src={memberPhoto(profiles, member) || undefined}
                size="sm"
                color={avatarColor(member)}
              />
            </div>
          ))}
          {overflow > 0 && (
            <span className="ml-2 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">+{overflow}</span>
          )}
        </div>
        <span className="text-[11px] font-['Geist_Mono'] text-[#8b9cc4] shrink-0">
          {team.length} {team.length === 1 ? "person" : "people"}
        </span>
      </div>

      <div className="mt-3 h-1 bg-black/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400/90 rounded-full transition-all"
          style={{ width: `${Math.max(project.progress || 0, project.progress > 0 ? 4 : 0)}%` }}
        />
      </div>
    </button>
  );
}

export function ProjectsView({
  userRole = "employee",
  userName = "",
  userEmail = "",
  onOpenProject,
  onNavigate,
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onOpenProject?: (projectId: string) => void;
  onNavigate?: (view: string, tab?: any) => void;
}) {
  const { data: projects, loading: pLoading, error: pError, refresh: refreshProjects } = useProjects();
  const { data: tasks, loading: tLoading, error: tError } = useProjectTasks();
  const { data: profiles, refresh: refreshProfiles } = useEmployeeProfiles();
  const currentProfile = useMemo(
    () => findProfileForUser(profiles, userName, userEmail),
    [profiles, userName, userEmail]
  );
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const isPersonal = !isAdminRole(userRole);
  const firstName = userName.split(/\s+/)[0] || "there";
  const canEditProject = ["ceo", "teamlead", "manager", "hr"].includes(userRole.toLowerCase());

  const visibleProjects = useMemo(() => {
    if (isAdminRole(userRole)) return projects;
    if (!userName) return projects;
    const mine = getEmployeeProjects(projects, userName, currentProfile?.id);
    return mine;
  }, [projects, userRole, userName, currentProfile?.id]);

  const openTasksByProject = useMemo(() => {
    const scoped = isPersonal && userName
      ? filterTasksForUser(tasks, userName, currentProfile?.id)
      : tasks;
    const map = new Map<string, number>();
    for (const t of scoped) {
      if (!t.projectId || t.status === "done") continue;
      map.set(t.projectId, (map.get(t.projectId) || 0) + 1);
    }
    return map;
  }, [tasks, userName, isPersonal, currentProfile?.id]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...visibleProjects];
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          p.lead.toLowerCase().includes(q) ||
          p.team.some(m => m.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      const af = favorites.has(a.id) ? 1 : 0;
      const bf = favorites.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [visibleProjects, search, favorites]);

  function toggleFavorite(projectId: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      writeFavorites(next);
      return next;
    });
  }

  const loading = pLoading || tLoading;
  const error = pError || tError;

  if (loading) return <DataLoading label="Loading projects..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400/80 mb-1">
            <FolderOpen size={16} />
            <span className="text-[11px] font-['Geist_Mono'] uppercase tracking-wider">
              {isPersonal ? "Your workspace" : "Company projects"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">
            {isPersonal ? `${firstName}'s projects` : "All projects"}
          </h1>
          <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-1">
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"} · tap to open
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/40 font-['Plus_Jakarta_Sans']"
            />
          </div>
          {canEditProject && (
            <button
              onClick={() => onNavigate?.("register", "project")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
            >
              <Plus size={15} /> Add Project
            </button>
          )}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-[#0d1326]/50 border border-[rgba(99,102,241,0.1)] rounded-2xl p-16 text-center">
          <DataEmpty
            message={
              isPersonal
                ? "No projects assigned yet."
                : "No projects yet."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              profiles={profiles}
              favorite={favorites.has(project.id)}
              openTasks={openTasksByProject.get(project.id) || 0}
              onToggleFavorite={() => toggleFavorite(project.id)}
              onClick={() => onOpenProject?.(project.id)}
              onClickEdit={canEditProject ? () => setEditingProject(project) : undefined}
            />
          ))}
        </div>
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          profiles={profiles}
          onClose={() => setEditingProject(null)}
          onSuccess={() => {
            setEditingProject(null);
            refreshProjects();
            refreshProfiles();
          }}
        />
      )}
    </div>
  );
}

function EditProjectModal({
  project,
  profiles,
  onClose,
  onSuccess,
}: {
  project: Project;
  profiles: EmployeeProfile[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    client: project.client || "",
    leadId: project.leadId || "",
    memberIds: project.teamIds || [],
  });
  const [submitting, setSubmitting] = useState(false);
  const employeeOptions = profiles.filter(p => p.role !== "CEO");

  const toggleMember = (id: string) => {
    setForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter(m => m !== id)
        : [...prev.memberIds, id],
    }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await updateProjectDetails(project.id, { name: form.name, client: form.client });

      const leadProfile = profiles.find(p => p.id === form.leadId);
      const memberProfiles = profiles.filter(p => form.memberIds.includes(p.id));
      const teamNames = [
        ...new Set([leadProfile?.name, ...memberProfiles.map(p => p.name)].filter(Boolean)),
      ] as string[];

      await assignProjectTeam(project.id, teamNames, leadProfile?.name, {
        leadId: form.leadId,
        memberIds: [...new Set([form.leadId, ...form.memberIds])].filter(Boolean),
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to update project team: " + (err instanceof Error ? err.message : JSON.stringify(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-[#080c1f] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/40 transition-colors font-['Plus_Jakarta_Sans']";
  const labelCls = "block text-xs font-semibold text-[#8fa0c4] uppercase tracking-wider mb-2 font-['Geist_Mono']";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.25)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[rgba(99,102,241,0.12)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">Edit Project</h2>
              <p className="text-xs text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">Update details and team assignments</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-white/[0.06] rounded-xl transition-colors text-[#8fa0c4] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Project Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Client Name</label>
              <input value={form.client} onChange={e => setForm({...form, client: e.target.value})} className={inputCls} />
            </div>
          </div>

          <div className="pt-4 border-t border-[rgba(99,102,241,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-[#8fa0c4]" />
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Team Assignment</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Project Lead *</label>
                <select value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })} className={inputCls}>
                  <option value="">Select project lead</option>
                  {employeeOptions.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className={labelCls}>Team Members *</label>
                <div className="flex flex-wrap gap-2 p-4 bg-[#131a35] border border-[rgba(99,102,241,0.1)] rounded-xl">
                  {employeeOptions.map(emp => {
                    const isSelected = form.memberIds.includes(emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => toggleMember(emp.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all font-['Plus_Jakarta_Sans'] ${
                          isSelected
                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                            : "border-[rgba(99,102,241,0.15)] text-[#6b7fa8] hover:text-white hover:bg-white/5"
                        }`}>
                        {emp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[rgba(99,102,241,0.12)] bg-[#0a0f1d] shrink-0 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#8fa0c4] hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={submitting || !form.name || !form.leadId}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20">
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
