import React, { useState, useMemo } from "react";
import { Briefcase, Users, Plus, Target, Search, Clock, BadgeCheck, XSquare, CheckSquare, Award, XCircle, Filter, FileText, ClipboardList, TrendingUp, UserPlus } from "lucide-react";
import { Avatar } from "../ui";
import { Badge } from "../ui";
import { addATSInterview, addATSVacancy, updateATSInterviewStatus, updateATSVacancyStatus } from "@/lib/database";
import { useATSInterviews, useATSVacancies } from "@/hooks/useSupabaseData";

// --- MOCK DATA ---
const MOCK_VACANCIES = [
  { id: "v1", role: "Senior React Developer", department: "Development", status: "Open", applicants: 45, target: "Jun 15" },
  { id: "v2", role: "UI/UX Designer", department: "Design", status: "Open", applicants: 112, target: "Jun 20" },
  { id: "v3", role: "Marketing Manager", department: "Marketing", status: "Closed", applicants: 89, target: "May 30" },
  { id: "v4", role: "DevOps Engineer", department: "Development", status: "Open", applicants: 23, target: "Jul 01" },
];

const MOCK_INTERVIEWS_TODAY = [
  { id: "c1", name: "Rajat Sharma", role: "Senior React Developer", time: "11:00 AM", status: "Pending", avatar: "RS" },
  { id: "c2", name: "Anjali Verma", role: "UI/UX Designer", time: "02:30 PM", status: "Selected", avatar: "AV" },
  { id: "c3", name: "Kunal Singh", role: "DevOps Engineer", time: "04:00 PM", status: "Rejected", avatar: "KS" },
];

