import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Bot, User, Loader, TrendingUp, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { fetchAiManagerContext, type AiManagerContext } from "@/lib/database";
import { askCopilot, buildAiManagerSystemPrompt, type CopilotMessage } from "@/lib/copilotAi";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

type Msg = { role: "user" | "ai"; text: string };

const suggestedQuestions = [
  "What is delaying my project?",
  "When is launch expected?",
  "What did the team complete recently?",
  "Show all pending approvals",
  "Which tasks are blocked?",
  "What is the current budget status?",
];

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#C4B5FD;font-weight:600">$1</strong>');
    const styled = bold
      .replace(/^✅\s/, '<span style="color:#10B981">✅ </span>')
      .replace(/^🔴\s/, '<span style="color:#EF4444">🔴 </span>')
      .replace(/^🟡\s/, '<span style="color:#F59E0B">🟡 </span>');
    return (
      <p key={i} dangerouslySetInnerHTML={{ __html: styled }}
        style={{ color: line.startsWith("•") || line.startsWith("✅") || line.startsWith("🔴") || line.startsWith("🟡") ? "#C4C8E0" : "#E2E4F0", marginBottom: 4, fontSize: 13, lineHeight: 1.6 }}
      />
    );
  });
}

export function AIProjectManager({ organizationId, personName }: { organizationId?: string; personName?: string }) {
  const [context, setContext] = useState<AiManagerContext | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!organizationId) {
      setContext(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAiManagerContext(organizationId)
      .then(result => {
        if (cancelled) return;
        setContext(result);
        setSystemPrompt(buildAiManagerSystemPrompt(personName, result));
        setMessages([{
          role: "ai",
          text: result.project
            ? `Hello ${personName ?? "there"} 👋 I'm your AI Project Manager for ${result.project.name}. I have context on deliverables, budget, and team activity.\n\nHow can I help you today?`
            : `Hello ${personName ?? "there"} 👋 Your project isn't set up yet — check back once your engagement kicks off.`,
        }]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, personName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || thinking || !context || !systemPrompt) return;
    setInput("");
    const history: CopilotMessage[] = messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    try {
      const reply = await askCopilot(systemPrompt, history, msg);
      setMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: err instanceof Error ? err.message : "Something went wrong reaching the AI assistant." }]);
    } finally {
      setThinking(false);
    }
  };

  const project = context?.project ?? null;
  const statCards = [
    { label: "Project Health", value: project?.healthScore !== null && project?.healthScore !== undefined ? `${project.healthScore}%` : "—", icon: TrendingUp, color: "#10B981" },
    { label: "Pending Actions", value: context ? String(context.pendingDeliverablesCount + context.openTicketsCount) : "—", icon: Clock, color: "#F59E0B" },
    { label: "Sprint Progress", value: project ? `${project.progressPct}%` : "—", icon: CheckCircle, color: "#7B5CF5" },
    { label: "Blocked Tasks", value: context ? String(context.blockedTasksCount) : "—", icon: AlertTriangle, color: "#EF4444" },
  ];

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to talk to their AI Project Manager.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={22} color="#8891B8" className="animate-spin" />
        <p style={{ color: "#8891B8", fontSize: 13 }}>Loading project context...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}>
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ color: "#E2E4F0", fontSize: 16, fontWeight: 700 }}>AI Project Manager</h1>
            <p style={{ color: "#10B981", fontSize: 11 }}>● Online{project ? ` · Analyzing ${project.name}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}25` }}>
                <Icon size={13} style={{ color: stat.color }} />
                <div>
                  <p style={{ color: stat.color, fontSize: 13, fontWeight: 700 }}>{stat.value}</p>
                  <p style={{ color: "#8891B8", fontSize: 10 }}>{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: msg.role === "ai" ? "linear-gradient(135deg, #7B5CF5, #4C6EF5)" : "rgba(76,110,245,0.2)", border: msg.role === "user" ? "1px solid rgba(76,110,245,0.3)" : "none" }}
            >
              {msg.role === "ai" ? <Sparkles size={14} color="#fff" /> : <User size={14} color="#4C6EF5" />}
            </div>
            <div
              className="rounded-2xl px-4 py-3 max-w-2xl"
              style={{
                background: msg.role === "ai" ? "rgba(13,16,48,0.8)" : "linear-gradient(135deg, rgba(123,92,245,0.25), rgba(76,110,245,0.2))",
                border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(123,92,245,0.3)",
                borderRadius: msg.role === "ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
              }}
            >
              {msg.role === "ai" ? renderMarkdown(msg.text) : <p style={{ color: "#E2E4F0", fontSize: 13 }}>{msg.text}</p>}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}>
              <Sparkles size={14} color="#fff" />
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: "rgba(13,16,48,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 18px 18px 18px" }}>
              <Loader size={14} color="#7B5CF5" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#8891B8", fontSize: 12 }}>Analyzing project data…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-6 py-3 flex gap-2 flex-wrap flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {suggestedQuestions.slice(0, 4).map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            className="rounded-full px-3 py-1.5 text-xs transition-all"
            style={{ background: "rgba(123,92,245,0.1)", border: "1px solid rgba(123,92,245,0.2)", color: "#C4B5FD" }}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="px-6 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(13,16,48,0.8)", border: "1px solid rgba(123,92,245,0.25)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about your project…"
            className="flex-1 bg-transparent outline-none"
            style={{ color: "#E2E4F0", fontSize: 13 }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: input.trim() && !thinking ? "linear-gradient(135deg, #7B5CF5, #4C6EF5)" : "rgba(255,255,255,0.06)", color: input.trim() && !thinking ? "#fff" : "#8891B8" }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
