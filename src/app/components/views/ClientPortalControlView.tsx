import React, { useEffect, useState } from "react";
import { ShieldCheck, Save, DollarSign, RefreshCw, FileText, Upload, Trash2, Loader2, Pencil, Check, X, Users, Package, Receipt, Activity, Plus, FolderKanban, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPortalSettings,
  updatePortalSettings,
  CLIENT_PORTAL_MODULES,
  listPortalClients,
  fetchPortalProjects,
  createPortalProject,
  updatePortalProject,
  deletePortalProject,
  PORTAL_PROJECT_STATUSES,
  fetchPortalMilestones,
  createPortalMilestone,
  updatePortalMilestone,
  deletePortalMilestone,
  PORTAL_MILESTONE_STATUSES,
  fetchPortalDocuments,
  createPortalDocument,
  updatePortalDocument,
  deletePortalDocument,
  PORTAL_DOCUMENT_CATEGORIES,
  fetchPortalTeam,
  assignPortalTeamMember,
  unassignPortalTeamMember,
  fetchPortalDeliverables,
  createPortalDeliverable,
  updatePortalDeliverable,
  deletePortalDeliverable,
  PORTAL_DELIVERABLE_TYPES,
  PORTAL_DELIVERABLE_STATUSES,
  fetchPortalInvoices,
  createPortalInvoice,
  updatePortalInvoice,
  deletePortalInvoice,
  PORTAL_INVOICE_STATUSES,
  fetchPortalActivity,
  createPortalActivity,
  deletePortalActivity,
  type PortalSettings,
  type PortalClient,
  type PortalProject,
  type PortalProjectStatus,
  type PortalMilestone,
  type PortalMilestoneStatus,
  type PortalDocument,
  type PortalDocumentCategory,
  type PortalStaffMember,
  type PortalDeliverable,
  type PortalDeliverableType,
  type PortalDeliverableStatus,
  type PortalInvoice,
  type PortalInvoiceStatus,
  type PortalActivityEntry,
} from "@/lib/database";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { DataError, DataLoading, DataEmpty } from "../ui/DataStatus";

