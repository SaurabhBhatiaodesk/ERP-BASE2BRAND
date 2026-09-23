import { useEffect, useState } from "react";
import { Plus, Clock, CheckCircle, AlertCircle, Sparkles, Send, Loader2, X } from "lucide-react";
import {
  fetchSupportTickets, createSupportTicket, fetchProjectDetail, fetchBillingData, fetchAllOrganizations,
  type SupportCenterData, type SupportTicketPriority, type SupportTicketStatus,
} from "@/lib/database";
import { askCopilot, buildSupportSystemPrompt, type CopilotMessage } from "@/lib/copilotAi";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const prioConfig: Record<SupportTicketPriority, { color: string; bg: string }> = {
  high: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  low: { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
};

const statusConfig: Record<SupportTicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Open", color: "#EF4444", icon: AlertCircle },
  "in-progress": { label: "In Progress", color: "#F59E0B", icon: Clock },
  resolved: { label: "Resolved", color: "#10B981", icon: CheckCircle },
};

type AiMsg = { role: "user" | "ai"; text: string };

function NewTicketDialog({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createSupportTicket(projectId, title.trim(), priority);
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(7,9,26,0.85)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ width: 420, background: "#0B0E28", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h3 style={{ color: "#E2E4F0", fontSize: 15, fontWeight: 600 }}>Raise a Ticket</h3>
          <button onClick={onClose} style={{ color: "#8891B8" }}><X size={18} /></button>
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Describe the issue…"
          rows={3}
          className="w-full rounded-lg p-3 resize-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 13, outline: "none" }}
        />
        <div className="flex items-center gap-2">
          <span style={{ color: "#8891B8", fontSize: 12 }}>Priority</span>
          {(["low", "medium", "high"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className="rounded-lg px-3 py-1 capitalize"
              style={{
                background: priority === p ? prioConfig[p].bg : "rgba(255,255,255,0.05)",
                color: priority === p ? prioConfig[p].color : "#8891B8",
                fontSize: 12, fontWeight: 600,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={!title.trim() || saving}
          className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: !title.trim() || saving ? 0.6 : 1 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Submit Ticket
        </button>
      </div>
    </div>
  );
}

export function SupportCenter({ organizationId, personName }: { organizationId?: string; personName?: string }) {
  const [data, setData] = useState<SupportCenterData | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);

  const load = () => {
    if (!organizationId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetchSupportTickets(organizationId)
      .then(result => setData(result))
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load support tickets."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setAiMessages([
      { role: "ai", text: `Hi ${personName ?? "there"}! I'm your Support Assistant. Ask me about your tickets, or raise a new one with the button above.` },
    ]);
    if (!organizationId) {
      setSystemPrompt("");
      return;
    }
    let cancelled = false;
    Promise.all([fetchProjectDetail(organizationId), fetchBillingData(organizationId), fetchSupportTickets(organizationId), fetchAllOrganizations()])
      .then(([detail, billing, support, orgs]) => {
        if (cancelled) return;
        const organizationName = orgs.find(o => o.id === organizationId)?.name ?? "your organization";
        setSystemPrompt(buildSupportSystemPrompt({ organizationName, personName, project: detail.project, support, billing }));
      })
      .catch(() => { /* chat just won't be grounded yet — ticket list/stats above still load independently */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const sendAiMessage = async () => {
    if (!aiInput.trim() || thinking || !systemPrompt) return;
    const msg = aiInput;
    setAiInput("");
    const history: CopilotMessage[] = aiMessages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    setAiMessages(prev => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    try {
      const reply = await askCopilot(systemPrompt, history, msg);
      setAiMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: "ai", text: err instanceof Error ? err.message : "Something went wrong reaching the AI assistant." }]);
    } finally {
      setThinking(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their support tickets.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      {showNewTicket && data?.projectId && (
        <NewTicketDialog projectId={data.projectId} onClose={() => setShowNewTicket(false)} onCreated={load} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Support Center</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Tickets, live chat, and support assistant</p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          disabled={!data?.projectId}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: data?.projectId ? 1 : 0.5 }}
        >
          <Plus size={15} />
          Raise Ticket
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading tickets...</p>
        </div>
      )}

      {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Open Tickets", value: String(data.openCount), color: "#EF4444" },
              { label: "In Progress", value: String(data.inProgressCount), color: "#F59E0B" },
              { label: "Resolved (30d)", value: String(data.resolvedLast30dCount), color: "#10B981" },
              { label: "Avg Resolution", value: data.avgResolutionHours !== null ? `${data.avgResolutionHours.toFixed(1)}h` : "—", color: "#4C6EF5" },
            ].map(stat => (
              <GlassCard key={stat.label} className="p-4 text-center">
                <p style={{ color: stat.color, fontSize: 22, fontWeight: 700 }}>{stat.value}</p>
                <p style={{ color: "#8891B8", fontSize: 12 }}>{stat.label}</p>
              </GlassCard>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 flex flex-col gap-4">
              <GlassCard className="p-5">
                <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Support Tickets</p>
                {data.tickets.length === 0 && <p style={{ color: "#8891B8", fontSize: 13 }}>No tickets yet.</p>}
                <div className="flex flex-col gap-3">
                  {data.tickets.map((ticket) => {
                    const prio = prioConfig[ticket.priority];
                    const status = statusConfig[ticket.status];
                    const StatusIcon = status.icon;
                    return (
                      <div key={ticket.id} className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <StatusIcon size={15} style={{ color: status.color, marginTop: 2, flexShrink: 0 }} />
                            <div>
                              <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ticket.title}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span style={{ color: "#8891B8", fontSize: 11 }}>{ticket.ticketNumber}</span>
                                <span className="rounded-full px-2 py-0.5" style={{ background: prio.bg, color: prio.color, fontSize: 10, fontWeight: 600, textTransform: "capitalize" }}>{ticket.priority}</span>
                                <span className="rounded-full px-2 py-0.5" style={{ background: `${status.color}12`, color: status.color, fontSize: 10, fontWeight: 600 }}>{status.label}</span>
                                <span style={{ color: "#8891B8", fontSize: 11 }}>{ticket.assigneeName ? `Assigned to ${ticket.assigneeName}` : "Unassigned"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p style={{ color: "#8891B8", fontSize: 11 }}>{ticket.createdLabel}</p>
                            {ticket.slaLabel && <p style={{ color: "#F59E0B", fontSize: 11, marginTop: 2 }}>SLA: {ticket.slaLabel}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            <GlassCard className="flex flex-col overflow-hidden" style={{ height: 480 }}>
              <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}>
                  <Sparkles size={14} color="#fff" />
                </div>
                <div>
                  <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>Support Assistant</p>
                  <p style={{ color: "#10B981", fontSize: 10 }}>● Always available</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="rounded-xl px-3 py-2 max-w-xs"
                      style={{ background: msg.role === "ai" ? "rgba(255,255,255,0.05)" : "rgba(123,92,245,0.2)", border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(123,92,245,0.3)", color: "#E2E4F0", fontSize: 12, lineHeight: 1.6 }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <Loader2 size={13} color="#8891B8" className="animate-spin" />
                      <span style={{ color: "#8891B8", fontSize: 11 }}>Thinking…</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendAiMessage(); }}
                    placeholder="Ask a question…"
                    disabled={thinking}
                    className="flex-1 rounded-lg px-3 py-2 outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 12 }}
                  />
                  <button
                    onClick={sendAiMessage}
                    disabled={thinking || !aiInput.trim()}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(123,92,245,0.2)", color: "#C4B5FD", opacity: thinking || !aiInput.trim() ? 0.6 : 1 }}
                  >
                    {thinking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
