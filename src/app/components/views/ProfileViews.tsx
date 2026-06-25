import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, Mail, Phone, MapPin, Calendar, Plus, Camera,
  Target, Activity, Clock, Monitor, Users, Briefcase, Layers,
} from "lucide-react";
import { Avatar, Badge } from "../ui";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useEmployeeProfiles, useLeadsAsClients, useProjectTasks, useProjects, useTimesheets, useLeaveRequests } from "@/hooks/useSupabaseData";
import {
  createEmployee, createLead, createProject, assignProjectTeam,
  updateEmployeeProfile, getEmployeeProjects, getEmployeeRecentTasks,
  buildWeeklyHoursFromTimesheets, initialsFromName,
} from "@/lib/database";
import { SHIFT_START_OPTIONS, formatShiftStartLabel } from "@/lib/shiftTimeline";
import { ProfilePhotoUpload } from "../ProfilePhotoUpload";
import { APP_ROLE_OPTIONS, isAdminRole, isExecutiveProfile } from "@/lib/auth";
import { namesMatch } from "@/lib/database";
import {
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidDateRange,
  isPositiveNumber,
} from "@/lib/validation";

const _employeeProfilesUnused = [
  {
    id: "E001", name: "Kavya Nair", role: "Senior Designer", dept: "Design", email: "kavya@base2brand.com",
    phone: "+91 98765 43210", location: "Bangalore", joined: "Mar 2023", score: 97, status: "Active",
    salary: "₹85,000", manager: "Priya Sharma", skills: ["Figma", "Illustrator", "Prototyping", "Brand Design", "Motion"],
    bio: "Top-performing designer with expertise in brand identity and enterprise UI. Consistently delivers above expectations.",
    weeklyHours: [{ day: "Mon", h: 8.5 }, { day: "Tue", h: 9 }, { day: "Wed", h: 8 }, { day: "Thu", h: 7.5 }, { day: "Fri", h: 6 }],
    recentTasks: [
      { title: "ERP Dashboard UI", status: "Done", due: "May 24" },
      { title: "Brand Identity v3", status: "Done", due: "May 22" },
      { title: "Mobile App Screens", status: "In Progress", due: "May 27" },
      { title: "Social Media Kit", status: "To Do", due: "May 30" },
    ],
    attendance: 98, leaves: 1, projects: 8, revenue: "₹8.2L",
  },
  {
    id: "E002", name: "Arjun Mehta", role: "Lead Developer", dept: "Development", email: "arjun@base2brand.com",
    phone: "+91 97654 32109", location: "Mumbai", joined: "Jan 2022", score: 88, status: "Active",
    salary: "₹1,10,000", manager: "Priya Sharma", skills: ["React", "Node.js", "TypeScript", "AWS", "PostgreSQL"],
    bio: "Full-stack lead with deep expertise in scalable SaaS architecture. Drives technical decisions for the dev team.",
    weeklyHours: [{ day: "Mon", h: 9 }, { day: "Tue", h: 8.5 }, { day: "Wed", h: 9.5 }, { day: "Thu", h: 8 }, { day: "Fri", h: 7 }],
    recentTasks: [
      { title: "API Gateway Refactor", status: "In Progress", due: "May 26" },
      { title: "Payment Integration", status: "In Review", due: "May 25" },
      { title: "Auth Middleware", status: "Done", due: "May 20" },
      { title: "DB Migration v4", status: "To Do", due: "Jun 1" },
    ],
    attendance: 95, leaves: 2, projects: 5, revenue: "₹12.4L",
  },
  {
    id: "E003", name: "Priya Sharma", role: "Dev Lead", dept: "Development", email: "priya@base2brand.com",
    phone: "+91 96543 21098", location: "Hyderabad", joined: "Jun 2021", score: 94, status: "Active",
    salary: "₹1,25,000", manager: "CEO Admin", skills: ["System Design", "React", "Go", "DevOps", "Agile"],
    bio: "Senior engineering lead overseeing cross-functional delivery. Champion of clean architecture and team velocity.",
    weeklyHours: [{ day: "Mon", h: 8 }, { day: "Tue", h: 8 }, { day: "Wed", h: 9 }, { day: "Thu", h: 8.5 }, { day: "Fri", h: 7.5 }],
    recentTasks: [
      { title: "Q2 Sprint Planning", status: "Done", due: "May 18" },
      { title: "Tech Debt Audit", status: "In Progress", due: "May 28" },
      { title: "Team Hiring Review", status: "Done", due: "May 22" },
      { title: "Architecture RFC", status: "In Review", due: "May 30" },
    ],
    attendance: 97, leaves: 1, projects: 6, revenue: "₹11.1L",
  },
];

const _clientProfilesUnused = [
  {
    id: "C001", company: "TechCorp Solutions", contact: "Rohit Verma", title: "CTO",
    email: "rohit@techcorp.io", phone: "+91 98001 12345", location: "Delhi NCR",
    value: "₹18.4L", stage: "Proposal Sent", temperature: "Hot",
    since: "Feb 2024", industry: "SaaS", employees: "200–500",
    notes: "Key enterprise prospect. Has evaluated 3 other vendors. Decision expected by end of May. Needs custom API integration.",
    meetings: [
      { date: "May 20", type: "Video Call", outcome: "Positive — demo approved", duration: "45 min" },
      { date: "May 12", type: "In-Person", outcome: "Requirements gathered", duration: "90 min" },
      { date: "Apr 28", type: "Discovery Call", outcome: "Shortlisted", duration: "30 min" },
    ],
    proposals: [
      { name: "ERP Pro Suite v2", value: "₹18.4L", status: "Sent", date: "May 18" },
      { name: "Initial Scoping", value: "₹4.2L", status: "Rejected", date: "Apr 30" },
    ],
    payments: [] as { invoice: string; amount: string; status: string; date: string }[],
    tags: ["Enterprise", "API Required", "High Priority"],
  },
  {
    id: "C002", company: "FinEdge Capital", contact: "Sneha Iyer", title: "VP Operations",
    email: "sneha@finedge.in", phone: "+91 97002 23456", location: "Mumbai",
    value: "₹9.6L", stage: "Negotiation", temperature: "Warm",
    since: "Jan 2024", industry: "Fintech", employees: "50–200",
    notes: "Long sales cycle. Budget approved but legal review pending. Strong champion internally.",
    meetings: [
      { date: "May 22", type: "Video Call", outcome: "Pricing discussion", duration: "60 min" },
      { date: "May 8", type: "Demo", outcome: "Impressed with analytics", duration: "75 min" },
    ],
    proposals: [
      { name: "CRM Starter + Analytics", value: "₹9.6L", status: "Under Review", date: "May 10" },
    ],
    payments: [
      { invoice: "INV-001", amount: "₹1.5L", status: "Paid", date: "Feb 14" },
    ],
    tags: ["Fintech", "Negotiation", "Legal Hold"],
  },
  {
    id: "C003", company: "GreenLeaf Organics", contact: "Aditya Patel", title: "Founder",
    email: "aditya@greenleaf.com", phone: "+91 96003 34567", location: "Ahmedabad",
    value: "₹3.8L", stage: "Closed Won", temperature: "Cold",
    since: "Nov 2023", industry: "D2C / E-commerce", employees: "10–50",
    notes: "Active client. Social media kit delivered. Looking to expand to full marketing suite next quarter.",
    meetings: [
      { date: "May 15", type: "Check-in", outcome: "Happy with delivery", duration: "20 min" },
    ],
    proposals: [
      { name: "Social Media + Branding", value: "₹3.8L", status: "Accepted", date: "Dec 5" },
    ],
    payments: [
      { invoice: "INV-004", amount: "₹1.9L", status: "Paid", date: "Dec 10" },
      { invoice: "INV-007", amount: "₹1.9L", status: "Paid", date: "Mar 1" },
    ],
    tags: ["D2C", "Active Client", "Upsell Opportunity"],
  },
];