const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans'] disabled:opacity-50";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SettingsTab() {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [visibleModules, setVisibleModules] = useState<Set<string>>(new Set());
  const [showFinancials, setShowFinancials] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPortalSettings();
      setSettings(result);
      setVisibleModules(new Set(result.visibleModules));
      setShowFinancials(result.showFinancials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client portal settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleModule = (id: string) => {
    setVisibleModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updatePortalSettings({
        visibleModules: Array.from(visibleModules),
        showFinancials,
      });
      setSettings(result);
      toast.success("Client portal settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DataLoading label="Loading client portal settings..." />;
  if (error) return <DataError message={error} />;

  const dirty =
    !!settings &&
    (JSON.stringify(Array.from(visibleModules).sort()) !== JSON.stringify([...settings.visibleModules].sort()) ||
      showFinancials !== settings.showFinancials);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          Controls what every client sees in the client-erp web app — applies to all clients.
        </p>
        <button
          onClick={() => void load()}
          title="Reload current settings"
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#6b7fa8] hover:text-white rounded-lg hover:bg-white/[0.03] transition-colors flex-shrink-0"
        >
          <RefreshCw size={13} /> Reload
        </button>
      </div>

      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">Visible Modules</h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Unchecked modules disappear from every client's sidebar — and can't be opened directly either.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CLIENT_PORTAL_MODULES.map(m => (
            <label
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[#131a35] rounded-xl cursor-pointer hover:bg-[#161d3f] transition-colors"
            >
              <input
                type="checkbox"
                checked={visibleModules.has(m.id)}
                onChange={() => toggleModule(m.id)}
                className="accent-indigo-500"
              />
              <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <DollarSign size={15} className="text-amber-400" /> Financial Figures
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          When off, budget/revenue amounts are hidden from Analytics, Projects, and Command Center — clients still see project progress and status.
        </p>
        <label className="flex items-center gap-2.5 px-3 py-2.5 bg-[#131a35] rounded-xl cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showFinancials}
            onChange={() => setShowFinancials(v => !v)}
            className="accent-indigo-500"
          />
          <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">Show budget/revenue figures to clients</span>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">
          {settings?.updatedAt ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}` : ""}
        </p>
        <button className={btnPrimary} onClick={handleSave} disabled={saving || !dirty}>
          <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/** Reusable across every per-client content tab (Documents today, Deliverables/Team/Invoices/Activity Feed next). */
function ClientSelector({
  clients, loading, error, selected, onSelect,
}: {
  clients: PortalClient[];
  loading: boolean;
  error: string;
  selected: PortalClient | null;
  onSelect: (client: PortalClient | null) => void;
}) {
  if (loading) return <DataLoading label="Loading clients..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Client</span>
      <select
        value={selected?.organizationId ?? ""}
        onChange={(e) => onSelect(clients.find(c => c.organizationId === e.target.value) ?? null)}
        className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none min-w-[240px]"
      >
        <option value="">Select a client…</option>
        {clients.map(c => (
          <option key={c.organizationId} value={c.organizationId}>{c.organizationName}</option>
        ))}
      </select>
    </div>
  );
}

function DocumentsTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");

  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<PortalDocumentCategory>("reports");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<PortalDocumentCategory>("reports");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const loadDocuments = (projectId: string) => {
    setDocsLoading(true);
    setDocsError("");
    fetchPortalDocuments(projectId)
      .then(setDocuments)
      .catch(err => setDocsError(err instanceof Error ? err.message : "Failed to load documents."))
      .finally(() => setDocsLoading(false));
  };

  useEffect(() => {
    if (selected?.projectId) loadDocuments(selected.projectId);
    else setDocuments([]);
  }, [selected?.projectId]);

  const handleUpload = async () => {
    if (!selected?.projectId || !uploadFile || !uploadName.trim()) return;
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinary(uploadFile, "base2brand-client-documents");
      await createPortalDocument({
        projectId: selected.projectId,
        name: uploadName.trim(),
        category: uploadCategory,
        fileUrl: uploaded.url,
        fileType: uploaded.format,
        fileSizeBytes: uploaded.bytes,
      });
      toast.success("Document added to the client portal.");
      setUploadName("");
      setUploadFile(null);
      loadDocuments(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload the document.");
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (doc: PortalDocument) => {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditCategory(doc.category);
  };

  const saveEdit = async (id: string) => {
    if (!selected?.projectId) return;
    try {
      await updatePortalDocument(id, { name: editName.trim() || undefined, category: editCategory });
      setEditingId(null);
      loadDocuments(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update the document.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!selected?.projectId) return;
    setDeletingId(id);
    try {
      await deletePortalDocument(id);
      loadDocuments(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the document.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <FileText size={15} className="text-indigo-400" /> Client Documents
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Upload, rename, recategorize, or remove files a specific client sees in their Document Vault.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && !selected.projectId && (
        <DataError message={`${selected.organizationName} has no project yet on client-erp — nothing to attach documents to.`} />
      )}

      {selected?.projectId && (
        <>
          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4 flex items-center gap-2">
              <Upload size={15} className="text-emerald-400" /> Upload New Document
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Document name…"
                className="flex-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as PortalDocumentCategory)}
                className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              >
                {PORTAL_DOCUMENT_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[#8891B8] font-['Plus_Jakarta_Sans'] flex-1"
              />
              <button
                className={btnPrimary}
                disabled={uploading || !uploadFile || !uploadName.trim()}
                onClick={() => void handleUpload()}
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
              {selected.organizationName}'s Documents
            </h3>
            {docsLoading && <DataLoading label="Loading documents..." />}
            {!docsLoading && docsError && <DataError message={docsError} />}
            {!docsLoading && !docsError && documents.length === 0 && <DataEmpty message="No documents uploaded for this client yet." />}
            {!docsLoading && !docsError && documents.length > 0 && (
              <div className="flex flex-col gap-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 bg-[#131a35] rounded-xl px-4 py-3">
                    {editingId === doc.id ? (
                      <>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as PortalDocumentCategory)}
                          className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-lg px-2 py-1.5 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
                        >
                          {PORTAL_DOCUMENT_CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <button onClick={() => void saveEdit(doc.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-white/5">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8891B8] hover:bg-white/5">
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                              {PORTAL_DOCUMENT_CATEGORIES.find(c => c.id === doc.category)?.label ?? doc.category}
                            </span>
                            <span className="text-[11px] text-[#6b7fa8]">·</span>
                            <span className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{formatFileSize(doc.fileSizeBytes)}</span>
                            <span className="text-[11px] text-[#6b7fa8]">·</span>
                            <span className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{new Date(doc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 font-['Plus_Jakarta_Sans']">
                            Open
                          </a>
                        )}
                        <button onClick={() => startEdit(doc)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8891B8] hover:bg-white/5">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => void handleDelete(doc.id)}
                          disabled={deletingId === doc.id}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-white/5 disabled:opacity-50"
                        >
                          {deletingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MilestonesEditor({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<PortalMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    fetchPortalMilestones(projectId)
      .then(setMilestones)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load milestones."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!label.trim()) return;
    setAdding(true);
    try {
      await createPortalMilestone(projectId, label.trim());
      setLabel("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add milestone.");
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (id: string, status: PortalMilestoneStatus) => {
    try {
      await updatePortalMilestone(id, { status });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update milestone.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePortalMilestone(id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete milestone.");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(99,102,241,0.1)]">
      <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-2 uppercase tracking-wide">Milestones</p>
      {loading && <DataLoading label="Loading milestones..." />}
      {!loading && error && <DataError message={error} />}
      {!loading && !error && (
        <div className="flex flex-col gap-1.5">
          {milestones.map(m => (
            <div key={m.id} className="flex items-center gap-2 bg-[#0d1326] rounded-lg px-3 py-2">
              <span className="flex-1 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m.label}</span>
              <select
                value={m.status}
                onChange={(e) => void handleStatusChange(m.id, e.target.value as PortalMilestoneStatus)}
                className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded px-1.5 py-1 text-[11px] text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              >
                {PORTAL_MILESTONE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => void handleDelete(m.id)} className="w-6 h-6 rounded flex items-center justify-center text-rose-400 hover:bg-white/5">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No milestones yet.</p>}
          <div className="flex gap-2 mt-1.5">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="New milestone…"
              className="flex-1 bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !label.trim()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-['Plus_Jakarta_Sans'] disabled:opacity-50 flex items-center gap-1"
            >
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ project, onChanged }: { project: PortalProject; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(project.name);
  const [category, setCategory] = useState(project.category ?? "");
  const [status, setStatus] = useState<PortalProjectStatus>(project.status);
  const [progressPct, setProgressPct] = useState(String(project.progressPct));
  const [budgetTotal, setBudgetTotal] = useState(project.budgetTotal !== null ? String(project.budgetTotal) : "");
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [launchDate, setLaunchDate] = useState(project.launchDate ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    name !== project.name ||
    category !== (project.category ?? "") ||
    status !== project.status ||
    progressPct !== String(project.progressPct) ||
    budgetTotal !== (project.budgetTotal !== null ? String(project.budgetTotal) : "") ||
    startDate !== (project.startDate ?? "") ||
    launchDate !== (project.launchDate ?? "") ||
    description !== (project.description ?? "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePortalProject(project.id, {
        name: name.trim(),
        category: category.trim(),
        status,
        progressPct: Number(progressPct) || 0,
        budgetTotal: budgetTotal.trim() ? Number(budgetTotal) : null,
        startDate: startDate || undefined,
        launchDate: launchDate || undefined,
        description,
      });
      toast.success("Project updated.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePortalProject(project.id);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project.");
      setDeleting(false);
    }
  };

  return (
    <div className="bg-[#131a35] rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={() => setExpanded(v => !v)} className="text-[#6b7fa8] hover:text-white flex-shrink-0">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="flex-1 min-w-0" onClick={() => setExpanded(v => !v)} style={{ cursor: "pointer" }}>
          <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{project.name}</p>
          <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
            {project.category ?? "—"} · {project.status} · {project.progressPct}%
          </p>
        </div>
        <button
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-white/5 disabled:opacity-50 flex-shrink-0"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[rgba(99,102,241,0.1)] flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PortalProjectStatus)}
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            >
              {PORTAL_PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={progressPct}
              onChange={(e) => setProgressPct(e.target.value)}
              type="number"
              min={0}
              max={100}
              placeholder="Progress %"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <input
              value={budgetTotal}
              onChange={(e) => setBudgetTotal(e.target.value)}
              type="number"
              placeholder="Budget total"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
            <input
              value={launchDate}
              onChange={(e) => setLaunchDate(e.target.value)}
              type="date"
              className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
            className="bg-[#0d1326] border border-[rgba(99,102,241,0.15)] rounded-lg px-2.5 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none resize-none"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving || !dirty || !name.trim()}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-['Plus_Jakarta_Sans'] disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>

          <MilestonesEditor projectId={project.id} />
        </div>
      )}
    </div>
  );
}

function ProjectsTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const load = (organizationId: string) => {
    setLoading(true);
    setError("");
    fetchPortalProjects(organizationId)
      .then(setProjects)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load projects."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected?.organizationId) load(selected.organizationId);
    else setProjects([]);
  }, [selected?.organizationId]);

  const handleCreate = async () => {
    if (!selected?.organizationId || !newName.trim()) return;
    setCreating(true);
    try {
      await createPortalProject({ organizationId: selected.organizationId, name: newName.trim() });
      setNewName("");
      load(selected.organizationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the project.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <FolderKanban size={15} className="text-indigo-400" /> Client Projects
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          A matched main-ERP project still auto-syncs name/status/progress/budget/milestones on every save — this is
          for direct edits (any field) and projects that never had a confident lead-name match to sync from.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && (
        <>
          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4 flex items-center gap-2">
              <Plus size={15} className="text-emerald-400" /> New Project
            </h3>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name…"
                className="flex-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <button className={btnPrimary} disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
              {selected.organizationName}'s Projects
            </h3>
            {loading && <DataLoading label="Loading projects..." />}
            {!loading && error && <DataError message={error} />}
            {!loading && !error && projects.length === 0 && <DataEmpty message="No projects yet for this client." />}
            {!loading && !error && projects.length > 0 && (
              <div className="flex flex-col gap-2">
                {projects.map(p => (
                  <ProjectRow key={p.id} project={p} onChanged={() => load(selected.organizationId)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TeamTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [staff, setStaff] = useState<PortalStaffMember[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const load = (projectId: string) => {
    setLoading(true);
    setError("");
    fetchPortalTeam(projectId)
      .then(result => {
        setStaff(result.staff);
        setAssignedIds(new Set(result.assignedPersonIds));
      })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load team."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected?.projectId) load(selected.projectId);
    else { setStaff([]); setAssignedIds(new Set()); }
  }, [selected?.projectId]);

  const toggle = async (personId: string, currentlyAssigned: boolean) => {
    if (!selected?.projectId) return;
    setPendingId(personId);
    try {
      if (currentlyAssigned) await unassignPortalTeamMember(selected.projectId, personId);
      else await assignPortalTeamMember(selected.projectId, personId);
      setAssignedIds(prev => {
        const next = new Set(prev);
        if (currentlyAssigned) next.delete(personId);
        else next.add(personId);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update team assignment.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <Users size={15} className="text-indigo-400" /> Client Team
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Pick which staff members show up as the assigned team on a client's project.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && !selected.projectId && (
        <DataError message={`${selected.organizationName} has no project yet on client-erp — nothing to assign a team to.`} />
      )}

      {selected?.projectId && (
        <div className={`${cardCls} p-6`}>
          <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
            Staff Directory ({staff.length})
          </h3>
          {loading && <DataLoading label="Loading team..." />}
          {!loading && error && <DataError message={error} />}
          {!loading && !error && staff.length === 0 && <DataEmpty message="No staff in the client-erp directory yet." />}
          {!loading && !error && staff.length > 0 && (
            <div className="flex flex-col gap-2">
              {staff.map(person => {
                const assigned = assignedIds.has(person.id);
                return (
                  <label
                    key={person.id}
                    className="flex items-center gap-3 bg-[#131a35] rounded-xl px-4 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={pendingId === person.id}
                      onChange={() => void toggle(person.id, assigned)}
                      className="accent-indigo-500"
                    />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500/15 text-indigo-300 text-xs font-semibold flex-shrink-0">
                      {person.initials ?? person.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{person.fullName}</p>
                      <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{person.role ?? person.specialty ?? ""}</p>
                    </div>
                    {pendingId === person.id && <Loader2 size={14} className="animate-spin text-[#6b7fa8]" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliverablesTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [items, setItems] = useState<PortalDeliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<PortalDeliverableType>("Design");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const load = (projectId: string) => {
    setLoading(true);
    setError("");
    fetchPortalDeliverables(projectId)
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load deliverables."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected?.projectId) load(selected.projectId);
    else setItems([]);
  }, [selected?.projectId]);

  const handleCreate = async () => {
    if (!selected?.projectId || !name.trim()) return;
    setCreating(true);
    try {
      await createPortalDeliverable({ projectId: selected.projectId, name: name.trim(), type });
      setName("");
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the deliverable.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: PortalDeliverableStatus) => {
    if (!selected?.projectId) return;
    try {
      await updatePortalDeliverable(id, { status });
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!selected?.projectId) return;
    setDeletingId(id);
    try {
      await deletePortalDeliverable(id);
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the deliverable.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <Package size={15} className="text-indigo-400" /> Client Deliverables
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Create/edit/remove deliverable items a client sees, and move their review status.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && !selected.projectId && (
        <DataError message={`${selected.organizationName} has no project yet on client-erp — nothing to attach deliverables to.`} />
      )}

      {selected?.projectId && (
        <>
          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4 flex items-center gap-2">
              <Plus size={15} className="text-emerald-400" /> New Deliverable
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Deliverable name…"
                className="flex-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PortalDeliverableType)}
                className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              >
                {PORTAL_DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className={btnPrimary} disabled={creating || !name.trim()} onClick={() => void handleCreate()}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
              {selected.organizationName}'s Deliverables
            </h3>
            {loading && <DataLoading label="Loading deliverables..." />}
            {!loading && error && <DataError message={error} />}
            {!loading && !error && items.length === 0 && <DataEmpty message="No deliverables yet for this client." />}
            {!loading && !error && items.length > 0 && (
              <div className="flex flex-col gap-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-[#131a35] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{item.type ?? "—"}</p>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => void handleStatusChange(item.id, e.target.value as PortalDeliverableStatus)}
                      className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-lg px-2 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
                    >
                      {PORTAL_DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      onClick={() => void handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-white/5 disabled:opacity-50"
                    >
                      {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InvoicesTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [items, setItems] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const load = (projectId: string) => {
    setLoading(true);
    setError("");
    fetchPortalInvoices(projectId)
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load invoices."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected?.projectId) load(selected.projectId);
    else setItems([]);
  }, [selected?.projectId]);

  const handleCreate = async () => {
    const amountNum = Number(amount);
    if (!selected?.projectId || !invoiceNumber.trim() || !Number.isFinite(amountNum) || amountNum <= 0) return;
    setCreating(true);
    try {
      await createPortalInvoice({
        projectId: selected.projectId,
        invoiceNumber: invoiceNumber.trim(),
        amount: amountNum,
        issueDate: todayIso,
        dueDate,
      });
      setInvoiceNumber("");
      setAmount("");
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the invoice.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: PortalInvoiceStatus) => {
    if (!selected?.projectId) return;
    try {
      await updatePortalInvoice(id, { status });
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!selected?.projectId) return;
    setDeletingId(id);
    try {
      await deletePortalInvoice(id);
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the invoice.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <Receipt size={15} className="text-indigo-400" /> Client Invoices
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Create/edit/remove invoices a client sees in their Billing view.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && !selected.projectId && (
        <DataError message={`${selected.organizationName} has no project yet on client-erp — nothing to invoice.`} />
      )}

      {selected?.projectId && (
        <>
          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4 flex items-center gap-2">
              <Plus size={15} className="text-emerald-400" /> New Invoice
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Invoice number…"
                className="flex-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                type="number"
                className="w-32 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
                className="bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <button
                className={btnPrimary}
                disabled={creating || !invoiceNumber.trim() || !amount}
                onClick={() => void handleCreate()}
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
              {selected.organizationName}'s Invoices
            </h3>
            {loading && <DataLoading label="Loading invoices..." />}
            {!loading && error && <DataError message={error} />}
            {!loading && !error && items.length === 0 && <DataEmpty message="No invoices yet for this client." />}
            {!loading && !error && items.length > 0 && (
              <div className="flex flex-col gap-2">
                {items.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 bg-[#131a35] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                        ${inv.amount.toLocaleString()} · due {new Date(inv.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <select
                      value={inv.status}
                      onChange={(e) => void handleStatusChange(inv.id, e.target.value as PortalInvoiceStatus)}
                      className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-lg px-2 py-1.5 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
                    >
                      {PORTAL_INVOICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      onClick={() => void handleDelete(inv.id)}
                      disabled={deletingId === inv.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-white/5 disabled:opacity-50"
                    >
                      {deletingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityTab() {
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selected, setSelected] = useState<PortalClient | null>(null);

  const [items, setItems] = useState<PortalActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setClientsLoading(true);
    listPortalClients()
      .then(setClients)
      .catch(err => setClientsError(err instanceof Error ? err.message : "Failed to load clients."))
      .finally(() => setClientsLoading(false));
  }, []);

  const load = (projectId: string) => {
    setLoading(true);
    setError("");
    fetchPortalActivity(projectId)
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load activity."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selected?.projectId) load(selected.projectId);
    else setItems([]);
  }, [selected?.projectId]);

  const handlePost = async () => {
    if (!selected?.projectId || !description.trim()) return;
    setPosting(true);
    try {
      await createPortalActivity({ projectId: selected.projectId, description: description.trim() });
      setDescription("");
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post the update.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selected?.projectId) return;
    setDeletingId(id);
    try {
      await deletePortalActivity(id);
      load(selected.projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the entry.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-6`}>
        <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1 flex items-center gap-2">
          <Activity size={15} className="text-indigo-400" /> Client Activity Feed
        </h3>
        <p className="text-xs text-[#6b7fa8] mb-4 font-['Plus_Jakarta_Sans']">
          Post or remove updates a client sees in their Activity Feed / Recent Updates.
        </p>
        <ClientSelector clients={clients} loading={clientsLoading} error={clientsError} selected={selected} onSelect={setSelected} />
      </div>

      {selected && !selected.projectId && (
        <DataError message={`${selected.organizationName} has no project yet on client-erp — nothing to post activity to.`} />
      )}

      {selected?.projectId && (
        <>
          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4 flex items-center gap-2">
              <Plus size={15} className="text-emerald-400" /> Post Update
            </h3>
            <div className="flex gap-3">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened…"
                className="flex-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-3 py-2 text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] outline-none"
              />
              <button className={btnPrimary} disabled={posting || !description.trim()} onClick={() => void handlePost()}>
                {posting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>

          <div className={`${cardCls} p-6`}>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-4">
              {selected.organizationName}'s Activity
            </h3>
            {loading && <DataLoading label="Loading activity..." />}
            {!loading && error && <DataError message={error} />}
            {!loading && !error && items.length === 0 && <DataEmpty message="No activity posted for this client yet." />}
            {!loading && !error && items.length > 0 && (
              <div className="flex flex-col gap-2">
                {items.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 bg-[#131a35] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{entry.description}</p>
                      <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                        {entry.actorName ?? "Base2Brand"} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-white/5 disabled:opacity-50"
                    >
                      {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type ClientPortalTab = "settings" | "projects" | "documents" | "team" | "deliverables" | "invoices" | "activity";

export function ClientPortalControlView() {
  const [tab, setTab] = useState<ClientPortalTab>("settings");

  const tabs: { id: ClientPortalTab; label: string }[] = [
    { id: "settings", label: "Settings" },
    { id: "projects", label: "Projects" },
    { id: "documents", label: "Documents" },
    { id: "team", label: "Team" },
    { id: "deliverables", label: "Deliverables" },
    { id: "invoices", label: "Invoices" },
    { id: "activity", label: "Activity Feed" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-400" /> Client Portal Control
        </h2>
        <p className="text-sm text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">
          Everything a client sees in the client-erp web app, managed from here.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[rgba(99,102,241,0.12)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-['Plus_Jakarta_Sans'] border-b-2 transition-colors ${
              tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-[#6b7fa8] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab />}
      {tab === "projects" && <ProjectsTab />}
      {tab === "documents" && <DocumentsTab />}
      {tab === "team" && <TeamTab />}
      {tab === "deliverables" && <DeliverablesTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}
