import { useEffect, useState } from "react";
import { Eye, CheckCircle, XCircle, Download, Pin, Sparkles, RotateCcw, Loader2, Package } from "lucide-react";
import { fetchDeliverables, setDeliverableStatus, type DeliverableItem, type DeliverableStatus } from "@/lib/database";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const statusConfig: Record<DeliverableStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Awaiting Review", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  review: { label: "In Review", color: "#4C6EF5", bg: "rgba(76,110,245,0.12)" },
  approved: { label: "Approved", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  changes: { label: "Changes Requested", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function ReviewModal({
  deliverable, onClose, onStatusChange,
}: {
  deliverable: DeliverableItem;
  onClose: () => void;
  onStatusChange: (status: DeliverableStatus) => void;
}) {
  const [activePin, setActivePin] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [aiTasks, setAiTasks] = useState<string[]>([]);
  const [showAi, setShowAi] = useState(false);
  const [saving, setSaving] = useState<DeliverableStatus | null>(null);

  // Client-side feedback interpreter — no LLM backend is wired up for this yet,
  // so this heuristically breaks free-text feedback into task-shaped suggestions
  // rather than fabricating a fake AI response.
  const interpretFeedback = () => {
    if (!feedback.trim()) return;
    const sentences = feedback
      .split(/[.\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    setAiTasks(sentences.length > 0 ? sentences.map(s => s.charAt(0).toUpperCase() + s.slice(1)) : [feedback.trim()]);
    setShowAi(true);
  };

  const handleStatus = async (status: DeliverableStatus) => {
    setSaving(status);
    try {
      await setDeliverableStatus(deliverable.id, status);
      onStatusChange(status);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(7,9,26,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl overflow-hidden flex"
        style={{
          width: "90vw", maxWidth: 1100, height: "85vh",
          background: "#0B0E28", border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Preview area */}
        <div className="flex-1 relative overflow-hidden" style={{ background: "#080B1A" }}>
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span style={{ background: "rgba(0,0,0,0.6)", color: "#E2E4F0", fontSize: 12, padding: "4px 10px", borderRadius: 6, backdropFilter: "blur(8px)" }}>
              {deliverable.name}
            </span>
            {deliverable.currentVersion && (
              <span style={{ background: "rgba(123,92,245,0.3)", color: "#C4B5FD", fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>
                {deliverable.currentVersion}
              </span>
            )}
          </div>
          {deliverable.previewUrl ? (
            <img src={deliverable.previewUrl} alt={deliverable.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={40} color="#3A3F66" />
            </div>
          )}
          {deliverable.comments.map((pin) => (
            <div
              key={pin.id}
              className="absolute cursor-pointer"
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -50%)" }}
              onClick={() => setActivePin(activePin === pin.id ? null : pin.id)}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: pin.resolved ? "rgba(16,185,129,0.8)" : "rgba(239,68,68,0.9)",
                  border: "2px solid #fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <Pin size={12} />
              </div>
              {activePin === pin.id && (
                <div
                  className="absolute rounded-lg p-3 z-20"
                  style={{ left: 36, top: -8, minWidth: 220, background: "#0D1030", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ color: "#C4B5FD", fontSize: 11, fontWeight: 600 }}>{pin.authorName}</p>
                    <p style={{ color: "#8891B8", fontSize: 10 }}>{pin.timeLabel}</p>
                  </div>
                  <p style={{ color: "#E2E4F0", fontSize: 12 }}>{pin.text}</p>
                  {pin.resolved && <span style={{ color: "#10B981", fontSize: 10, marginTop: 4, display: "block" }}>✓ Resolved</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Side panel */}
        <div className="w-80 flex flex-col overflow-hidden" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Review Deliverable</h3>
              <button onClick={onClose} style={{ color: "#8891B8" }}>
                <XCircle size={18} />
              </button>
            </div>
            <p style={{ color: "#8891B8", fontSize: 12 }}>Uploaded by {deliverable.uploadedByName ?? "Base2Brand"} · {deliverable.dateLabel}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {deliverable.status !== "approved" ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleStatus("approved")}
                  disabled={saving !== null}
                  className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                >
                  {saving === "approved" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Approve Deliverable
                </button>
                <button
                  onClick={() => handleStatus("changes")}
                  disabled={saving !== null}
                  className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}
                >
                  {saving === "changes" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                  Request Changes
                </button>
              </div>
            ) : (
              <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <CheckCircle size={16} color="#10B981" />
                <p style={{ color: "#10B981", fontSize: 13, fontWeight: 600 }}>Approved! ✓</p>
              </div>
            )}

            <div>
              <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <Pin size={12} style={{ display: "inline", marginRight: 6 }} />
                Pin Comments ({deliverable.comments.length})
              </p>
              {deliverable.comments.length === 0 && <p style={{ color: "#8891B8", fontSize: 12 }}>No comments yet.</p>}
              <div className="flex flex-col gap-2">
                {deliverable.comments.map((pin) => (
                  <div key={pin.id} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: pin.resolved ? "#10B981" : "#EF4444" }} />
                      <p style={{ color: "#C4C8E0", fontSize: 11, fontWeight: 600 }}>{pin.authorName}</p>
                      <p style={{ color: "#8891B8", fontSize: 10, marginLeft: "auto" }}>{pin.timeLabel}</p>
                    </div>
                    <p style={{ color: "#E2E4F0", fontSize: 12 }}>{pin.text}</p>
                    {pin.resolved && <p style={{ color: "#10B981", fontSize: 10, marginTop: 4 }}>✓ Resolved</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <Sparkles size={12} style={{ display: "inline", marginRight: 6, color: "#7B5CF5" }} />
                Feedback Interpreter
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder='e.g. "Make this page look more premium and modern"'
                className="w-full rounded-lg p-3 resize-none"
                rows={3}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 12, outline: "none" }}
              />
              <button
                onClick={interpretFeedback}
                className="w-full rounded-lg py-2 mt-2 flex items-center justify-center gap-2"
                style={{ background: "rgba(123,92,245,0.2)", border: "1px solid rgba(123,92,245,0.3)", color: "#C4B5FD", fontSize: 12, fontWeight: 600 }}
              >
                <Sparkles size={13} />
                Break Feedback Into Tasks
              </button>

              {showAi && (
                <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(123,92,245,0.08)", border: "1px solid rgba(123,92,245,0.2)" }}>
                  <p style={{ color: "#C4B5FD", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Suggested Tasks:</p>
                  {aiTasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(123,92,245,0.2)", border: "1px solid rgba(123,92,245,0.3)" }}>
                        <span style={{ color: "#C4B5FD", fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                      </div>
                      <p style={{ color: "#E2E4F0", fontSize: 11 }}>{task}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Deliverables({ organizationId }: { organizationId?: string }) {
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<DeliverableItem | null>(null);
  const [filter, setFilter] = useState<"all" | DeliverableStatus>("all");

  useEffect(() => {
    if (!organizationId) {
      setDeliverables([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchDeliverables(organizationId)
      .then(result => { if (!cancelled) setDeliverables(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load deliverables."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  const filtered = filter === "all" ? deliverables : deliverables.filter(d => d.status === filter);

  const handleStatusChange = (id: string, status: DeliverableStatus) => {
    setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, status } : d)));
    setReviewing(prev => (prev && prev.id === id ? { ...prev, status } : prev));
  };

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their deliverables.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      {reviewing && (
        <ReviewModal
          deliverable={reviewing}
          onClose={() => setReviewing(null)}
          onStatusChange={(status) => handleStatusChange(reviewing.id, status)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Deliverables</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Review and approve project deliverables</p>
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "review", "approved"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-lg px-3 py-1.5 capitalize transition-colors"
              style={{
                background: filter === f ? "rgba(123,92,245,0.2)" : "rgba(255,255,255,0.04)",
                border: filter === f ? "1px solid rgba(123,92,245,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: filter === f ? "#C4B5FD" : "#8891B8",
                fontSize: 12,
              }}
            >
              {f === "all" ? "All" : statusConfig[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading deliverables...</p>
        </div>
      )}

      {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Package size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>No deliverables here yet.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((item) => {
            const st = statusConfig[item.status];
            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden flex"
                style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(123,92,245,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <div className="w-48 flex-shrink-0 relative" style={{ minHeight: 100, background: "#0B0E28" }}>
                  {item.previewUrl ? (
                    <>
                      <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" style={{ minHeight: 100 }} />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent, rgba(13,16,48,0.3))" }} />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={24} color="#3A3F66" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-5 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p style={{ color: "#E2E4F0", fontSize: 15, fontWeight: 600 }}>{item.name}</p>
                      {item.currentVersion && (
                        <span className="rounded px-2 py-0.5" style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", fontSize: 10 }}>{item.currentVersion}</span>
                      )}
                      <span className="rounded-full px-2 py-0.5" style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ color: "#8891B8", fontSize: 12 }}>
                      {item.type ?? "File"} · Uploaded by {item.uploadedByName ?? "Base2Brand"} · {item.dateLabel} · {item.fileSizeLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status !== "approved" && (
                      <button
                        onClick={() => setReviewing(item)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors"
                        style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 12, fontWeight: 600 }}
                      >
                        <Eye size={13} />
                        Review
                      </button>
                    )}
                    {item.status === "approved" && (
                      <div className="flex items-center gap-1.5" style={{ color: "#10B981", fontSize: 12 }}>
                        <CheckCircle size={14} />
                        Approved
                      </div>
                    )}
                    <a
                      href={item.fileUrl ?? undefined}
                      download
                      className="rounded-lg p-2"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", opacity: item.fileUrl ? 1 : 0.4, pointerEvents: item.fileUrl ? "auto" : "none" }}
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
