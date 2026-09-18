import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Layers, Plus, X, CalendarDays, Flag, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchClientProjects,
  fetchClientProjectTasks,
  fetchClientProjectTeam,
  createClientTask,
  updateClientTaskStatus,
  type ClientPortalProject,
  type ClientPortalTask,
  type ClientPortalTeamMember,
  type ClientTaskStatus,
} from "@/lib/database";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";

// Styles match FeedView/InvoicingView/PayrollView convention.
const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wide font-['Geist_Mono']";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans'] disabled:opacity-50";

// The client board only has 3 columns — simpler than the internal employee
// Kanban's 5 (todo/in-progress/review/ready-for-testing/done). A task the
// team has moved into Review or Ready for QA still needs to show up
// somewhere on the client's board, so it buckets into "In Progress" for
// display; dragging it from there normalizes it down to one of these 3
// statuses via update_client_task_status().
const CLIENT_TASK_DRAG_TYPE = "CLIENT_TASK_CARD";

const CLIENT_BOARD_COLUMNS: { key: ClientTaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "text-slate-300" },
  { key: "in-progress", label: "In Progress", color: "text-amber-300" },
  { key: "done", label: "Complete", color: "text-emerald-300" },
];

function clientColumnForStatus(status: string): ClientTaskStatus {
  if (status === "done") return "done";
  if (status === "todo") return "todo";
  return "in-progress";
}

function TaskCard({
  task, assigneeName,
}: {
  task: ClientPortalTask;
  assigneeName: string;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CLIENT_TASK_DRAG_TYPE,
      item: { taskId: task.id },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [task.id]
  );

  return (
    <div
      ref={node => { drag(node); }}
      className={`px-4 py-3 bg-[#131a35] rounded-xl border border-transparent hover:border-indigo-500/20 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm text-white font-['Plus_Jakarta_Sans']">{task.title}</p>
      <p className="text-xs text-[#6b7fa8] mt-1.5 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
        <UserCircle2 size={12} /> {assigneeName || "Unassigned"}
        {task.due && <span className="ml-2">Due {task.due}</span>}
      </p>
    </div>
  );
}

function TaskColumn({
  col, tasks, teamById, onDropTask,
}: {
  col: { key: ClientTaskStatus; label: string; color: string };
  tasks: ClientPortalTask[];
  teamById: Map<string, string>;
  onDropTask: (taskId: string, status: ClientTaskStatus) => void;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: CLIENT_TASK_DRAG_TYPE,
      drop: (item: { taskId: string }) => onDropTask(item.taskId, col.key),
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [col.key, onDropTask]
  );

  const colTasks = tasks.filter(t => clientColumnForStatus(t.status) === col.key);

  return (
    <div className="shrink-0 w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-sm font-bold ${col.color} font-['Plus_Jakarta_Sans']`}>{col.label}</span>
        <span className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] bg-[#131a35] px-2 py-0.5 rounded-full">
          {colTasks.length}
        </span>
      </div>
      <div
        ref={node => { drop(node); }}
        className={`space-y-2 min-h-[140px] p-1 rounded-xl transition-colors ${
          isOver ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/30" : ""
        }`}
      >
        {colTasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No tasks</div>
        ) : (
          colTasks.map(task => (
            <TaskCard key={task.id} task={task} assigneeName={teamById.get(task.assigneeId || "") || ""} />
          ))
        )}
      </div>
    </div>
  );
}