export function RecruitmentView() {
  const { data: dbInterviews, loading: loadingInv } = useATSInterviews();
  const { data: dbVacancies, loading: loadingVac } = useATSVacancies();

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewVacancy, setShowNewVacancy] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");
  
  const [showNewInterview, setShowNewInterview] = useState(false);
  const [newInvName, setNewInvName] = useState("");
  const [newInvRole, setNewInvRole] = useState("");
  const [newInvTime, setNewInvTime] = useState("");

  const interviews = dbInterviews || [];
  const vacancies = dbVacancies || [];

  const dynamicPipelineStats = useMemo(() => {
    const applied = vacancies.reduce((sum, v) => sum + (v.applicants || 0), 0);
    const offers = interviews.filter(i => i.status === "Selected").length;
    const hrScreening = Math.floor(applied * 0.3) + interviews.length;
    const technical = Math.floor(hrScreening * 0.4) + interviews.filter(i => i.status === "Pending").length;

    return [
      { stage: "Applied", count: applied, icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
      { stage: "HR Screening", count: hrScreening, icon: ClipboardList, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
      { stage: "Technical Round", count: technical, icon: FileText, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
      { stage: "Offer Extended", count: offers, icon: Award, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    ];
  }, [vacancies, interviews]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const interview = interviews.find(i => i.id === id);
    if (!interview || interview.status !== "Pending") return;

    try {
      await updateATSInterviewStatus(id, newStatus);
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleAddVacancy = async () => {
    if (!newRole.trim()) return;
    try {
      await addATSVacancy({
        role: newRole,
        department: newDept || "General",
        status: "Open",
        applicants: 0,
        target_date: "TBD"
      });
      setShowNewVacancy(false);
      setNewRole("");
      setNewDept("");
    } catch (e) {
      console.error("Failed to add vacancy", e);
    }
  };

  const toggleVacancyStatus = async (id: string, currentStatus: string) => {
    try {
      await updateATSVacancyStatus(id, currentStatus === "Open" ? "Closed" : "Open");
    } catch (e) {
      console.error("Failed to toggle status", e);
    }
  };

  const handleAddInterview = async () => {
    if (!newInvName.trim() || !newInvRole.trim()) return;
    const initials = newInvName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    try {
      await addATSInterview({
        candidate_name: newInvName,
        job_role: newInvRole,
        interview_time: newInvTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "Pending",
        avatar_initials: initials
      });
      setShowNewInterview(false);
      setNewInvName("");
      setNewInvRole("");
      setNewInvTime("");
    } catch (e) {
      console.error("Failed to add interview", e);
    }
  };

  const filteredVacancies = vacancies.filter(v => v.role.toLowerCase().includes(searchQuery.toLowerCase()) || v.department.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredInterviews = interviews.filter(inv => inv.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) || inv.job_role.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-3">
            <Briefcase className="text-indigo-400" size={24} />
            Recruitment Hub
          </h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-1">Applicant Tracking & Hiring Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#131a35] hover:bg-[#111828] text-[#a8b5d1] rounded-lg text-sm font-medium transition-colors border border-indigo-500/20">
            <Filter size={16} />
            Filter
          </button>
          <button 
            onClick={() => setShowNewVacancy(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
            <Plus size={16} />
            New Vacancy
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {dynamicPipelineStats.map(p => (
          <div key={p.stage} className={`bg-[#0d1326] backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden group hover:bg-[#131a35] hover:border-indigo-500/40 hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-300`}>
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full ${p.bg} blur-3xl group-hover:blur-2xl transition-all opacity-50`} />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-2 rounded-xl ${p.bg} border ${p.border} ${p.color}`}>
                <p.icon size={20} />
              </div>
              <TrendingUp size={16} className="text-[#6b7fa8] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-4xl font-bold text-white font-['Plus_Jakarta_Sans'] relative z-10 tracking-tight">{p.count}</p>
            <p className={`text-sm font-semibold font-['Geist_Mono'] mt-2 relative z-10 ${p.color}`}>{p.stage}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Vacancies */}
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-2">
              <Target size={18} className="text-indigo-400" />
              Active Vacancies
            </h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input 
                type="text" 
                placeholder="Search roles, names..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-48 bg-[#131a35] border border-indigo-500/20 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#6b7fa8] focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredVacancies.map(v => (
              <div key={v.id} className="bg-[#0d1326] backdrop-blur-md border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-[#131a35] transition-all duration-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">{v.role}</h3>
                    <p className="text-[11px] text-[#6b7fa8] font-['Geist_Mono'] uppercase tracking-wider mt-0.5">{v.department}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-8 w-full sm:w-auto">
                  <div className="flex flex-col items-start sm:items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#6b7fa8]">
                      <Clock size={12} className="text-indigo-400/70" />
                      Opened: <span className="text-[#a8b5d1]">{v.created_at ? new Date(v.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : "Just now"}</span>
                    </div>
                    {v.status === "Closed" ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-red-400/80">
                        <XCircle size={12} />
                        Closed: <span className="text-red-400 font-semibold">{v.closed_at ? new Date(v.closed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : "Recently"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                        <Target size={12} />
                        Target: <span className="text-emerald-400 font-semibold">{v.target_date}</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => toggleVacancyStatus(v.id, v.status)}
                    title="Click to toggle status"
                    className="shrink-0 hover:scale-105 transition-transform"
                  >
                    <Badge variant={v.status === "Open" ? "green" : "red"} className="shadow-sm w-20 justify-center">
                      {v.status}
                    </Badge>
                  </button>
                </div>
              </div>
            ))}
            {filteredVacancies.length === 0 && (
              <div className="bg-[#0d1326] border border-dashed border-indigo-500/20 rounded-xl p-8 flex items-center justify-center text-[#6b7fa8] text-sm">
                No vacancies found matching your search.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Today's Interviews */}
        <div className="lg:col-span-4 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans'] flex items-center gap-2">
              <UserPlus size={18} className="text-indigo-400" />
              Today's Interviews
            </h2>
            <button 
              onClick={() => setShowNewInterview(true)}
              className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md transition-colors"
              title="Add Interview"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="bg-[#0d1326] backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 space-y-3">
            {filteredInterviews.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-[#131a35] rounded-full flex items-center justify-center mb-3">
                  <UserPlus size={20} className="text-[#6b7fa8]" />
                </div>
                <p className="text-[#6b7fa8] text-sm">
                  {searchQuery ? "No interviews found matching your search." : "No interviews scheduled for today."}
                </p>
              </div>
            ) : (
              filteredInterviews.map(inv => (
                <div key={inv.id} className="bg-[#131a35] backdrop-blur-md border border-indigo-500/20 rounded-xl p-4 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar initials={inv.avatar_initials} size="md" color="bg-gradient-to-br from-indigo-500 to-indigo-700" />
                      <div>
                        <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{inv.candidate_name}</p>
                        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{inv.job_role}</p>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold font-['Geist_Mono'] bg-indigo-500/10 px-2 py-1 rounded text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                      <Clock size={10} /> {inv.interview_time}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 mt-2 border-t border-indigo-500/20">
                    {inv.status === "Pending" ? (
                      <>
                        <button onClick={() => handleUpdateStatus(inv.id, "Selected")} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors">
                          <CheckSquare size={14} /> Hire
                        </button>
                        <button onClick={() => handleUpdateStatus(inv.id, "Rejected")} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-semibold transition-colors">
                          <XSquare size={14} /> Reject
                        </button>
                      </>
                    ) : inv.status === "Selected" ? (
                      <div className="w-full py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Award size={14} /> Selected
                      </div>
                    ) : (
                      <div className="w-full py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5">
                        <XCircle size={14} /> Rejected
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Vacancy Modal */}
      {showNewVacancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewVacancy(false)}>
          <div className="w-full max-w-md bg-[#0d1326] border border-indigo-500/20 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-500/20">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Create New Vacancy</h3>
              <button type="button" onClick={() => setShowNewVacancy(false)} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-[#131a35] transition-colors">
                <XSquare size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wider font-['Geist_Mono']">Role Title</label>
                  <input 
                    type="text" 
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full bg-[#131a35] border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="e.g. Senior Frontend Developer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wider font-['Geist_Mono']">Department</label>
                  <input 
                    type="text" 
                    value={newDept}
                    onChange={e => setNewDept(e.target.value)}
                    className="w-full bg-[#131a35] border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="e.g. Engineering"
                  />
                </div>
                <button 
                  onClick={handleAddVacancy}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                  Create Vacancy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Interview Modal */}
      {showNewInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewInterview(false)}>
          <div className="w-full max-w-md bg-[#0d1326] border border-indigo-500/20 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-500/20">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Schedule Interview</h3>
              <button type="button" onClick={() => setShowNewInterview(false)} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-white hover:bg-[#131a35] transition-colors">
                <XSquare size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wider font-['Geist_Mono']">Candidate Name</label>
                  <input 
                    type="text" 
                    value={newInvName}
                    onChange={e => setNewInvName(e.target.value)}
                    className="w-full bg-[#131a35] border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="e.g. Rahul Verma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wider font-['Geist_Mono']">Job Role</label>
                  <input 
                    type="text" 
                    value={newInvRole}
                    onChange={e => setNewInvRole(e.target.value)}
                    className="w-full bg-[#131a35] border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="e.g. UI/UX Designer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wider font-['Geist_Mono']">Time</label>
                  <input 
                    type="time" 
                    value={newInvTime}
                    onChange={e => setNewInvTime(e.target.value)}
                    className="w-full bg-[#131a35] border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <button 
                  onClick={handleAddInterview}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-indigo-500/20">
                  Schedule Interview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
