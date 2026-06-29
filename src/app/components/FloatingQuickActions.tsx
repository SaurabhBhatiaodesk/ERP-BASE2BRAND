import React, { useState, useRef, useEffect, useMemo } from "react";
import { Plus, CheckSquare, Phone, Calendar, Send, X, ChevronDown } from "lucide-react";
import { useEmployeeProfiles, useProjects } from "@/hooks/useSupabaseData";
import { addProjectTask, insertNotification } from "@/lib/database";
import { saveQuickAction } from "@/lib/quickActions";

function formatIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function FloatingQuickActions({ roleLabel }: { roleLabel?: string }) {
  const { data: profiles } = useEmployeeProfiles();
  const { data: projects } = useProjects();
  
  const [showQA, setShowQA] = useState(false);
  const [qaModal, setQaModal] = useState<string | null>(null);
  const [qaInput, setQaInput] = useState("");
  const [qaSelect, setQaSelect] = useState("");
  const [qaProject, setQaProject] = useState("");
  const [qaEst, setQaEst] = useState("4");
  const [qaDue, setQaDue] = useState(formatIso());
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaDone, setQaDone] = useState(false);
  const [qaSaving, setQaSaving] = useState(false);
  const [qaError, setQaError] = useState("");
  const qaMenuRef = useRef<HTMLDivElement>(null);

  const assignableEmployees = useMemo(
    () => profiles.filter(p => p.dept !== "Executive" && p.name !== "CEO Admin"),
    [profiles]
  );

  const departments = useMemo(() => {
    const depts = Array.from(new Set(profiles.map(p => p.dept).filter(Boolean))).sort();
    return ["All Staff", ...depts];
  }, [profiles]);

  const meetingInviteOptions = useMemo(() => {
    const teams = Array.from(new Set(profiles.map(p => p.dept).filter(Boolean)))
      .sort()
      .map(d => `${d} Team`);
    return ["All Staff", ...teams, ...assignableEmployees.map(p => p.name)];
  }, [profiles, assignableEmployees]);

  const selectedProfile = profiles.find(p => p.name === qaSelect);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (qaMenuRef.current && !qaMenuRef.current.contains(e.target as Node)) {
        setShowQA(false);
      }
    }
    if (showQA) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showQA]);

  useEffect(() => {
    if (!qaModal) return;
    setQaInput("");
    setQaSelect("");
    setQaProject(projects[0]?.id || "");
    setQaEst("4");
    setQaDue(formatIso());
    setQaDate("");
    setQaTime("");
    setQaError("");
    setQaDone(false);
  }, [qaModal, projects]);

  const allQuickActions = [
    { id: "assign", label: "Assign Task", icon: CheckSquare, color: "text-indigo-400" },
    { id: "call", label: "Call Employee", icon: Phone, color: "text-emerald-400" },
    { id: "meeting", label: "Schedule Meeting", icon: Calendar, color: "text-violet-400" },
    { id: "broadcast", label: "Broadcast Message", icon: Send, color: "text-amber-400" },
  ];

  const isMgmt = roleLabel === "CEO / Admin" || roleLabel === "Team Leader" || roleLabel === "HR Manager";
  const quickActions = isMgmt ? allQuickActions : allQuickActions.filter(a => a.id === "call" || a.id === "broadcast");

  async function submitQA() {
    setQaError("");
    setQaSaving(true);
    try {
      if (qaModal === "assign") {
        if (!qaProject) throw new Error("Please select a project.");
        if (!qaSelect) throw new Error("Please select an employee.");
        if (!qaInput.trim()) throw new Error("Please enter a task description.");
        if (!qaEst || Number(qaEst) <= 0) throw new Error("Please enter estimated hours.");
        await addProjectTask({
          projectId: qaProject,
          title: qaInput.trim(),
          assignee: qaSelect,
          status: "todo",
          priority: "medium",
          due: qaDue,
          est: qaEst,
        });
      } else if (qaModal === "call") {
        if (!qaSelect) throw new Error("Please select an employee.");
        
        const callMessage = qaInput.trim() || "Please come to my cabin";
        
        await saveQuickAction({
          type: "call",
          employee: qaSelect,
          message: callMessage,
          phone: selectedProfile?.phone,
        });

        if (selectedProfile?.id) {
          await insertNotification({
            recipientId: selectedProfile.id,
            title: roleLabel === "CEO" ? "CEO Calling" : "Message from Colleague",
            message: callMessage,
            type: "call"
          });
        }
      } else if (qaModal === "meeting") {
        if (!qaInput.trim()) throw new Error("Please enter a meeting title.");
        if (!qaDate) throw new Error("Please select a date.");
        if (!qaTime) throw new Error("Please select a time.");
        if (!qaSelect) throw new Error("Please select who to invite.");
        await saveQuickAction({
          type: "meeting",
          title: qaInput.trim(),
          date: qaDate,
          time: qaTime,
          invite: qaSelect,
        });
      } else if (qaModal === "broadcast") {
        if (!qaInput.trim()) throw new Error("Please enter a message.");
        
        const broadcastMsg = qaInput.trim();
        const audience = qaSelect || "All Staff";
        
        await saveQuickAction({
          type: "broadcast",
          message: broadcastMsg,
          audience,
        });

        const targets = audience === "All Staff" 
          ? assignableEmployees 
          : assignableEmployees.filter(p => p.dept === audience);
          
        await Promise.all(targets.map(p => {
          if (p.id) {
            return insertNotification({
              recipientId: p.id,
              title: `Broadcast: ${audience}`,
              message: broadcastMsg,
              type: "broadcast"
            });
          }
        }));
      }

      setQaDone(true);
      setTimeout(() => {
        setQaDone(false);
        setQaModal(null);
      }, 2000);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setQaSaving(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40" ref={qaMenuRef}>
        <button 
          onClick={() => setShowQA(v => !v)}
          className={`w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center hover:shadow-indigo-600/50 hover:scale-105 transition-all duration-200 ${showQA ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#06091a]" : ""}`}
        >
          <Plus size={20} className={`text-white transition-transform ${showQA ? "rotate-45" : ""}`} />
        </button>

        {showQA && (
          <div className="absolute right-0 bottom-full mb-3 w-48 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl overflow-hidden py-1">
            {quickActions.map(a => (
              <button
                key={a.id}
                onClick={() => { setQaModal(a.id); setShowQA(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
              >
                <a.icon size={14} className={`${a.color} shrink-0`} />
                <span className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {qaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setQaModal(null)}>
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            {qaDone ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-emerald-400 text-xl">✓</span>
                </div>
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                  {qaModal === "assign" ? "Task assigned!" : qaModal === "call" ? "Call notification sent!" : qaModal === "meeting" ? "Meeting scheduled!" : "Broadcast sent!"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    {(() => { const a = quickActions.find(x => x.id === qaModal)!; return <><div className={`w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center`}><a.icon size={16} className={a.color} /></div><p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">{a.label}</p></>; })()}
                  </div>
                  <button onClick={() => setQaModal(null)} className="p-2 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8]"><X size={16} /></button>
                </div>
                
                {qaModal === "assign" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Project</label>
                      <select value={qaProject} onChange={e => setQaProject(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                        <option value="">Select a project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Assign To</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                        <option value="">Select employee...</option>
                        {assignableEmployees.map(p => <option key={p.name} value={p.name}>{p.name} ({p.dept})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Task Details</label>
                      <input type="text" value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder="What needs to be done?" className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#6b7fa8] focus:outline-none focus:border-indigo-500/40" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Est. Hours</label>
                        <input type="number" min="0.5" step="0.5" value={qaEst} onChange={e => setQaEst(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Due Date</label>
                        <input type="date" value={qaDue} onChange={e => setQaDue(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40" />
                      </div>
                    </div>
                  </div>
                )}
                
                {qaModal === "call" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Who to call?</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                        <option value="">Select employee...</option>
                        {assignableEmployees.map(p => <option key={p.name} value={p.name}>{p.name} ({p.dept})</option>)}
                      </select>
                    </div>
                    {qaSelect && selectedProfile?.phone && (
                      <p className="text-xs text-indigo-400">Phone: {selectedProfile.phone}</p>
                    )}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Message (Optional)</label>
                      <input type="text" value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder="e.g. Please come to my cabin" className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#6b7fa8] focus:outline-none focus:border-indigo-500/40" />
                    </div>
                  </div>
                )}

                {qaModal === "meeting" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Meeting Title</label>
                      <input type="text" value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder="e.g. Weekly Sync" className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#6b7fa8] focus:outline-none focus:border-indigo-500/40" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Date</label>
                        <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Time</label>
                        <input type="time" value={qaTime} onChange={e => setQaTime(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Invite</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                        <option value="">Select who to invite...</option>
                        {meetingInviteOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {qaModal === "broadcast" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Audience</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40">
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6b7fa8] uppercase tracking-wider mb-1.5 font-['Geist_Mono']">Message</label>
                      <textarea value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder="Type your broadcast message here..." className="w-full h-24 resize-none bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#6b7fa8] focus:outline-none focus:border-indigo-500/40" />
                    </div>
                  </div>
                )}

                {qaError && (
                  <p className="mt-4 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                    {qaError}
                  </p>
                )}

                <div className="mt-6 flex gap-3">
                  <button onClick={() => setQaModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#6b7fa8] hover:bg-white/[0.04] transition-colors font-['Plus_Jakarta_Sans']">Cancel</button>
                  <button onClick={submitQA} disabled={qaSaving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 font-['Plus_Jakarta_Sans']">
                    {qaSaving ? "Saving..." 
                      : qaModal === "assign" ? "Assign Task" 
                      : qaModal === "call" ? "Send Call"
                        : qaModal === "meeting" ? "Schedule"
                        : "Send Broadcast"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