const screenshotData = [
  {
    id: "E001", name: "Kavya Nair", role: "Senior Designer", score: 97,
    screenshots: [
      { time: "11:02 AM", app: "Figma", title: "ERP Dashboard - Main Layout", active: true },
      { time: "11:28 AM", app: "Chrome", title: "Dribbble — Design Inspiration", active: false },
      { time: "12:05 PM", app: "Figma", title: "Mobile App Screens v3", active: true },
      { time: "1:15 PM", app: "Slack", title: "Team Channel — Design Review", active: true },
      { time: "2:40 PM", app: "Figma", title: "Brand Identity Revisions", active: true },
      { time: "3:22 PM", app: "Chrome", title: "YouTube — Lo-fi Playlist", active: false },
      { time: "4:05 PM", app: "Figma", title: "Social Media Kit Export", active: true },
    ],
    heatmap: [9,8,9,7,9,8,9,6,4,8,9,8,7,9,8,9,5,2,8,9,7,8,9,8],
    activeTime: "6h 14m", idleTime: "1h 46m", topApp: "Figma", topAppPct: 78,
  },
  {
    id: "E002", name: "Arjun Mehta", role: "Lead Developer", score: 88,
    screenshots: [
      { time: "11:00 AM", app: "VS Code", title: "api-gateway/routes.ts — editing", active: true },
      { time: "11:45 AM", app: "Chrome", title: "Stack Overflow — Node.js streams", active: true },
      { time: "12:30 PM", app: "VS Code", title: "auth/middleware.ts — refactor", active: true },
      { time: "2:00 PM", app: "Postman", title: "Payment API — testing endpoints", active: true },
      { time: "3:10 PM", app: "Chrome", title: "Reddit — r/programming", active: false },
      { time: "4:20 PM", app: "VS Code", title: "db/migrations/v4.sql", active: true },
    ],
    heatmap: [8,9,9,8,9,7,6,5,3,9,9,8,9,8,7,6,5,4,8,9,8,7,6,5],
    activeTime: "5h 58m", idleTime: "2h 02m", topApp: "VS Code", topAppPct: 72,
  },
];

