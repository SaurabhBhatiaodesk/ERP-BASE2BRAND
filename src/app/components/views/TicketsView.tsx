import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Plus, X, Ticket as TicketIcon, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { resolveRoleFromProfile, canTagAnyoneInTicket, isAdminRole } from "@/lib/auth";
import { useProjects, useEmployeeProfiles } from "@/hooks/useSupabaseData";
import {
  fetchAllTickets,
  createTicket,
  updateTicket,
  updateTicketStatus,
  deleteTicket,
  getEmployeeProjects,
  type Ticket,
  type TicketStatus,
  type TicketPriority,
  type Project,
} from "@/lib/database";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wide font-['Geist_Mono']";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans'] disabled:opacity-50";

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  low: "bg-slate-500/15 text-slate-300",
  medium: "bg-amber-500/15 text-amber-300",
  high: "bg-orange-500/15 text-orange-300",
  urgent: "bg-rose-500/15 text-rose-300",
};

const TICKET_DRAG_TYPE = "TICKET_CARD";

const BOARD_COLUMNS: { key: TicketStatus; label: string; color: string }[] = [
  { key: "open", label: "Open", color: "text-slate-300" },
  { key: "in-progress", label: "In Progress", color: "text-amber-300" },
  { key: "resolved", label: "Resolved", color: "text-sky-300" },
  { key: "closed", label: "Closed", color: "text-emerald-300" },
];

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

type TicketFormInput = {
  title: string;
  description: string;
  priority: TicketPriority;
  assigneeIds: string[];
  projectId: string | null;
};

