import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Users, Calendar, Award, MoreHorizontal,
  Hash, Phone, Search, Send, Megaphone, X,
  MessageCircle, UserPlus, Paperclip, FileText, Loader2,
  CheckCheck, AlertCircle, Download, ExternalLink, Smile, Settings2, Edit, ImagePlay,
  ChevronLeft, ChevronRight, Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { Avatar, Badge } from "../ui";
import { DataLoading, DataError } from "../ui/DataStatus";
import { deptData, productivityData } from "../../data";
import { useEmployees, useEmployeeProfiles, useAttendance } from "@/hooks/useSupabaseData";
import { useChatChannelReads, useChatChannels, useChatMessages, useChatUnreadCounts } from "@/hooks/useChat";
import {
  findProfileForUser,
  getMessageDeliveryStatus,
  isMissingChatTables,
  markChatChannelRead,
  namesMatch,
  sendChatMessage,
  createGroupChannel,
  findOrCreateDmChannel,
  initialsFromName,
  type ChatChannel,
  type ChatChannelType,
  type ChatMessage,
  type EmployeeProfile,
  type MessageDeliveryStatus,
  updateGroupChannel,
  fetchTodayTeamClockSessions,
} from "@/lib/database";
import {
  fileDownloadUrl,
  fileNameFromUrl,
  fileOpenUrl,
  isCloudinaryConfigured,
  isFileUrl,
  isHttpUrl,
  isImageUrl,
  normalizeCloudinaryDeliveryUrl,
  uploadChatAttachment,
} from "@/lib/cloudinary";

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const URL_IN_TEXT_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/gi;

function linkClass(isOwn: boolean) {
  return isOwn
    ? "text-sky-300 underline underline-offset-2 hover:text-white break-all"
    : "text-indigo-400 underline underline-offset-2 hover:text-indigo-300 break-all";
}