function AssignTaskModal({
  team, onClose, onCreate,
}: {
  team: ClientPortalTeamMember[];
  onClose: () => void;
  onCreate: (input: { title: string; assigneeId: string; priority: string; due: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(team[0]?.id || "");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !assigneeId) {
      toast.error("Title and assignee are required.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({ title: title.trim(), assigneeId, priority, due });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`${cardCls} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold font-['Plus_Jakarta_Sans']">Assign a Task</h3>
          <button onClick={onClose} className="text-[#6b7fa8] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              className={inputCls}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Assign To</label>
            {team.length === 0 ? (
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                No team members found on this project yet.
              </p>
            ) : (
              <select className={inputCls} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                {team.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" className={inputCls} value={due} onChange={e => setDue(e.target.value)} />
            </div>
          </div>

          <button
            className={`${btnPrimary} w-full justify-center`}
            onClick={submit}
            disabled={saving || team.length === 0}
          >
            {saving ? "Assigning..." : "Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project, active, onSelect,
}: {
  project: ClientPortalProject;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-colors ${
        active
          ? "bg-indigo-600/15 border-indigo-500/30"
          : "bg-[#0d1326] border-[rgba(99,102,241,0.12)] hover:border-indigo-500/20"
      }`}
    >
      <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{project.name}</p>
      <p className="text-xs text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">{project.status}</p>
      <div className="mt-3 h-1.5 bg-[#131a35] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-600 to-indigo-600"
          style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
        />
      </div>
    </button>
  );
}

export function ClientProjectView({ clientName }: { clientName: string }) {
  const [projects, setProjects] = useState<ClientPortalProject[]>([]);
  const [tasks, setTasks] = useState<ClientPortalTask[]>([]);
  const [team, setTeam] = useState<ClientPortalTeamMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchClientProjects();
      setProjects(rows);
      setSelectedProjectId(prev => prev && rows.some(p => p.id === prev) ? prev : rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your project.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const loadProjectDetail = useCallback(async (projectId: string) => {
    try {
      const [taskRows, teamRows] = await Promise.all([
        fetchClientProjectTasks(projectId),
        fetchClientProjectTeam(projectId),
      ]);
      setTasks(taskRows);
      setTeam(teamRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load project details.");
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) void loadProjectDetail(selectedProjectId);
    else { setTasks([]); setTeam([]); }
  }, [selectedProjectId, loadProjectDetail]);

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const handleCreateTask = async (input: { title: string; assigneeId: string; priority: string; due: string }) => {
    if (!selectedProjectId) return;
    const created = await createClientTask({
      projectId: selectedProjectId,
      title: input.title,
      assigneeId: input.assigneeId,
      priority: input.priority,
      due: input.due,
    });
    setTasks(prev => [created, ...prev]);
    toast.success("Task assigned.");
  };

  const teamById = useMemo(() => new Map(team.map(m => [m.id, m.name])), [team]);

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const handleDropTask = useCallback((taskId: string, status: ClientTaskStatus) => {
    const current = tasksRef.current.find(t => t.id === taskId);
    if (!current || clientColumnForStatus(current.status) === status) return;

    const previousStatus = current.status;
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status } : t)));

    void updateClientTaskStatus(taskId, status).catch(err => {
      toast.error(err instanceof Error ? err.message : "Failed to move task.");
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: previousStatus } : t)));
    });
  }, []);

  if (loading) return <DataLoading label="Loading your project..." />;
  if (error) return <DataError message={error} />;
  if (projects.length === 0) {
    return (
      <DataEmpty message="No project has been shared with you yet. Contact your Base2Brand project manager." />
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-3">
        <p className="text-sm text-white font-['Plus_Jakarta_Sans'] px-1">Welcome, {clientName}</p>
        <p className="text-xs font-semibold text-[#6b7fa8] uppercase tracking-wide font-['Geist_Mono'] px-1">
          Your Projects
        </p>
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            active={project.id === selectedProjectId}
            onSelect={() => setSelectedProjectId(project.id)}
          />
        ))}
      </div>

      {selectedProject && (
        <div className="space-y-6">
          <div className={`${cardCls} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">{selectedProject.name}</h2>
                <p className="text-sm text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">{selectedProject.description}</p>
              </div>
              <button className={btnPrimary} onClick={() => setShowAssignModal(true)}>
                <Plus size={16} /> Assign Task
              </button>
            </div>
            <div className="flex items-center gap-6 mt-5 text-xs text-[#6b7fa8] font-['Geist_Mono']">
              <span className="flex items-center gap-1.5"><Flag size={12} /> {selectedProject.priority}</span>
              <span className="flex items-center gap-1.5"><CalendarDays size={12} /> Due {selectedProject.deadline || "—"}</span>
              <span className="flex items-center gap-1.5"><Layers size={12} /> {selectedProject.progress}% complete</span>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">Tasks</h3>
            {tasks.length === 0 ? (
              <DataEmpty message="No tasks yet on this project." />
            ) : (
              <DndProvider backend={HTML5Backend}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {CLIENT_BOARD_COLUMNS.map(col => (
                    <TaskColumn
                      key={col.key}
                      col={col}
                      tasks={tasks}
                      teamById={teamById}
                      onDropTask={handleDropTask}
                    />
                  ))}
                </div>
              </DndProvider>
            )}
          </div>
        </div>
      )}

      {showAssignModal && (
        <AssignTaskModal
          team={team}
          onClose={() => setShowAssignModal(false)}
          onCreate={handleCreateTask}
        />
      )}
    </div>
  );
}
