import { useEffect, useState } from "react";
import { Search, BookOpen, Sparkles, FileText, Video, Loader2 } from "lucide-react";
import { fetchKnowledgeArticles, fetchProjectDetail, fetchBillingData, fetchAllOrganizations, type KnowledgeArticle } from "@/lib/database";
import { askCopilot, buildKnowledgeBaseSystemPrompt, type CopilotMessage } from "@/lib/copilotAi";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

function iconFor(article: KnowledgeArticle) {
  if (article.sourceType === "meeting") return { icon: Video, color: "#4C6EF5" };
  return { icon: FileText, color: "#7B5CF5" };
}

type Msg = { role: "user" | "ai"; text: string };

export function KnowledgeBase({ organizationId }: { organizationId?: string }) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [aiMessages, setAiMessages] = useState<Msg[]>([
    { role: "ai", text: "I can answer questions about your project, documents, meeting notes, contract, and invoices. Ask me anything." },
  ]);

  useEffect(() => {
    if (!organizationId) {
      setArticles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetchKnowledgeArticles(organizationId),
      fetchProjectDetail(organizationId),
      fetchBillingData(organizationId),
      fetchAllOrganizations(),
    ])
      .then(([articleResults, detail, billing, orgs]) => {
        if (cancelled) return;
        setArticles(articleResults);
        const organizationName = orgs.find(o => o.id === organizationId)?.name ?? "your organization";
        setSystemPrompt(buildKnowledgeBaseSystemPrompt({
          organizationName,
          project: detail.project,
          changeRequests: detail.changeRequests,
          articles: articleResults,
          billing,
        }));
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load knowledge base."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  const sendQuery = async () => {
    if (!aiQuery.trim() || thinking || !systemPrompt) return;
    const q = aiQuery;
    setAiQuery("");
    const history: CopilotMessage[] = aiMessages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    setAiMessages(prev => [...prev, { role: "user", text: q }]);
    setThinking(true);
    try {
      const reply = await askCopilot(systemPrompt, history, q);
      setAiMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: "ai", text: err instanceof Error ? err.message : "Something went wrong reaching the AI assistant." }]);
    } finally {
      setThinking(false);
    }
  };

  const filtered = articles.filter(a =>
    search === "" || a.title.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase())
  );

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their knowledge base.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Knowledge Base</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Searchable project documents, notes, and decisions</p>
        </div>
      </div>

      <GlassCard className="p-5" style={{ background: "linear-gradient(135deg, rgba(123,92,245,0.12), rgba(76,110,245,0.08))", border: "1px solid rgba(123,92,245,0.2)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Knowledge Search</p>
            <p style={{ color: "#8891B8", fontSize: 11 }}>Ask anything about your project, meetings, or contracts</p>
          </div>
        </div>

        <div style={{ maxHeight: 300, overflowY: "auto" }} className="flex flex-col gap-3 mb-3">
          {aiMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="rounded-xl px-4 py-3 max-w-2xl"
                style={{ background: msg.role === "ai" ? "rgba(255,255,255,0.05)" : "rgba(123,92,245,0.2)", border: msg.role === "ai" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(123,92,245,0.3)", color: "#E2E4F0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Loader2 size={14} color="#8891B8" className="animate-spin" />
                <span style={{ color: "#8891B8", fontSize: 12 }}>Searching…</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendQuery(); }}
            placeholder="e.g. contract, brand guidelines, scope"
            disabled={thinking}
            className="flex-1 rounded-xl px-4 py-2.5 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 13 }}
          />
          <button
            onClick={sendQuery}
            disabled={thinking || !aiQuery.trim()}
            className="rounded-xl px-4 py-2.5 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: thinking || !aiQuery.trim() ? 0.6 : 1 }}
          >
            {thinking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>
      </GlassCard>

      <div>
        <div className="flex items-center justify-between mb-4">
          <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>Browse Documents</p>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Search size={13} color="#8891B8" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter documents…"
              className="bg-transparent outline-none"
              style={{ color: "#E2E4F0", fontSize: 12, width: 160 }}
            />
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={22} color="#8891B8" className="animate-spin" />
            <p style={{ color: "#8891B8", fontSize: 13 }}>Loading knowledge base...</p>
          </div>
        )}

        {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((article) => {
              const { icon: Icon, color } = iconFor(article);
              return (
                <div
                  key={`${article.sourceType}-${article.id}`}
                  className="flex items-center gap-3 rounded-xl p-4 cursor-pointer transition-all"
                  style={{ background: "rgba(13,16,48,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.title}</p>
                    <p style={{ color: "#8891B8", fontSize: 11 }}>{article.category} · {article.dateLabel}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-16">
                <BookOpen size={22} color="#8891B8" style={{ margin: "0 auto 8px" }} />
                <p style={{ color: "#8891B8", fontSize: 14 }}>Nothing here yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