function TicketFormModal({
  mode, initial, taggable, projects, defaultProjectId, onClose, onSubmit, onDelete,
}: {
  mode: "create" | "edit";
  initial?: Ticket;
  taggable: { id: string; name: string }[];
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onSubmit: (input: TicketFormInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [priority, setPriority] = useState<TicketPriority>(initial?.priority || "medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initial?.assigneeIds || []);
  const [projectId, setProjectId] = useState(initial?.projectId ?? defaultProjectId);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => (prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]));
  };

  const selectedPeople = taggable.filter(p => assigneeIds.includes(p.id));
  const filteredTaggable = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return taggable;
    return taggable.filter(p => p.name.toLowerCase().includes(q));
  }, [taggable, assigneeSearch]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), description, priority, assigneeIds, projectId: projectId || null });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ticket.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete ticket.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`${cardCls} w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <TicketIcon size={16} /> {mode === "create" ? "Raise a Ticket" : "Edit Ticket"}
          </h3>
          <button onClick={onClose} className="text-[#6b7fa8] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the issue?" autoFocus />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={`${inputCls} min-h-[90px] resize-none`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add any details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Project</label>
              <select className={inputCls} value={projectId || ""} onChange={e => setProjectId(e.target.value)}>
                <option value="">No Project (General)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tag People</label>
            {taggable.length === 0 ? (
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No one available to tag.</p>
            ) : (
              <>
                {selectedPeople.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedPeople.map(person => (
                      <span
                        key={person.id}
                        className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-indigo-600/15 text-indigo-300 text-xs rounded-full font-['Plus_Jakarta_Sans']"
                      >
                        {person.name}
                        <button
                          type="button"
                          onClick={() => toggleAssignee(person.id)}
                          className="hover:text-white"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
                  <input
                    className={`${inputCls} pl-8`}
                    value={assigneeSearch}
                    onChange={e => setAssigneeSearch(e.target.value)}
                    placeholder="Search people to tag..."
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 bg-[#131a35] rounded-xl p-2">
                  {filteredTaggable.length === 0 ? (
                    <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] px-2 py-1.5">No matches.</p>
                  ) : (
                    filteredTaggable.map(person => (
                      <label
                        key={person.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(person.id)}
                          onChange={() => toggleAssignee(person.id)}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{person.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <button className={`${btnPrimary} w-full justify-center`} onClick={submit} disabled={saving || deleting}>
            {saving ? "Saving..." : mode === "create" ? "Raise Ticket" : "Save Changes"}
          </button>

          {mode === "edit" && onDelete && (
            <button
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-500/10 text-rose-400 text-sm font-semibold rounded-xl hover:bg-rose-500/20 transition-all font-['Plus_Jakarta_Sans'] disabled:opacity-50"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete Ticket"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketCard({
  ticket, assigneeNames, projectName, canEdit, onEdit,
}: {
  ticket: Ticket;
  assigneeNames: string[];
  projectName: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: TICKET_DRAG_TYPE,
      item: { ticketId: ticket.id },
      collect: monitor => ({ isDragging: monitor.isDragging() }),
    }),
    [ticket.id]
  );

  return (
    <div
      ref={node => { drag(node); }}
      className={`${cardCls} p-4 cursor-grab active:cursor-grabbing hover:border-indigo-500/30 transition-all group ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{ticket.title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-['Geist_Mono'] ${PRIORITY_COLOR[ticket.priority]}`}>
            {ticket.priority}
          </span>
          {canEdit && (
            <button
              onClick={onEdit}
              title="Edit ticket"
              className="opacity-0 group-hover:opacity-100 text-[#6b7fa8] hover:text-white transition-opacity"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      {ticket.description && (
        <p className="text-xs text-[#6b7fa8] mb-2 line-clamp-2 font-['Plus_Jakarta_Sans']">{ticket.description}</p>
      )}
      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mb-2">Raised by {ticket.createdByName} · {projectName}</p>
      {assigneeNames.length > 0 && (
        <div className="flex items-center gap-1 -space-x-1">
          {assigneeNames.slice(0, 4).map(name => (
            <Avatar key={name} initials={initialsOf(name)} size="sm" />
          ))}
          {assigneeNames.length > 4 && (
            <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] ml-2">+{assigneeNames.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TicketColumn({
  col, tickets, nameById, projectNameById, canEditTicket, onDropTicket, onEditTicket,
}: {
  col: { key: TicketStatus; label: string; color: string };
  tickets: Ticket[];
  nameById: Map<string, string>;
  projectNameById: Map<string, string>;
  canEditTicket: (ticket: Ticket) => boolean;
  onDropTicket: (ticketId: string, status: TicketStatus) => void;
  onEditTicket: (ticket: Ticket) => void;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: TICKET_DRAG_TYPE,
      drop: (item: { ticketId: string }) => onDropTicket(item.ticketId, col.key),
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [col.key, onDropTicket]
  );

  const colTickets = tickets.filter(t => t.status === col.key);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-sm font-bold ${col.color} font-['Plus_Jakarta_Sans']`}>{col.label}</span>
        <span className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] bg-[#131a35] px-2 py-0.5 rounded-full">
          {colTickets.length}
        </span>
      </div>
      <div
        ref={node => { drop(node); }}
        className={`space-y-3 min-h-[140px] rounded-xl transition-colors ${isOver ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/30" : ""}`}
      >
        {colTickets.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No tickets</div>
        ) : (
          colTickets.map(t => (
            <TicketCard
              key={t.id}
              ticket={t}
              assigneeNames={t.assigneeIds.map(id => nameById.get(id) || "Unknown")}
              projectName={t.projectId ? projectNameById.get(t.projectId) || "Unknown Project" : "General"}
              canEdit={canEditTicket(t)}
              onEdit={() => onEditTicket(t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TicketsView({
  userRole, userName = "", currentUserId,
}: {
  userRole: string;
  userName?: string;
  currentUserId?: string;
}) {
  const { data: projects, loading: projectsLoading } = useProjects();
  const { data: profiles } = useEmployeeProfiles();
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  // "Only show his projects" — everyone except CEO/Superadmin/Team Lead/HR
  // (the app's existing isAdminRole set) only sees projects they're actually
  // on, same rule ProjectsView already uses for "my projects" vs "all projects".
  const visibleProjects = useMemo(() => {
    if (isAdminRole(userRole)) return projects;
    return getEmployeeProjects(projects, userName, currentUserId);
  }, [projects, userRole, userName, currentUserId]);

  const visibleProjectIds = useMemo(() => new Set(visibleProjects.map(p => p.id)), [visibleProjects]);
  const projectNameById = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAllTickets();
      setTickets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  // Every ticket on a project visible to this user, plus every General
  // (no-project) ticket — a General ticket has no project, so it's
  // inherently company-wide rather than owned by anyone's team.
  const scopedTickets = useMemo(
    () => tickets.filter(t => !t.projectId || visibleProjectIds.has(t.projectId)),
    [tickets, visibleProjectIds]
  );

  const displayedTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedTickets;
    return scopedTickets.filter(
      t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [scopedTickets, search]);

  // A ticket's raiser can edit/delete it; CEO/Superadmin can edit/delete any ticket.
  const canEditTicket = useCallback(
    (ticket: Ticket) => Boolean(currentUserId) && (ticket.createdBy === currentUserId || canTagAnyoneInTicket(userRole)),
    [currentUserId, userRole]
  );

  const nameById = useMemo(() => new Map(profiles.map(p => [p.id, p.name])), [profiles]);

  // CEO/Superadmin can tag anyone; everyone else can tag anyone EXCEPT CEO/Superadmin.
  const taggablePeople = useMemo(() => {
    const canTagAdmins = canTagAnyoneInTicket(userRole);
    return profiles
      .filter(p => canTagAdmins || !canTagAnyoneInTicket(resolveRoleFromProfile(p)))
      .map(p => ({ id: p.id, name: p.name }));
  }, [profiles, userRole]);

  const handleCreateTicket = async (input: TicketFormInput) => {
    if (!currentUserId) return;
    // Defense-in-depth: re-filter against the same rule even if the modal's list was stale.
    const allowedIds = new Set(taggablePeople.map(p => p.id));
    const assigneeIds = input.assigneeIds.filter(id => allowedIds.has(id));
    const created = await createTicket({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      createdById: currentUserId,
      assigneeIds,
    });
    setTickets(prev => [created, ...prev]);
    toast.success("Ticket raised.");
  };

  const handleUpdateTicket = async (ticketId: string, input: TicketFormInput) => {
    const allowedIds = new Set(taggablePeople.map(p => p.id));
    const assigneeIds = input.assigneeIds.filter(id => allowedIds.has(id));
    const updated = await updateTicket(ticketId, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      projectId: input.projectId,
      assigneeIds,
      updatedById: currentUserId,
    });
    setTickets(prev => prev.map(t => (t.id === ticketId ? updated : t)));
    toast.success("Ticket updated.");
  };

  const handleDeleteTicket = async (ticketId: string) => {
    await deleteTicket(ticketId);
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    toast.success("Ticket deleted.");
  };

  const ticketsRef = useRef(tickets);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  const handleDropTicket = useCallback((ticketId: string, status: TicketStatus) => {
    const current = ticketsRef.current.find(t => t.id === ticketId);
    if (!current || current.status === status) return;

    const previousStatus = current.status;
    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, status } : t)));

    void updateTicketStatus(ticketId, status, currentUserId).catch(err => {
      toast.error(err instanceof Error ? err.message : "Failed to move ticket.");
      setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, status: previousStatus } : t)));
    });
  }, []);

  if (projectsLoading && projects.length === 0 && loading) return <DataLoading label="Loading..." />;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <TicketIcon size={18} className="text-indigo-400 shrink-0" />
          <div className="relative flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
            <input
              className={`${inputCls} w-full sm:w-auto sm:min-w-[220px] pl-9`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
            />
          </div>
        </div>
        <button className={`${btnPrimary} justify-center`} onClick={() => setShowCreateModal(true)} disabled={!currentUserId}>
          <Plus size={16} /> Raise Ticket
        </button>
      </div>

      {loading ? (
        <DataLoading label="Loading tickets..." />
      ) : error ? (
        <DataError message={error} />
      ) : tickets.length === 0 ? (
        <DataEmpty message="No tickets yet — raise the first one." />
      ) : displayedTickets.length === 0 ? (
        <DataEmpty message="No tickets match your search." />
      ) : (
        <DndProvider backend={HTML5Backend}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {BOARD_COLUMNS.map(col => (
              <TicketColumn
                key={col.key}
                col={col}
                tickets={displayedTickets}
                nameById={nameById}
                projectNameById={projectNameById}
                canEditTicket={canEditTicket}
                onDropTicket={handleDropTicket}
                onEditTicket={setEditingTicket}
              />
            ))}
          </div>
        </DndProvider>
      )}

      {showCreateModal && (
        <TicketFormModal
          mode="create"
          taggable={taggablePeople}
          projects={visibleProjects}
          defaultProjectId=""
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTicket}
        />
      )}

      {editingTicket && (
        <TicketFormModal
          mode="edit"
          initial={editingTicket}
          taggable={taggablePeople}
          projects={visibleProjects}
          defaultProjectId=""
          onClose={() => setEditingTicket(null)}
          onSubmit={input => handleUpdateTicket(editingTicket.id, input)}
          onDelete={() => handleDeleteTicket(editingTicket.id)}
        />
      )}
    </div>
  );
}
