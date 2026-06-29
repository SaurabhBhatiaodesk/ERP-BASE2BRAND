import React, { useState, useId, useRef, useEffect, useMemo } from "react";
import {
  Users, CheckSquare, DollarSign, Target, TrendingUp, UserCheck,
  Briefcase, Layers, Calendar, Plus, ChevronDown, X, Phone, Send,
  Brain, AlertTriangle, Zap, ArrowUpRight, Circle
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell
} from "recharts";
import { StatCard, Avatar, Badge, CustomTooltip } from "../ui";
import { DataLoading, DataError } from "../ui/DataStatus";
import { revenueData, pieData, aiInsights, activityFeed } from "../../data";
import { useEmployees, useEmployeeProfiles, useProjects, useLeaveRequests } from "@/hooks/useSupabaseData";
import { addProjectTask, updateLeaveStatus } from "@/lib/database";
import { saveQuickAction } from "@/lib/quickActions";

function formatIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function CEODashboard() {
  const { data: employees, loading: empLoading, error: empError } = useEmployees();
  const { data: profiles, loading: profLoading } = useEmployeeProfiles();
  const { data: projects, loading: projLoading } = useProjects();
  const { data: leaves, refresh: refreshLeaves } = useLeaveRequests();
  const uid = useId().replace(/:/g, "");
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

  const loading = empLoading || profLoading || projLoading;
  const error = empError;

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

  function resetQaForm() {
    setQaInput("");
    setQaSelect("");
    setQaProject(projects[0]?.id || "");
    setQaEst("4");
    setQaDue(formatIso());
    setQaDate("");
    setQaTime("");
    setQaError("");
  }

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
        await saveQuickAction({
          type: "call",
          employee: qaSelect,
          message: qaInput.trim() || "Please come to my cabin",
          phone: selectedProfile?.phone,
        });
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
        await saveQuickAction({
          type: "broadcast",
          message: qaInput.trim(),
          audience: qaSelect || "All Staff",
        });
      }

      setQaDone(true);
      setTimeout(() => {
        setQaDone(false);
        setQaModal(null);
        resetQaForm();
      }, 2000);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setQaSaving(false);
    }
  }

  const quickActions = [
    { id: "assign", label: "Assign Task", icon: CheckSquare, color: "text-indigo-400" },
    { id: "call", label: "Call Employee", icon: Phone, color: "text-emerald-400" },
    { id: "meeting", label: "Schedule Meeting", icon: Calendar, color: "text-violet-400" },
    { id: "broadcast", label: "Broadcast Message", icon: Send, color: "text-amber-400" },
  ];

  if (loading) return <DataLoading label="Loading employees..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Command Center</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">Friday, May 23 · Base2Brand Infotech</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button className="flex items-center gap-2 px-3 py-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-[#a8b5d1] text-xs hover:border-indigo-500/40 transition-colors whitespace-nowrap">
            <Calendar size={13} /> Last 7 days <ChevronDown size={13} />
          </button>
          <div className="relative w-fit shrink-0" ref={qaMenuRef}>
            <button
              onClick={() => setShowQA(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs transition-colors font-['Plus_Jakarta_Sans'] whitespace-nowrap"
            >
              <Plus size={13} /> Quick Action <ChevronDown size={11} className={`transition-transform ${showQA ? "rotate-180" : ""}`} />
            </button>
            {showQA && (
              <div className="absolute right-0 top-full mt-1.5 min-w-full w-max bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                {quickActions.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setQaModal(a.id); setShowQA(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left whitespace-nowrap"
                  >
                    <a.icon size={14} className={`${a.color} shrink-0`} />
                    <span className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Modal */}
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
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    {(() => { const a = quickActions.find(x => x.id === qaModal)!; return <><div className={`w-9 h-9 rounded-xl bg-indigo-600/15 flex items-center justify-center`}><a.icon size={16} className={a.color} /></div><p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">{a.label}</p></>; })()}
                  </div>
                  <button onClick={() => setQaModal(null)} className="p-1.5 hover:bg-white/[0.05] rounded-lg text-[#6b7fa8] hover:text-white transition-colors"><X size={15} /></button>
                </div>

                {qaModal === "assign" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Project</label>
                      <select value={qaProject} onChange={e => setQaProject(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']">
                        <option value="">Select project</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Assign To</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']">
                        <option value="">Select employee</option>
                        {assignableEmployees.map(e => (
                          <option key={e.id} value={e.name}>{e.name} · {e.dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Task Description</label>
                      <textarea value={qaInput} onChange={e => setQaInput(e.target.value)} rows={3} placeholder="Describe the task..." className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans'] resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Due Date</label>
                        <input
                          type="date"
                          value={qaDue}
                          onChange={e => setQaDue(e.target.value)}
                          className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Estimated Hours</label>
                        <input
                          type="number"
                          min="0.5"
                          max="200"
                          step="0.5"
                          value={qaEst}
                          onChange={e => setQaEst(e.target.value)}
                          placeholder="e.g. 4"
                          className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {qaModal === "call" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Employee</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']">
                        <option value="">Select employee</option>
                        {assignableEmployees.map(e => (
                          <option key={e.id} value={e.name}>{e.name} · {e.dept}</option>
                        ))}
                      </select>
                    </div>
                    {selectedProfile?.phone && (
                      <p className="text-[11px] text-emerald-400 font-['Geist_Mono']">
                        Phone: {selectedProfile.phone}
                      </p>
                    )}
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Message / Reason</label>
                      <input value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder='e.g. "Please come to my cabin"' className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']" />
                    </div>
                    <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">The employee will receive an instant pop-up notification on their screen.</p>
                  </div>
                )}

                {qaModal === "meeting" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Meeting Title</label>
                      <input value={qaInput} onChange={e => setQaInput(e.target.value)} placeholder="e.g. Q2 Strategy Review" className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Date</label>
                        <input type="date" value={qaDate} onChange={e => setQaDate(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Time</label>
                        <input type="time" value={qaTime} onChange={e => setQaTime(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Invite Team</label>
                      <select value={qaSelect} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']">
                        <option value="">Select team / person</option>
                        {meetingInviteOptions.map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {qaModal === "broadcast" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Message</label>
                      <textarea value={qaInput} onChange={e => setQaInput(e.target.value)} rows={4} placeholder="Type your announcement..." className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans'] resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1.5">Send To</label>
                      <select value={qaSelect || "All Staff"} onChange={e => setQaSelect(e.target.value)} className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']">
                        {departments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {qaError && (
                  <p className="mt-4 text-xs text-red-400 font-['Plus_Jakarta_Sans']">{qaError}</p>
                )}

                <button
                  onClick={submitQA}
                  disabled={qaSaving}
                  className="w-full mt-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans']"
                >
                  {qaSaving
                    ? "Saving..."
                    : qaModal === "assign"
                      ? "Assign Task"
                      : qaModal === "call"
                        ? "Send Call Notification"
                        : qaModal === "meeting"
                          ? "Schedule Meeting"
                          : "Send Broadcast"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="TOTAL EMPLOYEES" value="38" sub="+3 this month" trend="up" icon={Users} color="bg-indigo-600" />
        <StatCard label="PRODUCTIVITY AVG" value="86.4%" sub="+4.2% vs last week" trend="up" icon={Target} color="bg-violet-600" />
        <StatCard label="MONTHLY REVENUE" value="₹8.4L" sub="+22% vs last month" trend="up" icon={DollarSign} color="bg-cyan-600" />
        <StatCard label="TASK COMPLETION" value="91.2%" sub="-1.8% vs last week" trend="down" icon={CheckSquare} color="bg-emerald-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ACTIVE EMPLOYEES" value="34" sub="4 idle right now" trend="neutral" icon={UserCheck} color="bg-emerald-600" />
        <StatCard label="OPEN LEADS" value="24" sub="6 hot, 12 warm" trend="up" icon={Briefcase} color="bg-amber-600" />
        <StatCard label="MONTHLY GROWTH" value="+22%" sub="vs ₹6.8L last month" trend="up" icon={TrendingUp} color="bg-indigo-600" />
        <StatCard label="ACTIVE PROJECTS" value="11" sub="3 at risk" trend="down" icon={Layers} color="bg-red-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Revenue vs Salary Cost</h3>
              <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mt-0.5">₹ in Lakhs · 2025</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-['Geist_Mono']">
              <span className="flex items-center gap-1 text-indigo-400"><Circle size={7} className="fill-indigo-400" /> Revenue</span>
              <span className="flex items-center gap-1 text-violet-400"><Circle size={7} className="fill-violet-400" /> Salary</span>
              <span className="flex items-center gap-1 text-emerald-400"><Circle size={7} className="fill-emerald-400" /> Profit</span>
            </div>
          </div>
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <linearGradient id={`${uid}gRev`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${uid}gProfit`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
              <XAxis dataKey="month" tick={{ fill: "#6b7fa8", fontSize: 11, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 11, fontFamily: "Geist Mono" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area key="area-revenue" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill={`url(#${uid}gRev)`} name="Revenue" />
              <Area key="area-salary" type="monotone" dataKey="salary" stroke="#8b5cf6" strokeWidth={2} fill="none" strokeDasharray="4 2" name="Salary" />
              <Area key="area-profit" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill={`url(#${uid}gProfit)`} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mb-1">Headcount by Dept</h3>
          <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mb-3">{employees.length} total employees</p>
          <ResponsiveContainer width="100%" height={140}>
            <RPieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                {pieData.map((entry, i) => <Cell key={`ceo-dept-${i}`} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, fontSize: 11 }} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] text-[#a8b5d1] font-['Geist_Mono']">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name}
                </span>
                <span className="text-[11px] text-white font-['Geist_Mono']">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-violet-600/15 rounded-lg">
              <Brain size={15} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">AI Insights</h3>
            <span className="ml-auto text-[10px] font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">4 alerts</span>
          </div>
          <div className="space-y-3">
            {aiInsights.map((ins, i) => (
              <div key={i} className={`p-3 rounded-lg border ${ins.type === "warning" ? "bg-amber-500/5 border-amber-500/15" : ins.type === "opportunity" ? "bg-emerald-500/5 border-emerald-500/15" : ins.type === "hiring" ? "bg-indigo-500/5 border-indigo-500/15" : "bg-violet-500/5 border-violet-500/15"} group`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{ins.title}</p>
                    <p className="text-[11px] text-[#6b7fa8] mt-0.5 leading-relaxed">{ins.desc}</p>
                    <button className="mt-2 text-[10px] font-['Geist_Mono'] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                      {ins.action} <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Live Activity</h3>
            <span className="flex items-center gap-1.5 text-[10px] font-['Geist_Mono'] text-red-500 font-bold">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
          <div className="space-y-3">
            {activityFeed.map((item, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <Avatar initials={item.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#e2e8f7] leading-snug">
                    <span className="font-semibold">{item.user}</span>
                    <span className="text-[#6b7fa8]"> {item.action} </span>
                    <span className="text-indigo-400">{item.target}</span>
                  </p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Top Performers</h3>
            <button className="text-[10px] font-['Geist_Mono'] text-indigo-400 hover:text-indigo-300 transition-colors">View all →</button>
          </div>
          <div className="space-y-3">
            {employees.map((emp) => (
              <div key={emp.name} className="flex items-center gap-3 group hover:bg-white/[0.02] rounded-lg p-1.5 -mx-1.5 transition-colors">
                <Avatar initials={emp.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate font-['Plus_Jakarta_Sans']">{emp.name}</p>
                  <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{emp.role}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge label={emp.status} variant={emp.status as "active" | "idle"} />
                  <span className={`text-xs font-bold font-['Geist_Mono'] ${emp.score >= 90 ? "text-emerald-400" : emp.score >= 80 ? "text-indigo-400" : "text-amber-400"}`}>{emp.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5 flex flex-col max-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Leave Requests</h3>
            <button onClick={refreshLeaves} className="text-[10px] font-['Geist_Mono'] text-indigo-400 hover:text-indigo-300 transition-colors">Refresh</button>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {leaves.filter(l => l.status === "Pending").length === 0 ? (
              <p className="text-xs text-[#6b7fa8]">No pending requests.</p>
            ) : (
              leaves.filter(l => l.status === "Pending").map((l) => (
                <div key={l.id} className="flex flex-col gap-2 p-3 bg-[#131a35] border border-[rgba(99,102,241,0.08)] rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar initials={l.employeeName.slice(0, 2)} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate font-['Plus_Jakarta_Sans']">{l.employeeName}</p>
                      <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{l.leaveType} · {l.days}d</p>
                    </div>
                  </div>
                  {l.reason && <p className="text-[10px] text-[#6b7fa8] italic">"{l.reason}"</p>}
                  <div className="flex gap-2 mt-1">
                    <button onClick={async () => { await updateLeaveStatus(l.id, "Approved", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType }); refreshLeaves(); }} className="flex-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 py-1.5 rounded-lg transition-colors">Approve</button>
                    <button onClick={async () => { await updateLeaveStatus(l.id, "Rejected", { employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType }); refreshLeaves(); }} className="flex-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 py-1.5 rounded-lg transition-colors">Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
