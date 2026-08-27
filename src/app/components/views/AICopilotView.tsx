import React, { useState, useEffect, useRef } from "react";
import {
  Brain, Send, X, AlertTriangle, Zap, Users, TrendingUp,
  BarChart3, Target,
} from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { askOpenAICopilot, type ChatHistoryMessage } from "@/lib/copilotAi";
import { CopilotMessageContent } from "../CopilotMarkdown";

const copilotSuggestions = [
  { id: "s1", category: "Revenue", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/15", title: "TechCorp deal at risk", body: "No activity for 3 days on ₹18.4L proposal. Recommend a follow-up call today.", action: "Draft follow-up email" },
  { id: "s2", category: "Productivity", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/15", title: "Dev team overloaded", body: "Sprint #14 at 140% capacity. 3 tasks will likely slip. Suggest redistributing to Amit Kumar.", action: "Rebalance sprint" },
  { id: "s3", category: "HR", icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/15", title: "Rahul Gupta attendance pattern", body: "4 consecutive late logins. Productivity down 18% this week. Schedule a 1:1 check-in.", action: "Schedule meeting" },
  { id: "s4", category: "Growth", icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/15", title: "Hiring opportunity identified", body: "Content output dropped 22% QoQ. A Content Strategist hire would likely recover ₹3.2L/quarter.", action: "Open hiring pipeline" },
];

const copilotCommands = [
  { label: "Summarise today", prompt: "Give me a complete summary of today's operations, productivity, and any risks." },
  { label: "Who's underperforming?", prompt: "Who is underperforming this week and why? What should I do?" },
  { label: "Revenue forecast", prompt: "Based on current pipeline, what is my revenue forecast for next month?" },
  { label: "Top wins this week", prompt: "What are the top 3 wins across the team this week?" },
  { label: "Hiring needs", prompt: "Analyse workload and tell me which roles I should hire for urgently." },
  { label: "Risk report", prompt: "List all active risks across projects, clients, and team right now." },
];


export function AICopilotView() {
  const [messages, setMessages] = useState<{ role: "user" | "ai" | "system"; text: string }[]>([
    { role: "system", text: "init" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(text: string) {
    if (!text.trim() || typing) return;
    const history: ChatHistoryMessage[] = messages
      .filter(m => m.role !== "system")
      .slice(-8)
      .map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    try {
      const result = await askOpenAICopilot(text, history);
      setMessages(prev => [...prev, { role: "ai", text: result.content }]);
    } finally {
      setTyping(false);
    }
  }

  const visibleSuggestions = copilotSuggestions.filter(s => !dismissed.includes(s.id));

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5 h-[calc(100vh-9rem)]">

      {/* Main chat */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[rgba(99,102,241,0.1)] bg-gradient-to-r from-indigo-600/8 to-violet-600/8 shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/30">
            <Brain size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">B2B AI Copilot</p>
              <span className="text-[9px] font-['Geist_Mono'] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">ENTERPRISE</span>
            </div>
            <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] flex items-center gap-1 mt-0.5">
              <span className="text-red-500 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
                Live
              </span> · Connected to your live company data
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {["Team", "Revenue", "Clients", "HR"].map(tag => (
              <span key={tag} className="text-[9px] font-['Geist_Mono'] text-[#6b7fa8] bg-[#131a35] border border-[rgba(99,102,241,0.1)] px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Welcome */}
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Brain size={12} className="text-white" />
            </div>
            <div className="bg-[#131a35] border border-[rgba(99,102,241,0.1)] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
              <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] leading-relaxed">
                Good day. I'm your B2B AI Copilot — trained on your company data, team performance, pipeline, and operations.<br /><br />
                I can analyse your business in real-time, draft communications, flag risks, forecast revenue, and help you make faster decisions. What would you like to know?
              </p>
            </div>
          </div>

          {/* Quick command chips */}
          <div className="pl-10">
            <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mb-2">Quick commands:</p>
            <div className="flex flex-wrap gap-1.5">
              {copilotCommands.map(c => (
                <button key={c.label} onClick={() => send(c.prompt)}
                  className="text-[11px] font-['Plus_Jakarta_Sans'] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full hover:bg-indigo-500/20 transition-colors text-left">
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation */}
          {messages.filter(m => m.role !== "system").map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "ai" && (
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Brain size={12} className="text-white" />
                </div>
              )}
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-['Plus_Jakarta_Sans'] leading-relaxed ${
                m.role === "ai"
                  ? "bg-[#131a35] border border-[rgba(99,102,241,0.1)] text-[#e2e8f7] rounded-tl-sm"
                  : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-sm shadow-lg shadow-indigo-600/20 whitespace-pre-line"
              }`}>
                {m.role === "ai" ? <CopilotMessageContent content={m.text} /> : m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0">
                <Brain size={12} className="text-white" />
              </div>
              <div className="bg-[#131a35] border border-[rgba(99,102,241,0.1)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[rgba(99,102,241,0.08)] shrink-0">
          <div className="flex items-center gap-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 focus-within:border-indigo-500/40 transition-colors">
            <Brain size={13} className="text-indigo-400 shrink-0" />
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder="Ask anything — revenue, team, risks, strategy..."
              className="flex-1 bg-transparent text-xs text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none font-['Plus_Jakarta_Sans']" />
            <button onClick={() => send(input)}
              disabled={typing || !input.trim()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg transition-colors text-white shrink-0">
              <Send size={11} />
            </button>
          </div>
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-2 text-center">B2B AI Copilot · Powered by Base2Brand Intelligence Engine</p>
        </div>
      </div>

      {/* Right panel — proactive insights */}
      <div className="flex flex-col gap-4 overflow-y-auto">
        {/* Status */}
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Copilot Status</p>
          </div>
          {[
            { label: "Data freshness", value: "Live", color: "text-red-500 animate-pulse" },
            { label: "Data source", value: "Supabase", color: "text-indigo-400" },
            { label: "Model", value: "GPT-4o mini", color: "text-violet-400" },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-[rgba(99,102,241,0.06)] last:border-0">
              <span className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{s.label}</span>
              <span className={`text-[11px] font-bold font-['Geist_Mono'] ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Proactive suggestions */}
        <div>
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-widest mb-2 px-1">Proactive Insights</p>
          <div className="space-y-2">
            {visibleSuggestions.length === 0 ? (
              <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-400 font-['Plus_Jakarta_Sans']">✓ All insights addressed</p>
              </div>
            ) : visibleSuggestions.map(s => (
              <div key={s.id} className={`${s.bg} border rounded-xl p-4`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <s.icon size={13} className={s.color} />
                    <span className={`text-[9px] font-['Geist_Mono'] uppercase tracking-wider ${s.color}`}>{s.category}</span>
                  </div>
                  <button onClick={() => setDismissed(d => [...d, s.id])} className="text-[#6b7fa8] hover:text-white transition-colors shrink-0">
                    <X size={11} />
                  </button>
                </div>
                <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">{s.title}</p>
                <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed mb-3">{s.body}</p>
                <button onClick={() => send(s.body)}
                  className="text-[10px] font-['Geist_Mono'] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  {s.action} <ArrowUpRight size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Copilot capabilities */}
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-widest mb-3">What I can do</p>
          <div className="space-y-2">
            {[
              { icon: BarChart3, label: "Analyse revenue & pipeline" },
              { icon: Users, label: "Monitor team performance" },
              { icon: AlertTriangle, label: "Flag risks proactively" },
              { icon: Target, label: "Generate KPI reports" },
              { icon: Brain, label: "Draft emails & messages" },
              { icon: TrendingUp, label: "Forecast growth trends" },
            ].map(c => (
              <div key={c.label} className="flex items-center gap-2.5">
                <c.icon size={12} className="text-indigo-400 shrink-0" />
                <span className="text-[11px] text-[#a8b5d1] font-['Plus_Jakarta_Sans']">{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