export function EmployeeProfilePage({
  onBack,
  onNavigate,
  onProfileUpdated,
  userName = "",
  userRole = "employee",
}: {
  onBack: () => void;
  onNavigate?: (view: string, tab?: "employee" | "client" | "project" | "assign") => void;
  onProfileUpdated?: () => void;
  userName?: string;
  userRole?: string;
}) {
  const { data: employeeProfiles, loading, error, refresh } = useEmployeeProfiles();
  const { data: projects, refresh: refreshProjects } = useProjects();
  const { data: tasks } = useProjectTasks();
  const { data: timesheets } = useTimesheets();
  const { data: dbLeaves } = useLeaveRequests();
  const canManageAll = isAdminRole(userRole);
  const visibleProfiles = useMemo(
    () =>
      canManageAll
        ? employeeProfiles
        : employeeProfiles.filter(p => namesMatch(p.name, userName)),
    [employeeProfiles, canManageAll, userName]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [openPhotoPicker, setOpenPhotoPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", role: "", dept: "", email: "", phone: "", location: "",
    joined: "", salary: "", manager: "", bio: "", score: 85,
    profileImageUrl: "", shiftStart: "10:00",
  });

  useEffect(() => {
    if (visibleProfiles.length === 0) return;
    const mine = visibleProfiles.find(p => namesMatch(p.name, userName));
    setSelectedId(mine?.id ?? visibleProfiles[0].id);
  }, [visibleProfiles, userName]);

  const activeId = selectedId ?? visibleProfiles[0]?.id ?? "";
  const profile = visibleProfiles.find(e => e.id === activeId) ?? visibleProfiles[0];

  const weeklyHours = useMemo(() => {
    if (!profile) return [];
    return buildWeeklyHoursFromTimesheets(timesheets, profile.id, profile.name);
  }, [timesheets, profile]);

  const assignedProjects = useMemo(
    () => (profile ? getEmployeeProjects(projects, profile.name, profile.id) : []),
    [projects, profile]
  );

  const recentTasks = useMemo(
    () => (profile ? getEmployeeRecentTasks(tasks, profile.name, profile.id) : []),
    [tasks, profile]
  );

  const dynamicLeavesTaken = useMemo(() => {
    if (!profile) return 0;
    return dbLeaves
      .filter(l => l.employeeId === profile.id && l.status === "Approved")
      .reduce((sum, l) => sum + l.days, 0);
  }, [dbLeaves, profile]);

  if (loading) return <DataLoading label="Loading employee profiles..." />;
  if (error) return <DataError message={error} />;
  if (visibleProfiles.length === 0 || !profile) {
    return <DataEmpty message="Your employee profile was not found. Contact HR." />;
  }

  const emp = profile;
  const isOwnProfile = namesMatch(emp.name, userName);
  const maxH = Math.max(...weeklyHours.map(d => d.h), 8); // At least 8h scale

  const statsCards = [
    { label: "Attendance", value: `${emp.attendance}%`, color: "text-emerald-400" },
    { label: "Leaves Taken", value: dynamicLeavesTaken.toString(), color: "text-amber-400" },
    { label: "Active Projects", value: assignedProjects.length.toString(), color: "text-indigo-400" },
    ...(canManageAll
      ? [{ label: "Revenue Generated", value: emp.revenue, color: "text-violet-400" }]
      : []),
  ];

  function startEdit(opts?: { pickPhoto?: boolean }) {
    setEditForm({
      name: emp.name, role: emp.role, dept: emp.dept, email: emp.email,
      phone: emp.phone, location: emp.location, joined: emp.joined,
      salary: emp.salary, manager: emp.manager, bio: emp.bio, score: emp.score,
      profileImageUrl: emp.profileImageUrl || "",
      shiftStart: emp.shiftStart || "10:00",
    });
    setOpenPhotoPicker(!!opts?.pickPhoto);
    setEditing(true);
  }

  async function persistPhotoUrl(url: string) {
    setSaving(true);
    setSaveError("");
    try {
      await updateEmployeeProfile(emp.id, { profileImageUrl: url });
      refresh();
      onProfileUpdated?.();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save photo");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    try {
      const payload = canManageAll
        ? editForm
        : {
            phone: editForm.phone,
            location: editForm.location,
            bio: editForm.bio,
            profileImageUrl: editForm.profileImageUrl,
          };
      await updateEmployeeProfile(emp.id, payload);
      setEditing(false);
      setOpenPhotoPicker(false);
      setSaveOk(true);
      refresh();
      onProfileUpdated?.();
      setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    }
    setSaving(false);
  }

  const inputCls = "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 font-['Plus_Jakarta_Sans']";
  const labelCls = "block text-[10px] font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans']">
          <ChevronLeft size={14} /> Back
        </button>
        <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
          {canManageAll ? "Employee Profiles" : "My Profile"}
        </h2>
        {(canManageAll || isOwnProfile) && (
          <button onClick={editing ? saveEdit : () => startEdit()} disabled={saving}
            className="ml-auto px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 hover:bg-indigo-600/30">
            {saving ? "Saving..." : editing ? "Save Profile" : "Edit Profile"}
          </button>
        )}
        {editing && (
          <button onClick={() => { setEditing(false); setOpenPhotoPicker(false); }} className="px-3 py-1.5 text-xs text-[#6b7fa8] hover:text-white">Cancel</button>
        )}
      </div>

      {saveError && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">{saveError}</div>}
      {saveOk && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">Saved successfully!</div>}

      <div className={`grid gap-5 ${canManageAll ? "lg:grid-cols-[220px_1fr]" : ""}`}>
        {canManageAll && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-3 space-y-1 h-fit">
          {visibleProfiles.map(e => (
            <button key={e.id} onClick={() => { setSelectedId(e.id); setEditing(false); setSaveError(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${activeId === e.id ? "bg-indigo-600/15 border border-indigo-500/20" : "hover:bg-white/[0.03]"}`}>
              <Avatar
                initials={e.avatar || initialsFromName(e.name)}
                src={e.profileImageUrl || undefined}
                size="sm"
                color="bg-gradient-to-br from-indigo-600 to-violet-600"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{e.name}</p>
                <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{e.role}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => onNavigate?.("register", "employee")}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-indigo-400 hover:text-indigo-300 text-xs font-['Plus_Jakarta_Sans'] transition-colors"
          >
            <Plus size={12} /> Add Employee
          </button>
        </div>
        )}

        {/* Profile detail */}
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
            <div className="flex flex-wrap items-start gap-5">
              {editing ? (
                <ProfilePhotoUpload
                  initials={initialsFromName(editForm.name || emp.name)}
                  imageUrl={editForm.profileImageUrl}
                  onChange={url => {
                    setEditForm(f => ({ ...f, profileImageUrl: url }));
                    void persistPhotoUrl(url);
                  }}
                  disabled={saving}
                  autoOpen={openPhotoPicker}
                />
              ) : (
                <button
                  type="button"
                  onClick={isOwnProfile || canManageAll ? () => startEdit({ pickPhoto: true }) : undefined}
                  className={`relative group rounded-full shrink-0 ${isOwnProfile || canManageAll ? "cursor-pointer" : "cursor-default"}`}
                  title={isOwnProfile || canManageAll ? "Click to update profile photo" : undefined}
                >
                  <Avatar
                    initials={emp.avatar || initialsFromName(emp.name)}
                    src={emp.profileImageUrl || undefined}
                    size="xl"
                    color="bg-gradient-to-br from-indigo-600 to-violet-600"
                  />
                  {(isOwnProfile || canManageAll) && (
                    <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                      <Camera size={22} className="text-white" />
                      <span className="text-[9px] text-white mt-0.5 font-['Geist_Mono']">Update</span>
                    </div>
                  )}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">{emp.name}</h2>
                  <Badge variant="green">{emp.status}</Badge>
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{emp.id}</span>
                </div>
                <p className="text-sm text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-2">{emp.role} · {emp.dept}</p>
                {editing ? (
                  <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={2} className={`${inputCls} mt-2 resize-none`} />
                ) : (
                  <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed max-w-lg">{emp.bio}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-indigo-400 font-['Geist_Mono']">{emp.score}%</p>
                <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Productivity</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[rgba(99,102,241,0.08)]">
              {editing ? (
                canManageAll ? (
                  <>
                    <div><label className={labelCls}>Email</label><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Phone</label><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Location</label><input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Joined</label><input value={editForm.joined} onChange={e => setEditForm({ ...editForm, joined: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Role</label><input value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Department</label><input value={editForm.dept} onChange={e => setEditForm({ ...editForm, dept: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Manager</label><input value={editForm.manager} onChange={e => setEditForm({ ...editForm, manager: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Salary</label><input value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} className={inputCls} /></div>
                    <div>
                      <label className={labelCls}>Shift Start</label>
                      <select value={editForm.shiftStart} onChange={e => setEditForm({ ...editForm, shiftStart: e.target.value })} className={inputCls}>
                        {SHIFT_START_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div><label className={labelCls}>Phone</label><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Location</label><input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className={inputCls} /></div>
                  </>
                )
              ) : (
                [
                  { icon: Mail, label: "Email", value: emp.email },
                  { icon: Phone, label: "Phone", value: emp.phone },
                  { icon: MapPin, label: "Location", value: emp.location },
                  { icon: Calendar, label: "Joined", value: emp.joined },
                  { icon: Clock, label: "Shift", value: formatShiftStartLabel(emp.shiftStart) },
                ].map(f => (
                  <div key={f.label} className="flex items-start gap-2.5">
                    <f.icon size={13} className="text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{f.label}</p>
                      <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] mt-0.5 break-all">{f.value}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className={`grid gap-4 ${statsCards.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
            {statsCards.map(s => (
              <div key={s.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-1">{s.label}</p>
                <p className={`text-xl font-bold font-['Plus_Jakarta_Sans'] ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className={`grid gap-4 ${canManageAll ? "lg:grid-cols-2" : ""}`}>
            {/* Weekly hours — from timesheet entries */}
            <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1 font-['Plus_Jakarta_Sans']">Weekly Hours</h3>
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mb-4">This week · from time reports</p>
              <div className="flex items-end gap-2 h-32">
                {weeklyHours.every(d => d.h === 0) ? (
                  <p className="text-xs text-[#6b7fa8]">No hours logged this week yet.</p>
                ) : weeklyHours.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{d.h}h</span>
                    <div
                      className="w-full bg-indigo-600/70 rounded-t-md transition-all min-h-[4px]"
                      style={{ height: `${Math.max(4, (d.h / maxH) * 88)}px` }}
                    />
                    <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {canManageAll && (
              <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Skills & Expertise</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {emp.skills.map(s => (
                    <span key={s} className="text-xs font-['Plus_Jakarta_Sans'] text-indigo-300 bg-indigo-600/15 border border-indigo-500/20 px-3 py-1.5 rounded-full">{s}</span>
                  ))}
                </div>
                <div className="pt-3 border-t border-[rgba(99,102,241,0.08)] flex items-center justify-between text-xs font-['Plus_Jakarta_Sans']">
                  <span className="text-[#6b7fa8]">Manager</span>
                  <span className="text-[#e2e8f7]">{emp.manager}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-['Plus_Jakarta_Sans'] mt-2">
                  <span className="text-[#6b7fa8]">Salary</span>
                  <span className="text-emerald-400 font-semibold">{emp.salary}/mo</span>
                </div>
              </div>
            )}
          </div>

          {/* Assigned Projects */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Assigned Projects ({assignedProjects.length})</h3>
            {assignedProjects.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No projects assigned to {emp.name} yet.</p>
                <button
                  onClick={() => onNavigate?.("register", "assign")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-['Plus_Jakarta_Sans']"
                >
                  Assign Project to {emp.name.split(" ")[0]} →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {assignedProjects.map(p => {
                  const projectTasks = tasks.filter(
                    t =>
                      t.projectId === p.id &&
                      (t.assigneeId === emp.id || namesMatch(t.assignee, emp.name))
                  );
                  const doneCount = projectTasks.filter(t => t.status === "done").length;
                  const progress = projectTasks.length > 0
                    ? Math.round((doneCount / projectTasks.length) * 100)
                    : p.progress;
                  const statusLabel = p.status || "Active";
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                      <Layers size={14} className="text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{p.name}</p>
                        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">
                          {p.client || "Internal"} · Lead: {p.lead}
                          {projectTasks.length > 0 && ` · ${doneCount}/${projectTasks.length} tasks`}
                        </p>
                      </div>
                      <Badge variant={statusLabel.toLowerCase().includes("progress") ? "blue" : statusLabel.toLowerCase().includes("complete") ? "green" : "blue"}>
                        {statusLabel}
                      </Badge>
                      <span className="text-xs font-['Geist_Mono'] text-indigo-400 w-10 text-right">{progress}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent tasks */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Recent Tasks</h3>
            <div className="space-y-2">
              {recentTasks.length === 0 ? (
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No tasks assigned yet.</p>
              ) : recentTasks.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{t.title}</p>
                    <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] truncate">{t.project}</p>
                  </div>
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] shrink-0">Due {t.due}</span>
                  <Badge variant={t.status === "Done" ? "green" : t.status === "In Progress" ? "blue" : t.status === "In Review" ? "yellow" : "blue"}>{t.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientDetailPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (view: string, tab?: "employee" | "client" | "project" | "assign") => void;
}) {
  const { data: clientProfiles, loading, error } = useLeadsAsClients();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <DataLoading label="Loading leads as clients..." />;
  if (error) return <DataError message={error} />;
  if (clientProfiles.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans']">
            <ChevronLeft size={14} /> Back
          </button>
          <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Client & Lead Profiles</h2>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-10 text-center">
          <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-4">No clients yet. Add your first client to CRM.</p>
          <button
            onClick={() => onNavigate?.("register", "client")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl"
          >
            <Plus size={14} /> Add Client
          </button>
        </div>
      </div>
    );
  }

  const activeId = selectedId ?? clientProfiles[0].id;
  const client = clientProfiles.find(c => c.id === activeId) ?? clientProfiles[0];

  const tempColor = client.temperature === "Hot" ? "text-red-400 bg-red-500/10 border-red-500/20"
    : client.temperature === "Warm" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-blue-400 bg-blue-500/10 border-blue-500/20";

  const stageColor = client.stage === "Closed Won" ? "green" : client.stage === "Negotiation" ? "yellow" : client.stage === "Proposal Sent" ? "blue" : "blue";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans']">
          <ChevronLeft size={14} /> Back
        </button>
        <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Client & Lead Profiles</h2>
        <button
          onClick={() => onNavigate?.("register", "client")}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl transition-all"
        >
          <Plus size={13} /> Add Client
        </button>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-5">
        {/* Client list */}
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-3 space-y-1 h-fit">
          {clientProfiles.map(c => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${activeId === c.id ? "bg-indigo-600/15 border border-indigo-500/20" : "hover:bg-white/[0.03]"}`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white font-['Geist_Mono'] shrink-0">
                {c.company.slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{c.company}</p>
                <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{c.stage}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => onNavigate?.("register", "client")}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-indigo-400 hover:text-indigo-300 text-xs font-['Plus_Jakarta_Sans'] transition-colors"
          >
            <Plus size={12} /> Add Client
          </button>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
            <div className="flex flex-wrap items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-xl font-bold text-white font-['Plus_Jakarta_Sans'] shrink-0">
                {client.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">{client.company}</h2>
                  <Badge variant={stageColor as "green" | "yellow" | "blue"}>{client.stage}</Badge>
                  <span className={`text-[10px] font-['Geist_Mono'] px-2 py-0.5 rounded-full border ${tempColor}`}>{client.temperature}</span>
                </div>
                <p className="text-sm text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-2">{client.contact} · {client.title}</p>
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed max-w-lg">{client.notes}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {client.tags.map(t => (
                    <span key={t} className="text-[10px] font-['Geist_Mono'] text-indigo-300 bg-indigo-500/10 border border-indigo-500/15 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-emerald-400 font-['Geist_Mono']">{client.value}</p>
                <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Deal Value</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[rgba(99,102,241,0.08)]">
              {[
                { icon: Mail, label: "Email", value: client.email },
                { icon: Phone, label: "Phone", value: client.phone },
                { icon: MapPin, label: "Location", value: client.location },
                { icon: Briefcase, label: "Industry", value: client.industry },
              ].map(f => (
                <div key={f.label} className="flex items-start gap-2.5">
                  <f.icon size={13} className="text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{f.label}</p>
                    <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] mt-0.5 break-all">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Meeting logs */}
            <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Meeting Logs</h3>
              {client.meetings.length === 0 ? (
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No meetings yet.</p>
              ) : (
                <div className="space-y-3">
                  {client.meetings.map((m, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                      <div className="w-1 rounded-full bg-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m.type}</span>
                          <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{m.date} · {m.duration}</span>
                        </div>
                        <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{m.outcome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Proposals + Payments */}
            <div className="space-y-4">
              <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">Proposal History</h3>
                <div className="space-y-2">
                  {client.proposals.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{p.name}</p>
                        <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{p.date}</p>
                      </div>
                      <span className="text-xs font-bold font-['Geist_Mono'] text-indigo-400">{p.value}</span>
                      <Badge variant={p.status === "Accepted" ? "green" : p.status === "Rejected" ? "red" : p.status === "Sent" ? "blue" : "yellow"}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">Payment Status</h3>
                {client.payments.length === 0 ? (
                  <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No payments recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {client.payments.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                        <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] w-16 shrink-0">{p.invoice}</span>
                        <span className="flex-1 text-xs font-['Geist_Mono'] text-[#a8b5d1]">{p.amount}</span>
                        <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{p.date}</span>
                        <Badge variant={p.status === "Paid" ? "green" : "yellow"}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductivityTimelineView() {
  const [selectedId, setSelectedId] = useState(screenshotData[0].id);
  const emp = screenshotData.find(e => e.id === selectedId) ?? screenshotData[0];
  const heatHours = ["9","10","11","12","1","2","3","4","5","6"];

  function heatColor(val: number) {
    if (val >= 9) return "bg-indigo-500";
    if (val >= 7) return "bg-indigo-400/70";
    if (val >= 5) return "bg-indigo-400/40";
    if (val >= 3) return "bg-indigo-400/20";
    return "bg-[#131a35]";
  }

  return (
    <div className="space-y-5">
      {/* Header + selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans']">AI Productivity Intelligence</h2>
          <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">Screenshot timeline · Activity heatmap · App usage analysis</p>
        </div>
        <div className="flex gap-2">
          {screenshotData.map(e => (
            <button key={e.id} onClick={() => setSelectedId(e.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-['Plus_Jakarta_Sans'] transition-all ${selectedId === e.id ? "bg-indigo-600/15 border-indigo-500/30 text-white" : "border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-white"}`}>
              <Avatar initials={e.name.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
              {e.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Productivity Score", value: `${emp.score}%`, color: "text-indigo-400", icon: Target },
          { label: "Active Time", value: emp.activeTime, color: "text-emerald-400", icon: Activity },
          { label: "Idle Time", value: emp.idleTime, color: "text-amber-400", icon: Clock },
          { label: "Top App", value: `${emp.topApp} (${emp.topAppPct}%)`, color: "text-violet-400", icon: Monitor },
        ].map(c => (
          <div key={c.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{c.label}</span></div>
            <p className={`text-lg font-bold font-['Plus_Jakarta_Sans'] ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Activity Heatmap */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Activity Heatmap — Today</h3>
        <div className="flex items-center gap-2 mb-2">
          {heatHours.map((h, i) => (
            <div key={i} className="flex-1 text-center">
              <div className={`h-8 rounded-md mb-1 ${heatColor(emp.heatmap[i*2] ?? 0)}`} />
              <div className={`h-8 rounded-md mb-1.5 ${heatColor(emp.heatmap[i*2+1] ?? 0)}`} />
              <span className="text-[9px] font-['Geist_Mono'] text-[#6b7fa8]">{h}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[rgba(99,102,241,0.06)]">
          <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Intensity:</span>
          {["bg-[#131a35]","bg-indigo-400/20","bg-indigo-400/40","bg-indigo-400/70","bg-indigo-500"].map((c,i) => (
            <div key={i} className={`w-5 h-3 rounded ${c}`} />
          ))}
          <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">Low → High</span>
        </div>
      </div>

      {/* Screenshot Timeline */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Screenshot Timeline</h3>
        <div className="space-y-3">
          {emp.screenshots.map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] w-20 shrink-0 pt-2">{s.time}</span>
              <div className="flex items-start gap-3 flex-1 p-3 bg-[#131a35] border border-[rgba(99,102,241,0.08)] rounded-xl hover:border-indigo-500/20 transition-colors">
                {/* Simulated screenshot thumbnail */}
                <div className="w-24 h-16 rounded-lg bg-gradient-to-br from-[#1a2440] to-[#0d1326] border border-[rgba(99,102,241,0.12)] flex items-center justify-center shrink-0 overflow-hidden">
                  <div className="w-full h-full p-2 space-y-1">
                    <div className="h-1.5 bg-indigo-500/40 rounded w-3/4" />
                    <div className="h-1 bg-[#6b7fa8]/30 rounded w-full" />
                    <div className="h-1 bg-[#6b7fa8]/30 rounded w-2/3" />
                    <div className="h-3 bg-indigo-600/20 rounded w-full mt-1" />
                    <div className="h-1 bg-[#6b7fa8]/20 rounded w-4/5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{s.app}</span>
                    {!s.active && <span className="text-[9px] font-['Geist_Mono'] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Non-work</span>}
                  </div>
                  <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{s.title}</p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-0.5">{s.active ? "✓ Productive" : "⚠ Idle activity"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RegistrationFormsView({
  initialTab = "employee",
}: {
  initialTab?: "employee" | "client" | "project" | "assign";
}) {
  const { data: profiles, refresh: refreshProfiles } = useEmployeeProfiles();
  const { data: leads, refresh: refreshLeads } = useLeadsAsClients();
  const { data: projects, refresh: refreshProjects } = useProjects();

  const [activeForm, setActiveForm] = useState<"employee" | "client" | "project" | "assign">(initialTab);

  useEffect(() => {
    setActiveForm(initialTab);
  }, [initialTab]);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [empForm, setEmpForm] = useState({
    name: "", email: "", phone: "", dept: "", role: "", appRole: "employee",
    manager: "", salary: "", joining: "", location: "", profileImageUrl: "",
    shiftStart: "10:00",
  });
  const [clientForm, setClientForm] = useState({ company: "", contact: "", title: "", email: "", phone: "", industry: "", location: "", value: "", temp: "warm", source: "", notes: "" });
  const [projectForm, setProjectForm] = useState({ name: "", client: "", dept: "", start: "", end: "", budget: "", priority: "Medium", desc: "" });
  const [assignForm, setAssignForm] = useState({
    projectId: "",
    leadId: "",
    memberIds: [] as string[],
  });

  const managerOptions = [...new Set(["CEO Admin", ...profiles.map(p => p.name)])];
  const clientOptions = leads.map(l => l.company);
  const assignableEmployees = useMemo(
    () => profiles.filter(p => !isExecutiveProfile(p)),
    [profiles]
  );
  const employeeOptions = assignableEmployees;

  function clearErrors() {
    setFormError("");
    setFieldErrors({});
  }

  function validateEmployeeForm() {
    const errors: Record<string, string> = {};
    if (!isValidName(empForm.name)) errors.name = "Enter full name (min 2 characters).";
    if (!empForm.email.trim()) errors.email = "Work email is required.";
    else if (!isValidEmail(empForm.email)) errors.email = "Enter a valid email address.";
    if (empForm.phone.trim() && !isValidPhone(empForm.phone)) {
      errors.phone = "Enter valid phone (10–15 digits).";
    }
    if (!empForm.dept) errors.dept = "Select a department.";
    if (!isValidName(empForm.role)) errors.role = "Enter role / designation.";
    if (!empForm.appRole) errors.appRole = "Select app access role.";
    if (!empForm.joining) errors.joining = "Date of joining is required.";
    if (!isPositiveNumber(empForm.salary)) errors.salary = "Salary must be a positive number.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateClientForm() {
    const errors: Record<string, string> = {};
    if (!isValidName(clientForm.company)) errors.company = "Enter company name.";
    if (!isValidName(clientForm.contact)) errors.contact = "Enter contact person name.";
    if (!clientForm.email.trim()) errors.email = "Email is required.";
    else if (!isValidEmail(clientForm.email)) errors.email = "Enter a valid email address.";
    if (clientForm.phone.trim() && !isValidPhone(clientForm.phone)) {
      errors.phone = "Enter valid phone (10–15 digits).";
    }
    if (!isPositiveNumber(clientForm.value)) errors.value = "Deal value must be a positive number.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateProjectForm() {
    const errors: Record<string, string> = {};
    if (!isValidName(projectForm.name)) errors.name = "Enter project name.";
    if (!projectForm.start) errors.start = "Start date is required.";
    if (!projectForm.end) errors.end = "Deadline is required.";
    if (projectForm.start && projectForm.end && !isValidDateRange(projectForm.start, projectForm.end)) {
      errors.end = "Deadline must be on or after start date.";
    }
    if (!isPositiveNumber(projectForm.budget)) errors.budget = "Budget must be a positive number.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateAssignForm() {
    const errors: Record<string, string> = {};
    if (!assignForm.projectId) errors.projectId = "Select a project.";
    if (!assignForm.leadId) errors.leadId = "Select project lead.";
    if (assignForm.memberIds.length === 0) errors.memberIds = "Select at least one team member.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const fieldErrorCls = "text-[10px] text-rose-400 mt-1 font-['Plus_Jakarta_Sans']";

  async function handleSubmit() {
    setSubmitting(true);
    clearErrors();
    try {
      if (activeForm === "employee") {
        if (!validateEmployeeForm()) throw new Error("Please fix the highlighted fields.");
        await createEmployee(empForm);
        refreshProfiles();
        setEmpForm({
          name: "", email: "", phone: "", dept: "", role: "", appRole: "employee",
          manager: "", salary: "", joining: "", location: "", profileImageUrl: "",
          shiftStart: "10:00",
        });
        setSuccessMsg("Employee saved to database!");
      } else if (activeForm === "client") {
        if (!validateClientForm()) throw new Error("Please fix the highlighted fields.");
        await createLead(clientForm);
        refreshLeads();
        setClientForm({ company: "", contact: "", title: "", email: "", phone: "", industry: "", location: "", value: "", temp: "warm", source: "", notes: "" });
        setSuccessMsg("Client/Lead added to CRM!");
      } else if (activeForm === "project") {
        if (!validateProjectForm()) throw new Error("Please fix the highlighted fields.");
        const newId = await createProject(projectForm);
        refreshProjects();
        setProjectForm({ name: "", client: "", dept: "", start: "", end: "", budget: "", priority: "Medium", desc: "" });
        setAssignForm({ projectId: newId, leadId: "", memberIds: [] });
        setSuccessMsg("Project created! Assign project lead and team below.");
        setActiveForm("assign");
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 4000);
        return;
      } else if (activeForm === "assign") {
        if (!validateAssignForm()) throw new Error("Please fix the highlighted fields.");
        const leadProfile = assignableEmployees.find(p => p.id === assignForm.leadId);
        const memberProfiles = assignableEmployees.filter(p => assignForm.memberIds.includes(p.id));
        const team = [...new Set([leadProfile?.name, ...memberProfiles.map(p => p.name)].filter(Boolean))] as string[];
        await assignProjectTeam(assignForm.projectId, team, leadProfile?.name, {
          leadId: assignForm.leadId,
          memberIds: [...new Set([assignForm.leadId, ...assignForm.memberIds])],
        });
        refreshProjects();
        refreshProfiles();
        setAssignForm({ projectId: "", leadId: "", memberIds: [] });
        setSuccessMsg("Team assigned to project!");
      }
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setSuccessMsg(""); }, 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleAssignMember(employeeId: string) {
    setAssignForm(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(employeeId)
        ? prev.memberIds.filter(id => id !== employeeId)
        : [...prev.memberIds, employeeId],
    }));
  }

  const inputCls = "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
  const labelCls = "block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5";
  const selectCls = `${inputCls} cursor-pointer`;

  return (
    <div className="space-y-5">
      {/* Tab selector */}
      <div className="flex gap-1 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-1 w-fit">
        {[
          { id: "employee" as const, label: "Register Employee", icon: Users },
          { id: "client" as const, label: "Add Client / Lead", icon: Briefcase },
          { id: "project" as const, label: "New Project", icon: Layers },
          { id: "assign" as const, label: "Assign Project", icon: Target },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveForm(t.id); setSubmitted(false); setSuccessMsg(""); clearErrors(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-['Plus_Jakarta_Sans'] transition-all ${activeForm === t.id ? "bg-indigo-600 text-white" : "text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {formError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <p className="text-sm text-rose-400 font-['Plus_Jakarta_Sans']">{formError}</p>
        </div>
      )}
      {submitted && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
            <span className="text-[10px] text-white font-bold">✓</span>
          </div>
          <p className="text-sm text-emerald-400 font-['Plus_Jakarta_Sans']">
            {successMsg || "Saved successfully!"}
          </p>
        </div>
      )}

      {/* Employee Registration */}
      {activeForm === "employee" && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Employee Registration</h3>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Add a new team member to the platform</p>
            </div>
          </div>
          <div className="mb-6 pb-6 border-b border-[rgba(99,102,241,0.08)]">
            <label className={labelCls}>Profile Photo</label>
            <ProfilePhotoUpload
              initials={initialsFromName(empForm.name || "NA")}
              imageUrl={empForm.profileImageUrl}
              onChange={url => setEmpForm({ ...empForm, profileImageUrl: url })}
              disabled={submitting}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} placeholder="e.g. Rahul Sharma" className={`${inputCls} ${fieldErrors.name ? "border-rose-500/50" : ""}`} />
              {fieldErrors.name && <p className={fieldErrorCls}>{fieldErrors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Work Email *</label>
              <input value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} placeholder="rahul@base2brand.com" type="email" className={`${inputCls} ${fieldErrors.email ? "border-rose-500/50" : ""}`} />
              {fieldErrors.email && <p className={fieldErrorCls}>{fieldErrors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} placeholder="+91 98765 43210" className={`${inputCls} ${fieldErrors.phone ? "border-rose-500/50" : ""}`} />
              {fieldErrors.phone && <p className={fieldErrorCls}>{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className={labelCls}>Department *</label>
              <select value={empForm.dept} onChange={e => setEmpForm({...empForm, dept: e.target.value})} className={`${selectCls} ${fieldErrors.dept ? "border-rose-500/50" : ""}`}>
                <option value="">Select department</option>
                {["Development","Design","Marketing","HR & Operations","Sales","Finance"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {fieldErrors.dept && <p className={fieldErrorCls}>{fieldErrors.dept}</p>}
            </div>
            <div>
              <label className={labelCls}>Role / Designation *</label>
              <input value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})} placeholder="e.g. Senior Developer" className={`${inputCls} ${fieldErrors.role ? "border-rose-500/50" : ""}`} />
              {fieldErrors.role && <p className={fieldErrorCls}>{fieldErrors.role}</p>}
            </div>
            <div>
              <label className={labelCls}>Reporting Manager</label>
              <select value={empForm.manager} onChange={e => setEmpForm({...empForm, manager: e.target.value})} className={selectCls}>
                <option value="">Select manager</option>
                {managerOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Monthly Salary (₹)</label>
              <input value={empForm.salary} onChange={e => setEmpForm({...empForm, salary: e.target.value})} placeholder="e.g. 75000" type="number" min="1" className={`${inputCls} ${fieldErrors.salary ? "border-rose-500/50" : ""}`} />
              {fieldErrors.salary && <p className={fieldErrorCls}>{fieldErrors.salary}</p>}
            </div>
            <div>
              <label className={labelCls}>Date of Joining *</label>
              <input value={empForm.joining} onChange={e => setEmpForm({...empForm, joining: e.target.value})} type="date" className={`${inputCls} ${fieldErrors.joining ? "border-rose-500/50" : ""}`} />
              {fieldErrors.joining && <p className={fieldErrorCls}>{fieldErrors.joining}</p>}
            </div>
            <div>
              <label className={labelCls}>Work Location</label>
              <select value={empForm.location} onChange={e => setEmpForm({...empForm, location: e.target.value})} className={selectCls}>
                <option value="">Select location</option>
                {["Bangalore","Mumbai","Delhi","Hyderabad","Remote","Hybrid"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Shift Start Time *</label>
              <select value={empForm.shiftStart} onChange={e => setEmpForm({ ...empForm, shiftStart: e.target.value })} className={selectCls}>
                {SHIFT_START_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-[10px] text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">
                Used in Shift Tracker timeline for this employee
              </p>
            </div>
            <div>
              <label className={labelCls}>App Access Role *</label>
              <select
                value={empForm.appRole}
                onChange={e => setEmpForm({ ...empForm, appRole: e.target.value })}
                className={`${selectCls} ${fieldErrors.appRole ? "border-rose-500/50" : ""}`}
              >
                {APP_ROLE_OPTIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#6b7fa8] mt-1 font-['Plus_Jakarta_Sans']">
                Used for login access (employee_profiles.app_role)
              </p>
              {fieldErrors.appRole && <p className={fieldErrorCls}>{fieldErrors.appRole}</p>}
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-5 border-t border-[rgba(99,102,241,0.08)]">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-indigo-600/20">
              {submitting ? "Saving..." : "Register Employee →"}
            </button>
          </div>
        </div>
      )}

      {/* Client / Lead Form */}
      {activeForm === "client" && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shrink-0">
              <Briefcase size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Add Client or Lead</h3>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Register a new prospect or active client in CRM</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company Name *</label>
              <input value={clientForm.company} onChange={e => setClientForm({...clientForm, company: e.target.value})} placeholder="e.g. TechCorp Solutions" className={`${inputCls} ${fieldErrors.company ? "border-rose-500/50" : ""}`} />
              {fieldErrors.company && <p className={fieldErrorCls}>{fieldErrors.company}</p>}
            </div>
            <div>
              <label className={labelCls}>Primary Contact *</label>
              <input value={clientForm.contact} onChange={e => setClientForm({...clientForm, contact: e.target.value})} placeholder="Contact person name" className={`${inputCls} ${fieldErrors.contact ? "border-rose-500/50" : ""}`} />
              {fieldErrors.contact && <p className={fieldErrorCls}>{fieldErrors.contact}</p>}
            </div>
            <div>
              <label className={labelCls}>Title / Designation</label>
              <input value={clientForm.title} onChange={e => setClientForm({...clientForm, title: e.target.value})} placeholder="e.g. CTO, VP Sales" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} placeholder="contact@company.com" type="email" className={`${inputCls} ${fieldErrors.email ? "border-rose-500/50" : ""}`} />
              {fieldErrors.email && <p className={fieldErrorCls}>{fieldErrors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} placeholder="+91 98001 12345" className={`${inputCls} ${fieldErrors.phone ? "border-rose-500/50" : ""}`} />
              {fieldErrors.phone && <p className={fieldErrorCls}>{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <select value={clientForm.industry} onChange={e => setClientForm({...clientForm, industry: e.target.value})} className={selectCls}>
                <option value="">Select industry</option>
                {["SaaS","Fintech","E-commerce","Healthcare","Education","Manufacturing","Retail","Other"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={clientForm.location} onChange={e => setClientForm({...clientForm, location: e.target.value})} placeholder="City, State" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estimated Deal Value (₹)</label>
              <input value={clientForm.value} onChange={e => setClientForm({...clientForm, value: e.target.value})} placeholder="e.g. 1200000" type="number" min="1" className={`${inputCls} ${fieldErrors.value ? "border-rose-500/50" : ""}`} />
              {fieldErrors.value && <p className={fieldErrorCls}>{fieldErrors.value}</p>}
            </div>
            <div>
              <label className={labelCls}>Lead Source</label>
              <select value={clientForm.source} onChange={e => setClientForm({...clientForm, source: e.target.value})} className={selectCls}>
                <option value="">Select source</option>
                {["LinkedIn","Google Ads","Referral","Cold Outreach","Inbound","Event","Website"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Temperature</label>
              <select value={clientForm.temp} onChange={e => setClientForm({...clientForm, temp: e.target.value})} className={selectCls}>
                <option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={clientForm.notes} onChange={e => setClientForm({...clientForm, notes: e.target.value})}
                placeholder="Any important context, requirements, or background..."
                rows={3} className={`${inputCls} resize-none`} />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-5 border-t border-[rgba(99,102,241,0.08)]">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-emerald-600/20">
              {submitting ? "Saving..." : "Add to CRM →"}
            </button>
          </div>
        </div>
      )}

      {/* Project Form */}
      {activeForm === "project" && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center shrink-0">
              <Layers size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">New Project</h3>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Create project details — assign team from Assign Project tab</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Project Name *</label>
              <input value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder="e.g. TechCorp ERP Implementation" className={`${inputCls} ${fieldErrors.name ? "border-rose-500/50" : ""}`} />
              {fieldErrors.name && <p className={fieldErrorCls}>{fieldErrors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Client</label>
              <select value={projectForm.client} onChange={e => setProjectForm({...projectForm, client: e.target.value})} className={selectCls}>
                <option value="">Select client</option>
                {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Internal">Internal</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <select value={projectForm.dept} onChange={e => setProjectForm({...projectForm, dept: e.target.value})} className={selectCls}>
                <option value="">Select dept</option>
                {["Development","Design","Marketing","Cross-functional"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={projectForm.priority} onChange={e => setProjectForm({...projectForm, priority: e.target.value})} className={selectCls}>
                <option value="">Select priority</option>
                <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date *</label>
              <input value={projectForm.start} onChange={e => setProjectForm({...projectForm, start: e.target.value})} type="date" className={`${inputCls} ${fieldErrors.start ? "border-rose-500/50" : ""}`} />
              {fieldErrors.start && <p className={fieldErrorCls}>{fieldErrors.start}</p>}
            </div>
            <div>
              <label className={labelCls}>Deadline *</label>
              <input value={projectForm.end} onChange={e => setProjectForm({...projectForm, end: e.target.value})} type="date" className={`${inputCls} ${fieldErrors.end ? "border-rose-500/50" : ""}`} />
              {fieldErrors.end && <p className={fieldErrorCls}>{fieldErrors.end}</p>}
            </div>
            <div>
              <label className={labelCls}>Budget (₹)</label>
              <input value={projectForm.budget} onChange={e => setProjectForm({...projectForm, budget: e.target.value})} placeholder="e.g. 500000" type="number" min="1" className={`${inputCls} ${fieldErrors.budget ? "border-rose-500/50" : ""}`} />
              {fieldErrors.budget && <p className={fieldErrorCls}>{fieldErrors.budget}</p>}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Project Description</label>
              <textarea value={projectForm.desc} onChange={e => setProjectForm({...projectForm, desc: e.target.value})}
                placeholder="Describe project scope, goals, and deliverables..."
                rows={3} className={`${inputCls} resize-none`} />
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-5 border-t border-[rgba(99,102,241,0.08)]">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-violet-600/20">
              {submitting ? "Creating..." : "Create Project →"}
            </button>
          </div>
        </div>
      )}

      {/* Assign Project */}
      {activeForm === "assign" && (
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center shrink-0">
              <Target size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Assign Project to Team</h3>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Select project lead and team members</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Project *</label>
              <select value={assignForm.projectId} onChange={e => setAssignForm({ ...assignForm, projectId: e.target.value })} className={`${selectCls} ${fieldErrors.projectId ? "border-rose-500/50" : ""}`}>
                <option value="">Select project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.client})</option>)}
              </select>
              {fieldErrors.projectId && <p className={fieldErrorCls}>{fieldErrors.projectId}</p>}
            </div>
            <div>
              <label className={labelCls}>Project Lead *</label>
              <select value={assignForm.leadId} onChange={e => setAssignForm({ ...assignForm, leadId: e.target.value })} className={`${selectCls} ${fieldErrors.leadId ? "border-rose-500/50" : ""}`}>
                <option value="">Select project lead</option>
                {employeeOptions.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              {fieldErrors.leadId && <p className={fieldErrorCls}>{fieldErrors.leadId}</p>}
            </div>
            <div>
              <label className={labelCls}>Team Members *</label>
              <div className={`flex flex-wrap gap-2 p-3 bg-[#131a35] border rounded-xl ${fieldErrors.memberIds ? "border-rose-500/50" : "border-[rgba(99,102,241,0.1)]"}`}>
                {employeeOptions.map(emp => (
                  <button key={emp.id} type="button" onClick={() => toggleAssignMember(emp.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all font-['Plus_Jakarta_Sans'] ${
                      assignForm.memberIds.includes(emp.id)
                        ? "bg-amber-600/20 border-amber-500/40 text-amber-300"
                        : "border-[rgba(99,102,241,0.15)] text-[#6b7fa8] hover:text-white"
                    }`}>
                    {emp.name}
                  </button>
                ))}
              </div>
              {fieldErrors.memberIds && <p className={fieldErrorCls}>{fieldErrors.memberIds}</p>}
            </div>
          </div>
          <div className="flex justify-end mt-6 pt-5 border-t border-[rgba(99,102,241,0.08)]">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-amber-600/20">
              {submitting ? "Assigning..." : "Assign to Project →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