function LinkifyText({ text, isOwn }: { text: string; isOwn: boolean }) {
  const parts = text.split(URL_IN_TEXT_RE);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          const href = isFileUrl(part) ? fileOpenUrl(part) : part;
          return (
            <a
              key={`${i}-${part.slice(0, 24)}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass(isOwn)}
              onClick={e => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function ChatFileAttachment({
  message,
  isOwn,
  timeClass,
}: {
  message: ChatMessage;
  isOwn: boolean;
  timeClass: string;
}) {
  const url = normalizeCloudinaryDeliveryUrl(message.mediaUrl);
  const name = message.fileName || fileNameFromUrl(url) || message.content || "Document";
  const openUrl = fileOpenUrl(url);
  const downloadHref = fileDownloadUrl(url, name);

  return (
    <div className="space-y-2 min-w-[200px] max-w-[280px]">
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${
          isOwn
            ? "bg-white/10 border-white/15 hover:bg-white/15"
            : "bg-[#0d1326] border-indigo-500/20 hover:bg-[#0d1326]/90"
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isOwn ? "bg-white/15" : "bg-indigo-600/20"}`}>
          <FileText size={20} className={isOwn ? "text-white" : "text-indigo-400"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate font-['Plus_Jakarta_Sans'] ${isOwn ? "text-white" : "text-[#e2e8f7]"}`}>
            {name}
          </p>
          {message.fileSize > 0 && (
            <p className={`text-[10px] font-['Geist_Mono'] ${timeClass}`}>
              {formatFileSize(message.fileSize)}
            </p>
          )}
        </div>
      </a>
      <div className="flex flex-wrap gap-3 px-1">
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-xs font-semibold font-['Plus_Jakarta_Sans'] ${linkClass(isOwn)}`}
        >
          <ExternalLink size={12} /> Open
        </a>
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-xs font-semibold font-['Plus_Jakarta_Sans'] ${linkClass(isOwn)}`}
        >
          <Download size={12} /> Download
        </a>
      </div>
    </div>
  );
}

function resolveOutgoingMessage(text: string) {
  const trimmed = text.trim();
  if (!isHttpUrl(trimmed)) {
    return { content: text, messageType: "text" as const };
  }
  if (isImageUrl(trimmed)) {
    return {
      content: trimmed,
      messageType: "image" as const,
      mediaUrl: trimmed,
      fileName: fileNameFromUrl(trimmed),
    };
  }
  if (isFileUrl(trimmed) || trimmed.includes("cloudinary.com")) {
    return {
      content: trimmed,
      messageType: "file" as const,
      mediaUrl: trimmed,
      fileName: fileNameFromUrl(trimmed),
    };
  }
  return { content: text, messageType: "text" as const };
}

export function HRView({
  onNavigate,
}: {
  onNavigate?: (view: string, options?: any) => void;
}) {
  const { data: employees, loading, error } = useEmployees();
  const { data: profiles } = useEmployeeProfiles();
  const [liveNames, setLiveNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTodayTeamClockSessions().then(sessions => {
      const names = new Set<string>();
      sessions.forEach(s => {
        if (s.status === "active") names.add(s.employeeName);
      });
      setLiveNames(names);
    }).catch(console.error);
  }, []);

  const liveEmployees = useMemo(() => employees.filter(emp => liveNames.has(emp.name)), [employees, liveNames]);

  if (loading) return <DataLoading label="Loading employees..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">HR & People Ops</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">{employees.length} employees total <span className="mx-1">·</span><span className="text-red-500 font-bold animate-pulse">{liveEmployees.length} live</span></p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.("register", "employee")}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs transition-colors"
        >
          <Plus size={13} /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Employees", value: employees.length, icon: Users, color: "from-indigo-600 to-violet-600" },
          { label: "On Leave", value: employees.filter(e => e.status === "leave").length, icon: Calendar, color: "from-amber-600 to-orange-600" },
          { label: "Avg Score", value: Math.round(employees.reduce((s, e) => s + e.score, 0) / Math.max(employees.length, 1)), icon: Award, color: "from-emerald-600 to-teal-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{stat.value}</p>
            <p className="text-xs text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-8 mb-4 gap-4">
        <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans']">Employee Directory</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
          <input 
            type="text" 
            placeholder="Search employee..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-[#131b2f] border border-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#6b7fa8] focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...employees]
          .filter(emp => (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (emp.role || "").toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(emp => (
          <div key={emp.name} className="bg-[#0f1528]/80 backdrop-blur-xl border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)] transition-all duration-300 flex flex-col gap-4 group">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar initials={emp.avatar} src={emp.profileImageUrl || undefined} size="lg" />
                <div>
                  <p className="text-sm font-bold text-white font-['Plus_Jakarta_Sans'] group-hover:text-indigo-300 transition-colors">{emp.name}</p>
                  <p className="text-xs text-indigo-300/80 font-['Geist_Mono'] mt-1">{emp.role}</p>
                  <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">{emp.dept}</p>
                </div>
              </div>
              {liveNames.has(emp.name) ? (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-[10px] font-bold font-['Geist_Mono'] text-red-400">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6b7fa8]" />
                  <span className="text-[10px] font-bold font-['Geist_Mono'] text-[#6b7fa8]">Offline</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 mt-auto border-t border-white/[0.05]">
              <button 
                onClick={() => {
                  const pid = profiles?.find(p => p.name === emp.name)?.id;
                  onNavigate?.("profiles", { profileId: pid });
                }}
                className="flex-1 flex justify-center text-xs font-semibold font-['Plus_Jakarta_Sans'] text-white bg-indigo-600/80 hover:bg-indigo-500 py-2 rounded-lg transition-colors border border-indigo-500/50">
                View Profile
              </button>
              <button 
                onClick={() => {
                  const pid = profiles?.find(p => p.name === emp.name)?.id;
                  onNavigate?.("profiles", { profileId: pid });
                }}
                className="px-3 py-2 text-[#8b99b8] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5">
                <Edit size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimesheetViewRoot({
  onNavigate,
}: {
  onNavigate?: (view: string, options?: any) => void;
}) {
  const { data: employees } = useEmployees();
  const { data: profiles } = useEmployeeProfiles();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Time Reports</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">Monthly Timesheet & Attendance</p>
        </div>
      </div>
      <HRTimesheetTab employees={employees} profiles={profiles} onNavigate={onNavigate} />
    </div>
  );
}

function getAttendanceStatus(hours: number) {
  if (hours === 0) return { label: "A", full: "Absent", color: "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)]" };
  if (hours >= 8) return { label: "P", full: "Full Day", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" };
  if (hours >= 6) return { label: "SL", full: "Short Leave", color: "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]" };
  if (hours >= 4.5) return { label: "HD", full: "Half Day", color: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]" };
  return { label: "P", full: "Present", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" };
}

function HRTimesheetTab({ employees, profiles, onNavigate }: { employees: any[], profiles: any[], onNavigate?: (view: string, options?: any) => void }) {
  const { data: attendance, loading } = useAttendance();
  const [monthOffset, setMonthOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate current month dates
  const monthDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);

    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), i));
    }
    return dates;
  }, [monthOffset]);

  const currentMonthName = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [monthOffset]);

  const handleExportCSV = () => {
    const headers = ["Employee Name", "Role", ...monthDates.map(d => `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`)];
    const rows = [...employees].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(emp => {
      const rowData = [emp.name, emp.role || "Employee"];
      monthDates.forEach(d => {
        const isFuture = d.getTime() > new Date().getTime();
        if (isFuture) {
          rowData.push("-");
          return;
        }
        
        const dateStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
        const records = attendance.filter(a => a.employee === emp.name && a.date === dateStr);
        const totalHours = Math.round(records.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;
        
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        if (totalHours === 0 && isWeekend) {
          rowData.push("W/O");
        } else {
          rowData.push(getAttendanceStatus(totalHours).label);
        }
      });
      return rowData.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Timesheet_${currentMonthName.replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <DataLoading label="Loading attendance..." />;

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden text-white transition-all duration-300 flex flex-col h-[calc(100vh-200px)]">
      <div className="p-5 border-b border-white/[0.05] bg-gradient-to-r from-white/[0.02] to-transparent flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <Calendar size={18} className="text-indigo-400" />
          Employee Timesheet
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input 
              type="text" 
              placeholder="Search employee..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 bg-[#131b2f] border border-white/[0.05] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#6b7fa8] focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
          <div className="flex items-center gap-2 bg-[#131b2f] p-1 rounded-lg border border-white/[0.05]">
            <button onClick={() => setMonthOffset(w => w - 1)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-xs font-semibold font-['Geist_Mono'] text-indigo-200 min-w-[120px] text-center">
              {currentMonthName}
            </span>
            <button onClick={() => setMonthOffset(w => w + 1)} disabled={monthOffset >= 0} className={`p-1.5 rounded-md transition-colors ${monthOffset >= 0 ? "opacity-30" : "hover:bg-white/10"}`}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      <div className="overflow-auto custom-scrollbar flex-1 relative px-2">
        <table className="w-full text-left border-separate border-spacing-y-2 min-w-max">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold text-indigo-200 font-['Plus_Jakarta_Sans'] uppercase tracking-wider sticky left-0 bg-[#131b2f] z-30 shadow-[4px_0_12px_rgba(0,0,0,0.2)] rounded-l-xl">Employee</th>
              {monthDates.map((d, index) => (
                <th key={d.toISOString()} className={`px-3 py-4 text-xs font-medium text-center font-['Geist_Mono'] text-[#8b99b8] min-w-[50px] bg-[#131b2f] ${index === monthDates.length - 1 ? 'rounded-r-xl' : ''}`}>
                  <span className="text-white font-semibold">{d.toLocaleDateString("en-US", { weekday: "short" })}</span><br/>
                  <span className="text-[10px]">{d.getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...employees]
              .filter(emp => (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (emp.role || "").toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(emp => {
              return (
                <tr 
                  key={emp.name} 
                  onClick={() => onNavigate?.("employee-timesheet", { employeeName: emp.name })}
                  className="group hover:bg-indigo-500/[0.03] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 whitespace-nowrap sticky left-0 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.2)] rounded-l-xl border-y border-l border-[rgba(99,102,241,0.15)] bg-[#0f1528] group-hover:bg-[#131a35] group-hover:border-[rgba(99,102,241,0.3)] transition-all">
                    <div className="flex items-center gap-3">
                      <Avatar initials={emp.avatar} src={emp.profileImageUrl || undefined} size="sm" />
                      <div>
                        <p className="text-sm font-semibold font-['Plus_Jakarta_Sans'] text-white group-hover:text-indigo-300 transition-colors">{emp.name}</p>
                        <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{emp.role || "Employee"}</p>
                      </div>
                    </div>
                  </td>
                  {monthDates.map((d, index) => {
                    const dateStr = [
                      d.getFullYear(),
                      String(d.getMonth() + 1).padStart(2, "0"),
                      String(d.getDate()).padStart(2, "0")
                    ].join("-");
                    
                    const isLast = index === monthDates.length - 1;
                    const tdClass = `px-3 py-3 text-center border-y border-[rgba(99,102,241,0.15)] bg-[#0d1326] group-hover:bg-[#131a35] group-hover:border-y-[rgba(99,102,241,0.3)] transition-all ${isLast ? 'border-r rounded-r-xl group-hover:border-r-[rgba(99,102,241,0.3)]' : ''}`;
                    
                    const records = attendance.filter(a => a.employee === emp.name && a.date === dateStr);
                    const totalHours = Math.round(records.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;
                    
                    const isFuture = d.getTime() > new Date().getTime();
                    if (isFuture) {
                      return <td key={dateStr} className={tdClass}>-</td>;
                    }

                    const status = getAttendanceStatus(totalHours);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    
                    if (totalHours === 0 && isWeekend) {
                      return <td key={dateStr} className={`${tdClass} text-[10px] text-[#6b7fa8] font-['Geist_Mono']`}>W/O</td>;
                    }

                    return (
                      <td key={dateStr} className={tdClass}>
                        <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold ${status.color}`} title={`${status.full} (${Math.round(totalHours * 10) / 10}h)`}>
                          {status.label}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="p-4 border-t border-white/[0.05] bg-black/20 flex items-center gap-5 flex-wrap text-[11px] font-medium font-['Geist_Mono'] text-[#a5b4fc] shrink-0">
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Full Day (≥8h)</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div> Short Leave (≥6h)</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Half Day (≥4.5h)</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Present (&lt;4.5h)</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Absent (0h)</div>
        <div className="flex items-center gap-2 ml-auto opacity-70">W/O = Week Off</div>
      </div>
    </div>
  );
}

export function EmployeeMonthlyTimesheetView({
  employeeName,
  onBack,
}: {
  employeeName?: string;
  onBack: () => void;
}) {
  const { data: attendance, loading } = useAttendance();
  const [monthOffset, setMonthOffset] = useState(0);

  // Calculate current month dates
  const monthDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    // Start of the selected month
    const year = now.getFullYear();
    const month = now.getMonth() + monthOffset;
    
    // Create date for 1st of the month
    const firstDay = new Date(year, month, 1);
    // Create date for last day of the month
    const lastDay = new Date(year, month + 1, 0);

    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), i));
    }
    return dates;
  }, [monthOffset]);

  // Calculate Stats
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let wo = 0;
    let totalHrs = 0;
    
    if (!employeeName) return { present, absent, wo, totalHrs };
    
    const now = new Date();
    
    monthDates.forEach(d => {
      // Don't count future dates for stats
      if (d.getTime() > now.getTime() && d.getDate() !== now.getDate()) return;
      
      const dateStr = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");
      
      const records = attendance.filter(a => a.employee === employeeName && a.date === dateStr);
      const hrs = records.reduce((sum, r) => sum + r.hours, 0);
      
      totalHrs += hrs;
      
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (hrs > 0) {
        present++;
      } else if (isWeekend) {
        wo++;
      } else {
        absent++;
      }
    });
    
    return { present, absent, wo, totalHrs };
  }, [monthDates, attendance, employeeName]);

  if (!employeeName) {
    return (
      <div className="p-8 text-center text-white">
        <p>No employee selected.</p>
        <button onClick={onBack} className="mt-4 text-indigo-400 underline">Go Back</button>
      </div>
    );
  }

  if (loading) return <DataLoading label="Loading attendance..." />;

  const monthLabel = monthDates[0].toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-indigo-500/30 bg-[#0f1528] text-white hover:bg-[#131b2f] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{employeeName}'s Timesheet</h1>
            <p className="text-indigo-300 text-sm font-['Geist_Mono'] mt-0.5">Monthly Attendance Report</p>
          </div>
        </div>
        <button
          onClick={() => {
            const rows = [["Date", "Day", "Status", "Clock In", "Clock Out", "Hours Worked"]];
            const now = new Date();
            
            monthDates.forEach(d => {
              if (d.getTime() > now.getTime() && d.getDate() !== now.getDate()) return;
              
              const dateStr = [
                d.getFullYear(),
                String(d.getMonth() + 1).padStart(2, "0"),
                String(d.getDate()).padStart(2, "0")
              ].join("-");
              
              const records = attendance.filter(a => a.employee === employeeName && a.date === dateStr);
              const totalHours = Math.round(records.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;
              
              const sortedRecords = [...records].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
              const firstClockIn = sortedRecords.length > 0 ? new Date(sortedRecords[0].clockIn) : null;
              const lastClockOut = sortedRecords.length > 0 && sortedRecords[sortedRecords.length - 1].clockOut 
                ? new Date(sortedRecords[sortedRecords.length - 1].clockOut!) 
                : null;
                
              const formatTime = (date: Date | null) => {
                if (!date || isNaN(date.getTime())) return "--:--";
                return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              };
              
              const status = getAttendanceStatus(totalHours);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const statusStr = (totalHours === 0 && isWeekend) ? "Week Off" : status.full;
              
              const formatDate = (date: Date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
              };
              
              rows.push([
                formatDate(d),
                d.toLocaleDateString("en-US", { weekday: "long" }),
                `"${statusStr}"`, // Wrap in quotes just in case
                `"${totalHours > 0 ? formatTime(firstClockIn) : "-"}"`,
                `"${totalHours > 0 ? formatTime(lastClockOut) : "-"}"`,
                totalHours > 0 ? (Math.round(totalHours * 10) / 10).toString() : "0"
              ]);
            });
            
            rows.push([]);
            rows.push(["Summary", "", "", "", "", ""]);
            rows.push(["Present Days", stats.present.toString(), "", "", "", ""]);
            rows.push(["Absent Days", stats.absent.toString(), "", "", "", ""]);
            rows.push(["Week Offs", stats.wo.toString(), "", "", "", ""]);
            rows.push(["Total Hours", (Math.round(stats.totalHrs * 10) / 10).toString(), "", "", "", ""]);
            
            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${employeeName.replace(/\s+/g, '_')}_Timesheet_${monthLabel.replace(/\s+/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium text-sm font-['Plus_Jakarta_Sans'] shadow-[0_0_15px_rgba(79,70,229,0.3)]"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f1528]/80 backdrop-blur-md border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] rounded-2xl p-5">
          <p className="text-emerald-400 text-xs font-semibold font-['Geist_Mono'] mb-1">Present Days</p>
          <p className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">{stats.present}</p>
        </div>
        <div className="bg-[#0f1528]/80 backdrop-blur-md border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)] rounded-2xl p-5">
          <p className="text-red-400 text-xs font-semibold font-['Geist_Mono'] mb-1">Absent Days</p>
          <p className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">{stats.absent}</p>
        </div>
        <div className="bg-[#0f1528]/80 backdrop-blur-md border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)] rounded-2xl p-5">
          <p className="text-indigo-400 text-xs font-semibold font-['Geist_Mono'] mb-1">Total Hours</p>
          <p className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">{Math.round(stats.totalHrs * 10) / 10}<span className="text-sm text-[#8b99b8] ml-1 font-normal">hrs</span></p>
        </div>
        <div className="bg-[#0f1528]/80 backdrop-blur-md border border-white/5 shadow-xl rounded-2xl p-5">
          <p className="text-[#8b99b8] text-xs font-semibold font-['Geist_Mono'] mb-1">Week Offs</p>
          <p className="text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">{stats.wo}</p>
        </div>
      </div>

      <div className="bg-[#0f1528]/80 backdrop-blur-xl border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden text-white transition-all duration-300">
        <div className="p-5 border-b border-white/[0.05] bg-gradient-to-r from-white/[0.02] to-transparent flex items-center justify-between">
          <h2 className="text-base font-bold font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <Calendar size={18} className="text-indigo-400" />
            {monthLabel} Details
          </h2>
          <div className="flex items-center gap-2 bg-[#131b2f] p-1 rounded-lg border border-white/[0.05]">
            <button onClick={() => setMonthOffset(m => m - 1)} className="p-1.5 hover:bg-white/10 rounded-md transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-xs font-semibold font-['Geist_Mono'] text-indigo-200 min-w-[110px] text-center">
              {monthLabel}
            </span>
            <button onClick={() => setMonthOffset(m => m + 1)} disabled={monthOffset >= 0} className={`p-1.5 rounded-md transition-colors ${monthOffset >= 0 ? "opacity-30" : "hover:bg-white/10"}`}><ChevronRight size={16} /></button>
          </div>
        </div>
        
        <div className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05] bg-[#131b2f]/50">
                <th className="px-6 py-4 text-xs font-semibold text-indigo-200 font-['Plus_Jakarta_Sans'] uppercase tracking-wider w-[20%]">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-indigo-200 font-['Plus_Jakarta_Sans'] uppercase tracking-wider w-[20%]">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-indigo-200 font-['Plus_Jakarta_Sans'] uppercase tracking-wider w-[30%]">Timings</th>
                <th className="px-6 py-4 text-xs font-semibold text-indigo-200 font-['Plus_Jakarta_Sans'] uppercase tracking-wider w-[30%]">Hours Worked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {monthDates.map(d => {
                const dateStr = [
                  d.getFullYear(),
                  String(d.getMonth() + 1).padStart(2, "0"),
                  String(d.getDate()).padStart(2, "0")
                ].join("-");
                
                const records = attendance.filter(a => a.employee === employeeName && a.date === dateStr);
                const totalHours = Math.round(records.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;
                
                // Sort records by clockIn to get first and last
                const sortedRecords = [...records].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
                const firstClockIn = sortedRecords.length > 0 ? new Date(sortedRecords[0].clockIn) : null;
                const lastClockOut = sortedRecords.length > 0 && sortedRecords[sortedRecords.length - 1].clockOut 
                  ? new Date(sortedRecords[sortedRecords.length - 1].clockOut!) 
                  : null;
                  
                const formatTime = (date: Date | null) => {
                  if (!date || isNaN(date.getTime())) return "--:--";
                  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                };
                
                // If it's a future date, show nothing
                const isFuture = d.getTime() > new Date().getTime();
                if (isFuture && d.getDate() !== new Date().getDate()) {
                  return (
                    <tr key={dateStr} className="bg-black/10">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-white/30 font-['Geist_Mono'] leading-tight">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                            <span className="text-sm font-bold text-white/30 font-['Plus_Jakarta_Sans'] leading-tight">{d.getDate()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold font-['Plus_Jakarta_Sans'] text-white/30">{d.toLocaleDateString("en-US", { weekday: "long" })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4" colSpan={3}><span className="text-white/20 text-xs italic">Future Date</span></td>
                    </tr>
                  );
                }

                const status = getAttendanceStatus(totalHours);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                
                let StatusDisplay = (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${status.color}`}>
                    {status.full}
                  </div>
                );

                if (totalHours === 0 && isWeekend) {
                  StatusDisplay = (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[#8b99b8] text-xs font-bold`}>
                      Week Off
                    </div>
                  );
                }

                return (
                  <tr key={dateStr} className={`group transition-colors ${isWeekend ? 'bg-white/[0.01] hover:bg-indigo-500/[0.02]' : 'hover:bg-indigo-500/[0.04]'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-indigo-300 font-['Geist_Mono'] leading-tight">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="text-sm font-bold text-white font-['Plus_Jakarta_Sans'] leading-tight">{d.getDate()}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-semibold font-['Plus_Jakarta_Sans'] ${isWeekend ? 'text-[#8b99b8]' : 'text-white'}`}>{d.toLocaleDateString("en-US", { weekday: "long" })}</p>
                          {isWeekend && <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Weekend</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {StatusDisplay}
                    </td>
                    <td className="px-6 py-4">
                      {totalHours > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-['Geist_Mono'] text-white font-medium bg-white/5 px-2 py-1 rounded border border-white/10">{formatTime(firstClockIn)}</span>
                          <span className="text-white/30 text-[10px]">-</span>
                          <span className="text-xs font-['Geist_Mono'] text-white font-medium bg-white/5 px-2 py-1 rounded border border-white/10">{formatTime(lastClockOut)}</span>
                        </div>
                      ) : (
                        <span className="text-[#8b99b8] text-xs font-['Geist_Mono']">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-[#131b2f] rounded-full overflow-hidden max-w-[120px] shadow-inner relative">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 relative ${totalHours >= 8 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : totalHours >= 6 ? 'bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : totalHours > 0 ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-transparent'}`}
                            style={{ width: `${Math.min(100, (totalHours / 8) * 100)}%` }}
                          >
                            {totalHours > 0 && <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full blur-[1px]"></div>}
                          </div>
                        </div>
                        <span className="text-sm font-semibold font-['Geist_Mono'] text-indigo-100 min-w-[40px]">
                          {totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="p-4 border-t border-white/[0.05] bg-black/20 flex items-center gap-5 flex-wrap text-[11px] font-medium font-['Geist_Mono'] text-[#a5b4fc]">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Full Day (≥8h)</div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div> Short Leave (≥6h)</div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Half Day (≥4.5h)</div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Present (&lt;4.5h)</div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> Absent (0h)</div>
          <div className="flex items-center gap-2 ml-auto opacity-70">W/O = Week Off</div>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Analytics</h1>
        <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">Team performance & productivity insights</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Department Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis dataKey="dept" tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }} />
              <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Productivity Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis dataKey="week" tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChatSetupBanner() {
  return (
    <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <p className="text-sm font-semibold text-amber-200 font-['Plus_Jakarta_Sans'] mb-1">
        Chat tables not set up yet
      </p>
      <p className="text-xs text-amber-200/80 font-['Geist_Mono']">
        Run <code className="text-amber-100">supabase/chat_full_setup.sql</code> in Supabase SQL Editor, then reload.
      </p>
    </div>
  );
}

type ChatTab = "dm" | "group";

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function channelIcon(type: ChatChannelType) {
  if (type === "dm") return MessageCircle;
  if (type === "group") return Users;
  return Hash;
}

function profilePhoto(
  profiles: EmployeeProfile[],
  senderId: string,
  senderName: string
) {
  const byId = profiles.find(p => p.id === senderId);
  if (byId?.profileImageUrl) return byId.profileImageUrl;
  const byName = profiles.find(p => namesMatch(p.name, senderName));
  return byName?.profileImageUrl || "";
}

function buildOptimisticMessage(
  channelId: string,
  user: { id: string; name: string },
  partial: Pick<ChatMessage, "content" | "messageType" | "mediaUrl" | "mediaType" | "fileName" | "fileSize">
): ChatMessage {
  return {
    id: `pending-${crypto.randomUUID()}`,
    channelId,
    senderId: user.id,
    senderName: user.name,
    content: partial.content,
    isBroadcast: false,
    messageType: partial.messageType ?? "text",
    mediaUrl: partial.mediaUrl ?? "",
    mediaType: partial.mediaType ?? "",
    fileName: partial.fileName ?? "",
    fileSize: partial.fileSize ?? 0,
    createdAt: new Date().toISOString(),
    clientStatus: "sending",
  };
}

function MessageStatusTicks({ status }: { status: MessageDeliveryStatus }) {
  if (status === "sending") {
    return <Loader2 size={12} className="animate-spin text-white/60 shrink-0" aria-label="Sending" />;
  }
  if (status === "failed") {
    return <AlertCircle size={12} className="text-rose-300 shrink-0" aria-label="Failed to send" />;
  }
  if (status === "read") {
    return (
      <CheckCheck
        size={13}
        className="text-[#53bdeb] shrink-0"
        strokeWidth={2.5}
        aria-label="Read"
      />
    );
  }
  return (
    <CheckCheck size={12} className="text-white/45 shrink-0" strokeWidth={2} aria-label="Delivered" />
  );
}

function MessageBubble({
  message,
  isOwn,
  showSenderName,
  photoUrl,
  deliveryStatus,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showSenderName: boolean;
  photoUrl?: string;
  deliveryStatus?: MessageDeliveryStatus;
}) {
  const bubbleBase = isOwn
    ? "bg-[#7c3aed] text-white rounded-[24px] rounded-br-sm shadow-[0_8px_20px_rgba(124,58,237,0.25)]"
    : "bg-white/[0.04] text-[#e2e8f7] border border-white/[0.08] rounded-[24px] rounded-bl-sm shadow-[0_8px_20px_rgba(0,0,0,0.15)] backdrop-blur-md";

  const timeClass = isOwn ? "text-white/75" : "text-[#6b7fa8]";

  const content = (
    <>
      {message.messageType === "image" && message.mediaUrl ? (
        <div className="mb-1">
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={message.mediaUrl}
              alt={message.content || "Image"}
              className="max-w-[240px] max-h-56 rounded-xl object-cover"
            />
          </a>
          {message.content && message.content !== message.fileName && (
            <p className="text-[15px] mt-2 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      ) : message.messageType === "file" && message.mediaUrl ? (
        <div className="mb-1">
          <ChatFileAttachment message={message} isOwn={isOwn} timeClass={timeClass} />
        </div>
      ) : (
        <div className="text-[15px] leading-relaxed font-['Plus_Jakarta_Sans']">
          <LinkifyText text={message.content} isOwn={isOwn} />
        </div>
      )}
      <div className={`flex items-center justify-end gap-1 mt-1.5 ${timeClass}`}>
        {message.isBroadcast && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-['Geist_Mono'] opacity-80 mr-1">
            <Megaphone size={10} /> Broadcast
          </span>
        )}
        <span className="text-[11px] font-['Plus_Jakarta_Sans'] font-medium flex items-center gap-1">
          {isOwn && <Eye size={12} className="opacity-70" />}
          <span className="ml-0.5 opacity-90">{formatMessageTime(message.createdAt)}</span>
        </span>
        {isOwn && deliveryStatus && (
          <div className="ml-1 opacity-90">
            <MessageStatusTicks status={deliveryStatus} />
          </div>
        )}
      </div>
    </>
  );

  if (isOwn) {
    return (
      <div className="flex justify-end items-end gap-2.5 pl-12 mb-4">
        <div className={`max-w-[78%] px-4 py-3 relative ${bubbleBase}`}>{content}</div>
        <Avatar
          initials={initialsFromName(message.senderName)}
          src={photoUrl || undefined}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-start items-end gap-2.5 pr-12 mb-4">
      <Avatar
        initials={initialsFromName(message.senderName)}
        src={photoUrl || undefined}
        size="sm"
      />
      <div className="min-w-0 max-w-[78%]">
        {showSenderName && (
          <p className="text-[11px] text-[#6b7fa8] mb-1 font-['Plus_Jakarta_Sans'] font-semibold ml-2">
            {message.senderName}
          </p>
        )}
        <div className={`px-4 py-3 relative ${bubbleBase}`}>{content}</div>
      </div>
    </div>
  );
}

export function ChatView({
  userName = "",
  userEmail = "",
  userRole = "employee",
  initialChannelId,
  onNavConsumed,
}: {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  initialChannelId?: string;
  onNavConsumed?: () => void;
}) {
  const { data: profiles } = useEmployeeProfiles();
  const currentUser = useMemo(
    () => findProfileForUser(profiles, userName, userEmail) ?? profiles[0],
    [profiles, userName, userEmail]
  );

  const { data: unreadCounts, refresh: refreshUnread } = useChatUnreadCounts(currentUser?.id ?? "");

  const {
    data: channels,
    loading: channelsLoading,
    error: channelsError,
    refresh: refreshChannels,
  } = useChatChannels(currentUser?.id ?? "");

  const [activeTab, setActiveTab] = useState<ChatTab>("dm");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [latestMsgs, setLatestMsgs] = useState<Record<string, { content: string, isOwn: boolean, time: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const currentMsgRef = useRef(msg);

  useEffect(() => {
    currentMsgRef.current = msg;
  }, [msg]);

  useEffect(() => {
    if (!showGifPicker) return;
    const delayDebounceFn = setTimeout(() => {
      setGifLoading(true);
      const query = gifSearch.trim() || "excited";
      fetch(`https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=12`)
        .then(res => res.json())
        .then(data => {
          setGifResults(data.results || []);
        })
        .catch(console.error)
        .finally(() => setGifLoading(false));
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [gifSearch, showGifPicker]);

  const chatChannels = useMemo(
    () => channels.filter(c => c.channelType === "dm" || c.channelType === "group"),
    [channels]
  );

  const tabChannels = useMemo(() => {
    let list = chatChannels.filter(c => c.channelType === activeTab);
    const q = channelSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(c => c.displayName.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      const aUnread = unreadCounts[a.id] ?? 0;
      const bUnread = unreadCounts[b.id] ?? 0;
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aTime = latestMsgs[a.id]?.time || a.createdAt || "";
      const bTime = latestMsgs[b.id]?.time || b.createdAt || "";
      const aMs = aTime ? new Date(aTime).getTime() : 0;
      const bMs = bTime ? new Date(bTime).getTime() : 0;
      if (aMs !== bMs) return bMs - aMs;

      return a.displayName.localeCompare(b.displayName);
    });
  }, [chatChannels, activeTab, channelSearchQuery, latestMsgs, unreadCounts]);

  const activeChannel = useMemo(
    () => tabChannels.find(c => c.id === activeChannelId) ?? tabChannels[0] ?? null,
    [tabChannels, activeChannelId]
  );

  useEffect(() => {
    if (initialChannelId && chatChannels.length > 0) {
      const ch = chatChannels.find(c => c.id === initialChannelId);
      if (ch) {
        if (ch.channelType === "dm" || ch.channelType === "group") {
          setActiveTab(ch.channelType);
        }
        setActiveChannelId(ch.id);
        if (onNavConsumed) onNavConsumed();
      }
    }
  }, [initialChannelId, chatChannels, onNavConsumed]);

  const {
    data: messages,
    loading: messagesLoading,
    error: messagesError,
    appendMessage,
    replaceMessage,
    patchMessage,
  } = useChatMessages(activeChannel?.id ?? null);

  const { data: channelReadStates, refresh: refreshReadStates } = useChatChannelReads(activeChannel?.id ?? null);

  const tablesMissing = channelsError ? isMissingChatTables(channelsError) : false;
  const cloudinaryReady = isCloudinaryConfigured();

  const otherProfiles = useMemo(() => {
    let list = profiles.filter(p => p.id !== currentUser?.id);
    const q = contactSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.role && p.role.toLowerCase().includes(q)));
    }
    return list;
  }, [profiles, currentUser?.id, contactSearchQuery]);

  const memberCount = activeChannel?.memberIds.length || 0;

  const activeDmPeer = useMemo(() => {
    if (!activeChannel || activeChannel.channelType !== "dm" || !currentUser) return undefined;
    return profiles.find(
      p => activeChannel.memberIds.includes(p.id) && p.id !== currentUser.id
    );
  }, [activeChannel, currentUser, profiles]);

  // Removed aggressive activeChannelId overwrite to allow optimistic UI and tab switching state retention
  useEffect(() => {
    if (!activeChannel?.id || !currentUser?.id) return;
    markChatChannelRead(activeChannel.id, currentUser.id)
      .then(() => {
        refreshUnread({ silent: true });
        refreshReadStates();
      })
      .catch(() => {});
  }, [activeChannel?.id, currentUser?.id, messages.length, refreshUnread, refreshReadStates]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages.length, activeChannel?.id]);

  const filteredMessages = useMemo(() => {
    // 1. Filter by search query
    let result = messages;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = messages.filter(
        m =>
          m.content.toLowerCase().includes(q) ||
          m.senderName.toLowerCase().includes(q) ||
          m.fileName.toLowerCase().includes(q)
      );
    }
    
    // 2. Aggressive deduplication by ID and by short-time-frame identical text 
    const uniqueMap = new Map<string, ChatMessage>();
    const contentMap = new Map<string, ChatMessage>();
    
    for (const m of result) {
      if (uniqueMap.has(m.id)) continue;
      
      if (!m.id.startsWith("temp-") && m.content.trim()) {
        const contentKey = `${m.senderId}-${m.content.trim().toLowerCase()}`;
        const existing = contentMap.get(contentKey);
        if (existing && !existing.id.startsWith("temp-")) {
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(existing.createdAt).getTime());
          if (timeDiff < 5000) continue; // within 5 seconds, identical text from same sender is considered a duplicate
        }
        contentMap.set(contentKey, m);
      }
      
      uniqueMap.set(m.id, m);
    }
    
    return Array.from(uniqueMap.values());
  }, [messages, searchQuery]);

  const totalUnread = useMemo(
    () => chatChannels.reduce((sum, ch) => sum + (unreadCounts[ch.id] ?? 0), 0),
    [chatChannels, unreadCounts]
  );

  const tabUnread = useMemo(() => {
    const counts: Record<ChatTab, number> = { group: 0, dm: 0 };
    for (const ch of chatChannels) {
      counts[ch.channelType as ChatTab] += unreadCounts[ch.id] ?? 0;
    }
    return counts;
  }, [chatChannels, unreadCounts]);

  function bumpChannelPreview(channelId: string, content: string, isOwn: boolean, time = new Date().toISOString()) {
    setLatestMsgs(prev => ({
      ...prev,
      [channelId]: { content, isOwn, time },
    }));
  }

  async function handleSend() {
    const text = currentMsgRef.current.trim();
    if (sendingRef.current || !activeChannel || !currentUser || !text) return;
    sendingRef.current = true;
    currentMsgRef.current = ""; // synchronously clear so rapid consecutive calls see empty text
    setMsg("");
    
    const outgoing = resolveOutgoingMessage(text);
    const optimistic = buildOptimisticMessage(activeChannel.id, currentUser, {
      content: outgoing.content,
      messageType: outgoing.messageType,
      mediaUrl: outgoing.mediaUrl || "",
      mediaType: "",
      fileName: outgoing.fileName || "",
      fileSize: 0,
    });
    setSending(true);
    setSendError("");
    appendMessage(optimistic);
    bumpChannelPreview(activeChannel.id, outgoing.content || "Message", true, optimistic.createdAt);
    try {
      const sent = await sendChatMessage({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: outgoing.content,
        messageType: outgoing.messageType,
        mediaUrl: outgoing.mediaUrl,
        fileName: outgoing.fileName,
        isBroadcast: false,
      });
      replaceMessage(optimistic.id, sent);
      bumpChannelPreview(activeChannel.id, sent.content || outgoing.content || "Message", true, sent.createdAt);
      refreshUnread({ silent: true });
    } catch (err) {
      patchMessage(optimistic.id, { clientStatus: "failed" });
      currentMsgRef.current = text;
      setMsg(text);
      setSendError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeChannel || !currentUser) return;

    const isImage = file.type.startsWith("image/");
    if (isImage && !cloudinaryReady) {
      setSendError("Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env");
      return;
    }

    setUploading(true);
    setSendError("");
    const caption = msg.trim() || file.name;
    const optimistic = buildOptimisticMessage(activeChannel.id, currentUser, {
      content: caption,
      messageType: isImage ? "image" : "file",
      mediaUrl: "",
      mediaType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
    appendMessage(optimistic);
    bumpChannelPreview(activeChannel.id, isImage ? "🖼️ Photo" : caption, true, optimistic.createdAt);
    try {
      const uploaded = await uploadChatAttachment(file);
      const sent = await sendChatMessage({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: caption,
        messageType: isImage ? "image" : "file",
        mediaUrl: uploaded.url,
        mediaType: file.type,
        fileName: file.name,
        fileSize: uploaded.bytes || file.size,
      });
      setMsg("");
      replaceMessage(optimistic.id, sent);
      refreshUnread({ silent: true });
    } catch (err) {
      patchMessage(optimistic.id, { clientStatus: "failed" });
      setSendError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleSendGif(gifUrl: string) {
    if (!activeChannel || !currentUser) return;
    
    setShowGifPicker(false);
    const caption = msg.trim() || "GIF";
    const optimistic = buildOptimisticMessage(activeChannel.id, currentUser, {
      content: caption,
      messageType: "image",
      mediaUrl: gifUrl,
      mediaType: "image/gif",
      fileName: "tenor.gif",
      fileSize: 0,
    });
    setSending(true);
    setSendError("");
    appendMessage(optimistic);
    bumpChannelPreview(activeChannel.id, "GIF", true, optimistic.createdAt);
    try {
      const sent = await sendChatMessage({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: caption,
        messageType: "image",
        mediaUrl: gifUrl,
        mediaType: "image/gif",
        fileName: "tenor.gif",
        isBroadcast: false,
      });
      setMsg("");
      replaceMessage(optimistic.id, sent);
      refreshUnread({ silent: true });
    } catch (err) {
      patchMessage(optimistic.id, { clientStatus: "failed" });
      setSendError(err instanceof Error ? err.message : "Failed to send GIF");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.repeat) return; // block held down key repeat
      handleSend();
    }
  }

  function selectChannel(channel: ChatChannel) {
    setActiveChannelId(channel.id);
    if (channel.channelType === "dm" || channel.channelType === "group") {
      setActiveTab(channel.channelType);
    }
    setSearchQuery("");
    setSearchOpen(false);
  }

  async function handleCreateGroup() {
    if (!currentUser || !groupName.trim()) return;
    setCreating(true);
    setSendError("");
    try {
      const channel = await createGroupChannel({
        name: groupName.trim(),
        createdBy: currentUser.id,
        memberIds: groupMembers,
      });
      setShowNewGroup(false);
      setGroupName("");
      setGroupMembers([]);
      setActiveTab("group");
      setActiveChannelId(channel.id);
      refreshChannels();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  async function handleEditGroup() {
    if (!activeChannel || !groupName.trim()) return;
    setCreating(true);
    setSendError("");
    try {
      await updateGroupChannel({
        channelId: activeChannel.id,
        name: groupName.trim(),
        memberIds: groupMembers,
      });
      setShowEditGroup(false);
      refreshChannels();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setCreating(false);
    }
  }

  function openEditGroupModal() {
    if (activeChannel?.channelType !== "group") return;
    setGroupName(activeChannel.displayName);
    setGroupMembers(activeChannel.memberIds);
    setShowEditGroup(true);
  }

  async function handleStartDm(peerId: string) {
    if (!currentUser) return;
    const peer = profiles.find(p => p.id === peerId);
    if (!peer) return;
    setCreating(true);
    setSendError("");
    try {
      const channel = await findOrCreateDmChannel({
        userId: currentUser.id,
        peerId: peer.id,
        userName: currentUser.name,
        peerName: peer.name,
      });
      setShowNewDm(false);
      setActiveTab("dm");
      setActiveChannelId(channel.id);
      refreshChannels();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setCreating(false);
    }
  }

  function toggleGroupMember(userId: string) {
    setGroupMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  useEffect(() => {
    if (tabChannels.length === 0) return;
    let cancelled = false;
    async function fetchLatest() {
      const channelIds = tabChannels.map(c => c.id);
      const { data } = await supabase
        .from("chat_messages")
        .select("channel_id, content, message_type, sender_id, sender_name, created_at")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false })
        .limit(300);
      
      if (cancelled || !data) return;
      const map: Record<string, { content: string, isOwn: boolean, time: string }> = {};
      for (const row of data) {
         if (!map[row.channel_id]) {
            const isOwn = Boolean(
              currentUser &&
                ((row.sender_id && row.sender_id === currentUser.id) ||
                  namesMatch(row.sender_name, currentUser.name))
            );
            let text = row.content || "";
            if (!text) {
               text = row.message_type === "image" ? "🖼️ Photo" : "📎 Attachment";
            }
            map[row.channel_id] = { content: text, isOwn, time: row.created_at };
         }
      }
      setLatestMsgs(map);
    }
    fetchLatest();
    return () => { cancelled = true; };
  }, [tabChannels, messages, currentUser, unreadCounts]);

  if (channelsLoading && chatChannels.length === 0) return <DataLoading label="Loading chat..." />;
  if (channelsError && !tablesMissing) return <DataError message={channelsError} />;

  const displayName = currentUser?.name || userName || "You";
  const displayInitials = initialsFromName(displayName);
  const statusLabel = currentUser?.status === "active" ? "Online" : currentUser?.status || "Online";
  const HeaderIcon = activeChannel ? channelIcon(activeChannel.channelType) : MessageCircle;
  const channelTitle = activeChannel?.displayName ?? "Select a chat";

  const tabs: { id: ChatTab; label: string }[] = [
    { id: "dm", label: "Direct" },
    { id: "group", label: "Groups" },
  ];


  return (
    <div className="space-y-0">
      {tablesMissing && <ChatSetupBanner />}
      {!cloudinaryReady && !tablesMissing && (
        <div className="mb-4 p-3 rounded-xl border border-sky-500/25 bg-sky-500/10">
          <p className="text-xs text-sky-200 font-['Geist_Mono']">
            Add Cloudinary env vars to send images and files in chat.
          </p>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-160px)] relative">
        <div className="w-64 bg-gradient-to-b from-[#0a0f25] to-[#050814] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-2xl relative z-10">
          <div className="p-3 border-b border-[rgba(99,102,241,0.1)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Messages</p>
              {totalUnread > 0 && (
                <span className="text-[10px] font-['Geist_Mono'] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-1.5 py-1.5 rounded-md text-[10px] font-['Geist_Mono'] transition-colors relative ${
                    activeTab === tab.id
                      ? "bg-indigo-600/25 text-indigo-300"
                      : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"
                  }`}
                >
                  {tab.label}
                  {tabUnread[tab.id] > 0 && (
                    <span className="absolute -top-1 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-2 py-2 border-b border-[rgba(99,102,241,0.08)] space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400/70" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "dm" ? "direct messages" : "groups"}...`}
                value={channelSearchQuery}
                onChange={e => setChannelSearchQuery(e.target.value)}
                className="w-full bg-[#080c1f] border border-[rgba(99,102,241,0.15)] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/40 transition-colors font-['Plus_Jakarta_Sans']"
              />
            </div>
            {activeTab === "group" && (
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-['Geist_Mono'] text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 transition-colors"
              >
                <Plus size={12} /> New group
              </button>
            )}
            {activeTab === "dm" && (
              <button
                type="button"
                onClick={() => setShowNewDm(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-['Geist_Mono'] text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 transition-colors"
              >
                <UserPlus size={12} /> New message
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {tabChannels.map(ch => {
              const unread = unreadCounts[ch.id] ?? 0;
              const isActive = activeChannel?.id === ch.id;
              const Icon = channelIcon(ch.channelType);
              const label = ch.displayName;
              const peerProfile =
                ch.channelType === "dm"
                  ? profiles.find(
                      p =>
                        ch.memberIds.includes(p.id) &&
                        p.id !== currentUser?.id
                    )
                  : undefined;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChannel(ch)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-['Plus_Jakarta_Sans'] font-medium transition-all duration-300 flex items-center justify-between gap-2 border ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                      : "border-transparent text-[#6b7fa8] hover:text-[#e2e8f7] hover:bg-white/[0.03]"
                  }`}
                >
                  {ch.channelType === "dm" && (
                    <div className="shrink-0 mr-1.5">
                      <Avatar
                        initials={initialsFromName(label)}
                        src={peerProfile?.profileImageUrl || undefined}
                        size="sm"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate flex items-center gap-1.5 text-[13px] font-bold text-white font-['Plus_Jakarta_Sans']">
                        {ch.channelType !== "dm" && <Icon size={12} className="shrink-0 text-indigo-400" />}
                        <span className="truncate">{label}</span>
                      </span>
                      {latestMsgs[ch.id] && (
                        <span className="shrink-0 text-[10px] text-[#6b7fa8] ml-2">
                           {formatMessageTime(latestMsgs[ch.id].time)}
                        </span>
                      )}
                    </div>
                    {latestMsgs[ch.id] ? (
                      <div className="flex items-center gap-1 mt-1 text-[#a8b5d1]">
                        {latestMsgs[ch.id].isOwn && (
                           <CheckCheck size={12} className="text-[#8362ff]" />
                        )}
                        <span className="truncate text-[11px] font-['Plus_Jakarta_Sans']">
                           {latestMsgs[ch.id].isOwn ? "You: " : ""}{latestMsgs[ch.id].content}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#6b7fa8] mt-1 italic font-['Plus_Jakarta_Sans']">No messages yet</p>
                    )}
                  </div>
                  {unread > 0 && !isActive && (
                    <span className="shrink-0 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
            {tabChannels.length === 0 && !tablesMissing && (
              <p className="px-3 py-4 text-[10px] text-[#6b7fa8] font-['Geist_Mono'] text-center">
                {activeTab === "dm" && "No direct messages yet"}
                {activeTab === "group" && "No groups yet — create one"}
              </p>
            )}
          </div>

          <div className="p-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-3 p-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <Avatar
                initials={displayInitials}
                src={currentUser?.profileImageUrl || undefined}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-emerald-400 font-['Geist_Mono']">● {statusLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-gradient-to-br from-[#0d1326] to-[#080c1a] border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.05)] relative">
          <div className="p-4 border-b border-white/[0.05] flex items-center justify-between shrink-0 gap-3 bg-white/[0.02] backdrop-blur-xl z-10">
            <div className="flex items-center gap-2 min-w-0">
              {activeChannel?.channelType === "dm" && activeDmPeer ? (
                <Avatar
                  initials={initialsFromName(activeDmPeer.name)}
                  src={activeDmPeer.profileImageUrl || undefined}
                  size="sm"
                />
              ) : (
                <HeaderIcon size={15} className="text-indigo-400 shrink-0" />
              )}
              <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">
                {channelTitle}
              </span>
              {activeChannel && (
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] shrink-0">
                  · {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {searchOpen ? (
                <div className="flex items-center gap-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-2 py-1">
                  <Search size={13} className="text-[#6b7fa8]" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="bg-transparent text-xs text-[#e2e8f7] outline-none w-36 font-['Plus_Jakarta_Sans']"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="text-[#6b7fa8] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white"
                  title="Search messages"
                >
                  <Search size={14} />
                </button>
              )}
              {activeChannel?.channelType === "dm" && currentUser?.phone && (
                <a
                  href={`tel:${currentUser.phone}`}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white"
                  title="Call"
                >
                  <Phone size={14} />
                </a>
              )}
              {activeChannel?.channelType === "group" && (
                <button
                  type="button"
                  onClick={openEditGroupModal}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white"
                  title="Group Info"
                >
                  <Edit size={14} />
                  <span className="text-xs font-['Plus_Jakarta_Sans'] font-medium">Edit Group</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-2 relative z-0">
            {messagesLoading && messages.length === 0 && (
              <DataLoading label="Loading messages..." />
            )}
            {messagesError && !isMissingChatTables(messagesError) && (
              <DataError message={messagesError} />
            )}
            {!messagesLoading && filteredMessages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px] relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.5)] relative z-10 rotate-3 transition-transform hover:rotate-6">
                  <MessageCircle size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white font-['Plus_Jakarta_Sans'] relative z-10">
                  {searchQuery ? "No matches found" : "Start a Conversation"}
                </h3>
                <p className="text-sm text-[#a8b5d1] mt-2 font-['Plus_Jakarta_Sans'] relative z-10 text-center max-w-xs">
                  {searchQuery ? "Try a different search term" : "Send a message to break the ice and start collaborating."}
                </p>
              </div>
            )}
            {filteredMessages.map((m) => {
              const isOwn = Boolean(
                currentUser &&
                  ((m.senderId && m.senderId === currentUser.id) ||
                    namesMatch(m.senderName, currentUser.name))
              );
              const deliveryStatus = isOwn
                ? getMessageDeliveryStatus(m, currentUser!.id, activeChannel, channelReadStates)
                : undefined;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={isOwn}
                  showSenderName={activeChannel?.channelType === "group" && !isOwn}
                  photoUrl={isOwn ? currentUser?.profileImageUrl : profilePhoto(profiles, m.senderId, m.senderName)}
                  deliveryStatus={deliveryStatus}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 shrink-0 space-y-2 bg-white/[0.02] backdrop-blur-xl border-t border-white/[0.05] z-10">
            {sendError && <p className="text-xs text-rose-400 pl-4">{sendError}</p>}
            <div className="flex items-center gap-2 bg-[#131a35]/80 border border-white/[0.08] rounded-full px-4 py-2.5 focus-within:border-indigo-500/50 focus-within:bg-[#181f3a] focus-within:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeChannel || tablesMissing || uploading}
                className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white disabled:opacity-40"
                title="Attach image or file"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={!activeChannel || tablesMissing || uploading}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white disabled:opacity-40"
                  title="Insert Emoji"
                >
                  <Smile size={15} />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 bg-[#131a35] border border-[rgba(99,102,241,0.2)] rounded-lg p-2 shadow-xl shadow-indigo-950/50 flex flex-wrap gap-1 w-64 z-50">
                    {[
                      "😀", "😂", "😊", "😍", "😘", "😎", "😭", "😡", "👍", "👎", 
                      "👏", "🙌", "🤝", "🙏", "❤️", "💔", "🔥", "🎉", "🎂", "🎁", 
                      "🎈", "💯", "👀", "🚀", "💡", "✅", "❌", "❓"
                    ].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          const newVal = msg + emoji;
                          setMsg(newVal);
                          currentMsgRef.current = newVal;
                          setShowEmojiPicker(false);
                        }}
                        className="hover:bg-white/10 rounded p-1 text-lg leading-none transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  disabled={!activeChannel || tablesMissing || uploading}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white disabled:opacity-40"
                  title="Insert GIF"
                >
                  <ImagePlay size={15} />
                </button>
                {showGifPicker && (
                  <div className="absolute bottom-full left-0 mb-2 bg-[#131a35] border border-[rgba(99,102,241,0.2)] rounded-lg p-3 shadow-xl shadow-indigo-950/50 w-72 z-50">
                    <input
                      type="text"
                      value={gifSearch}
                      onChange={e => setGifSearch(e.target.value)}
                      placeholder="Search GIFs..."
                      className="w-full bg-[#080c1a] border border-[rgba(99,102,241,0.15)] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500/40 mb-3"
                    />
                    <div className="h-48 overflow-y-auto grid grid-cols-2 gap-1.5">
                      {gifLoading && gifResults.length === 0 ? (
                        <p className="text-xs text-[#6b7fa8] col-span-2 text-center py-4">Loading...</p>
                      ) : gifResults.length > 0 ? (
                        gifResults.map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleSendGif(g.media[0].gif.url)}
                            className="rounded overflow-hidden hover:opacity-80 transition-opacity bg-black/20"
                          >
                            <img src={g.media[0].nanogif.url} alt="GIF" className="w-full h-20 object-cover" />
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-[#6b7fa8] col-span-2 text-center py-4">No results</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeChannel || tablesMissing || uploading}
                placeholder={
                  activeChannel
                    ? `Message ${activeChannel.displayName}`
                    : "Select a chat"
                }
                className="flex-1 bg-transparent text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none font-['Plus_Jakarta_Sans'] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || uploading || !msg.trim() || !activeChannel || tablesMissing}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-white"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Create group</h3>
              <button type="button" onClick={() => setShowNewGroup(false)} className="text-[#6b7fa8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-sm text-white outline-none focus:border-indigo-500/40"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mb-2">Add members</p>
              {otherProfiles.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(p.id)}
                    onChange={() => toggleGroupMember(p.id)}
                    className="rounded border-indigo-500/40"
                  />
                  <Avatar
                    initials={initialsFromName(p.name)}
                    src={p.profileImageUrl || undefined}
                    size="sm"
                  />
                  <span className="text-xs text-white">{p.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white font-['Plus_Jakarta_Sans']"
            >
              {creating ? "Creating..." : "Create group"}
            </button>
          </div>
        </div>
      )}

      {showEditGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Group Info</h3>
              <button type="button" onClick={() => setShowEditGroup(false)} className="text-[#6b7fa8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-sm text-white outline-none focus:border-indigo-500/40"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mb-2">Manage members</p>
              {otherProfiles.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(p.id)}
                    onChange={() => toggleGroupMember(p.id)}
                    className="rounded border-indigo-500/40"
                  />
                  <Avatar
                    initials={initialsFromName(p.name)}
                    src={p.profileImageUrl || undefined}
                    size="sm"
                  />
                  <span className="text-xs text-white">{p.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleEditGroup}
              disabled={creating || !groupName.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white font-['Plus_Jakarta_Sans']"
            >
              {creating ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {showNewDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">New message</h3>
              <button type="button" onClick={() => setShowNewDm(false)} className="text-[#6b7fa8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400/70" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearchQuery}
                onChange={e => setContactSearchQuery(e.target.value)}
                className="w-full bg-[#080c1f] border border-[rgba(99,102,241,0.15)] rounded-lg pl-9 pr-3 py-2 text-xs text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/40 transition-colors font-['Plus_Jakarta_Sans']"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {otherProfiles.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleStartDm(p.id)}
                  disabled={creating}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.03] text-left disabled:opacity-50"
                >
                  <Avatar
                    initials={initialsFromName(p.name)}
                    src={p.profileImageUrl || undefined}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{p.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
