import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Video, Plus, Search, SlidersHorizontal, X, Copy, Check,
  Clock, Users, Calendar, LayoutDashboard, List,
  ChevronLeft, ChevronRight, Pencil, XCircle, Link2,
  Loader2, AlertCircle, VideoIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  fetchMeetings,
  createMeeting,
  updateMeeting,
  cancelMeeting,
  updateMeetingStatus,
  type Meeting,
  type MeetingParticipant,
  type MeetingStatus,
  type CreateMeetingInput,
} from "@/lib/database";
import { useEmployeeProfiles } from "@/hooks/useSupabaseData";
import { toast } from "sonner";

// ── Styles ────────────────────────────────────────────────────
const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wide font-['Geist_Mono']";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans']";
const btnSecondary =
  "flex items-center gap-2 px-5 py-2.5 bg-[#131a35] border border-[rgba(99,102,241,0.2)] text-[#a8b5d1] text-sm font-semibold rounded-xl hover:bg-[#1a2340] transition-colors font-['Plus_Jakarta_Sans']";

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; dot: string }> = {
  scheduled: { label: "Scheduled", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
  ongoing:   { label: "Ongoing",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400 animate-pulse" },
  completed: { label: "Completed", color: "text-violet-400 bg-violet-500/10 border-violet-500/20", dot: "bg-violet-400" },
  cancelled: { label: "Cancelled", color: "text-red-400 bg-red-500/10 border-red-500/20", dot: "bg-red-400" },
};

const MEETING_TYPES = ["Client Meeting", "Internal Meeting", "Team Standup", "Review", "Interview", "Other"];
const PLATFORMS = ["Zoom", "Google Meet", "Microsoft Teams", "In-Person", "Phone Call", "Other"];
const DURATIONS = [
  { label: "15m", mins: 15 }, { label: "30m", mins: 30 }, { label: "45m", mins: 45 },
  { label: "1h",  mins: 60 }, { label: "1.5h", mins: 90 }, { label: "2h", mins: 120 },
  { label: "3h",  mins: 180 },
];

type ViewMode = "board" | "list" | "calendar";
type ListTab  = "today" | "upcoming" | "ongoing" | "completed";
type CalTab   = "day" | "week" | "month";

// ── Helpers ───────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatTime12(timeStr: string | undefined | null): string {
  if (!timeStr) return "--:--";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function getEffectiveStatus(m: Meeting): MeetingStatus {
  if (m.status === "cancelled" || m.status === "completed") return m.status;
  const now = new Date();
  const dateTime = (t: string) => new Date(`${m.date}T${t}:00`);
  if (now >= dateTime(m.start_time) && now < dateTime(m.end_time)) return "ongoing";
  if (now >= dateTime(m.end_time)) return "completed";
  return m.status;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-blue-500 to-cyan-600",
];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Participant Avatar ─────────────────────────────────────────
function PAvatarBubble({ p, size = 28 }: { p: MeetingParticipant; size?: number }) {
  const name = p.participant_name ?? "?";
  return (
    <div
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center text-white font-bold shrink-0 border-2 border-[#0d1326]`}
    >
      {initials(name)}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: MeetingStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} font-['Plus_Jakarta_Sans']`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Meeting Card ───────────────────────────────────────────────
function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const status = getEffectiveStatus(meeting);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left ${cardCls} p-4 hover:border-indigo-500/30 hover:bg-[#101830] transition-all duration-200 group cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate group-hover:text-white transition-colors">
          {meeting.title}
        </span>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          <Clock size={11} className="shrink-0 text-indigo-400" />
          {formatTime12(meeting.start_time)} – {formatTime12(meeting.end_time)} · {meeting.duration_mins}m
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          <VideoIcon size={11} className="shrink-0 text-violet-400" />
          {meeting.platform} · {meeting.type}
        </div>
        {meeting.organizer_name && (
          <div className="flex items-center gap-2 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
            <Users size={11} className="shrink-0 text-pink-400" />
            {meeting.organizer_name}
          </div>
        )}
      </div>

      {meeting.participants.length > 0 && (
        <div className="flex items-center gap-1 mt-3 -space-x-1">
          {meeting.participants.slice(0, 5).map(p => (
            <PAvatarBubble key={p.id} p={p} size={26} />
          ))}
          {meeting.participants.length > 5 && (
            <div className="w-[26px] h-[26px] rounded-full bg-[#1a2340] border-2 border-[#0d1326] flex items-center justify-center text-[10px] text-[#6b7fa8] font-bold">
              +{meeting.participants.length - 5}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ── Board View ─────────────────────────────────────────────────
function BoardView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (m: Meeting) => void }) {
  const columns: { key: MeetingStatus; label: string; color: string }[] = [
    { key: "scheduled", label: "Scheduled", color: "text-blue-400" },
    { key: "ongoing",   label: "Ongoing",   color: "text-emerald-400" },
    { key: "completed", label: "Completed", color: "text-violet-400" },
    { key: "cancelled", label: "Cancelled", color: "text-red-400" },
  ];

  const grouped = useMemo(() => {
    const map: Record<MeetingStatus, Meeting[]> = { scheduled: [], ongoing: [], completed: [], cancelled: [] };
    for (const m of meetings) {
      const s = getEffectiveStatus(m);
      map[s].push(m);
    }
    return map;
  }, [meetings]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {columns.map(col => (
        <div key={col.key} className="shrink-0 w-[280px]">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className={`text-sm font-bold ${col.color} font-['Plus_Jakarta_Sans']`}>{col.label}</span>
            <span className="text-[11px] font-['Geist_Mono'] text-[#6b7fa8] bg-[#131a35] px-2 py-0.5 rounded-full">
              {grouped[col.key].length}
            </span>
          </div>
          <div className="space-y-3">
            {grouped[col.key].length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No meetings</div>
            ) : (
              grouped[col.key].map(m => (
                <MeetingCard key={m.id} meeting={m} onClick={() => onSelect(m)} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── List View ──────────────────────────────────────────────────
function ListView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (m: Meeting) => void }) {
  const [tab, setTab] = useState<ListTab>("today");

  const todayIso = todayStr();

  const filtered = useMemo(() => {
    return meetings.filter(m => {
      const s = getEffectiveStatus(m);
      if (tab === "today")     return m.date === todayIso;
      if (tab === "upcoming")  return m.date > todayIso && s === "scheduled";
      if (tab === "ongoing")   return s === "ongoing";
      if (tab === "completed") return s === "completed" || s === "cancelled";
      return true;
    });
  }, [meetings, tab, todayIso]);

  const tabs: { key: ListTab; label: string }[] = [
    { key: "today",     label: "Today"     },
    { key: "upcoming",  label: "Upcoming"  },
    { key: "ongoing",   label: "Ongoing"   },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all font-['Plus_Jakarta_Sans'] ${
              tab === t.key
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                : "bg-[#131a35] text-[#6b7fa8] hover:text-[#a8b5d1] border border-[rgba(99,102,241,0.15)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
          No meetings scheduled for {tab}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <MeetingCard key={m.id} meeting={m} onClick={() => onSelect(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────────
function CalendarView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (m: Meeting) => void }) {
  const [calTab, setCalTab] = useState<CalTab>("week");
  const [refDate, setRefDate] = useState(() => new Date());

  const calTabs: { key: CalTab; label: string }[] = [
    { key: "day",   label: "Day"   },
    { key: "week",  label: "Week"  },
    { key: "month", label: "Month" },
  ];

  // Week range
  const weekStart = useMemo(() => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    d.setHours(0, 0, 0, 0);
    return d;
  }, [refDate]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekStart]);

  function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

  // Group meetings by date
  const byDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const m of meetings) {
      if (!map[m.date]) map[m.date] = [];
      map[m.date].push(m);
    }
    return map;
  }, [meetings]);

  function navigate(dir: 1 | -1) {
    const d = new Date(refDate);
    if (calTab === "day")   d.setDate(d.getDate() + dir);
    if (calTab === "week")  d.setDate(d.getDate() + 7 * dir);
    if (calTab === "month") d.setMonth(d.getMonth() + dir);
    setRefDate(d);
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function headerLabel() {
    if (calTab === "day") return formatDateLabel(isoDate(refDate));
    if (calTab === "week") {
      const end = weekDays[6];
      return `${DAY_NAMES[weekStart.getDay()]} ${weekStart.getDate()} – ${DAY_NAMES[end.getDay()]} ${end.getDate()}`;
    }
    return `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`;
  }

  // Render week grid
  const todayIso = todayStr();

  // Month grid
  const monthGrid = useMemo(() => {
    if (calTab !== "month") return null;
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calTab, refDate]);

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[#131a35] rounded-xl p-1 border border-[rgba(99,102,241,0.15)]">
          {calTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setCalTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all font-['Plus_Jakarta_Sans'] ${
                calTab === t.key ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white" : "text-[#6b7fa8] hover:text-[#a8b5d1]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-[#131a35] text-[#6b7fa8] hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans'] min-w-[180px] text-center">{headerLabel()}</span>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-[#131a35] text-[#6b7fa8] hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day view */}
      {calTab === "day" && (
        <div className="space-y-3">
          {(byDate[isoDate(refDate)] ?? []).length === 0 ? (
            <div className="py-16 text-center text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">No meetings on this day.</div>
          ) : (
            (byDate[isoDate(refDate)] ?? []).map(m => (
              <MeetingCard key={m.id} meeting={m} onClick={() => onSelect(m)} />
            ))
          )}
        </div>
      )}

      {/* Week view */}
      {calTab === "week" && (
        <>
          <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-3">Long-press a meeting to drag it to another day</p>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const iso = isoDate(day);
              const dayMeetings = byDate[iso] ?? [];
              const isToday = iso === todayIso;
              return (
                <div key={iso} className="min-h-[120px]">
                  <div className={`text-center mb-2 pb-1.5 border-b ${isToday ? "border-indigo-500/50" : "border-[rgba(99,102,241,0.08)]"}`}>
                    <div className="text-[11px] text-[#6b7fa8] font-['Geist_Mono']">{DAY_NAMES[day.getDay()]}</div>
                    <div className={`text-lg font-bold font-['Plus_Jakarta_Sans'] ${isToday ? "text-indigo-400" : "text-[#e2e8f7]"}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {dayMeetings.slice(0, 3).map(m => {
                      const s = getEffectiveStatus(m);
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button
                          key={m.id}
                          onClick={() => onSelect(m)}
                          className={`w-full text-left p-2 rounded-lg ${cardCls} hover:border-indigo-500/30 transition-all border-l-2 ${
                            s === "scheduled" ? "border-l-blue-400" :
                            s === "ongoing"   ? "border-l-emerald-400" :
                            s === "completed" ? "border-l-violet-400" :
                                                "border-l-red-400"
                          }`}
                        >
                          <div className="text-[11px] font-bold text-[#e2e8f7] truncate font-['Plus_Jakarta_Sans']">{m.title}</div>
                          <StatusBadge status={s} />
                          <div className="text-[10px] text-[#6b7fa8] mt-0.5 font-['Geist_Mono']">
                            {formatTime12(m.start_time)} – {formatTime12(m.end_time).split(" ")[0]}...
                          </div>
                          <div className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                            {m.platform} · {m.type.slice(0, 8)}...
                          </div>
                          {m.organizer_name && (
                            <div className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{m.organizer_name.split(" ")[0]}</div>
                          )}
                          {m.participants.length > 0 && (
                            <div className="flex -space-x-1 mt-1">
                              {m.participants.slice(0, 3).map(p => (
                                <PAvatarBubble key={p.id} p={p} size={18} />
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {dayMeetings.length > 3 && (
                      <div className="text-[10px] text-[#6b7fa8] text-center font-['Plus_Jakarta_Sans']">
                        +{dayMeetings.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Month view */}
      {calTab === "month" && monthGrid && (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-[11px] font-bold text-[#6b7fa8] font-['Geist_Mono'] py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const iso = isoDate(day);
              const dayMeetings = byDate[iso] ?? [];
              const isToday = iso === todayIso;
              return (
                <div
                  key={iso}
                  className={`min-h-[80px] rounded-lg p-1.5 border ${
                    isToday ? "border-indigo-500/40 bg-indigo-900/10" : "border-transparent hover:border-[rgba(99,102,241,0.15)]"
                  } transition-all`}
                >
                  <div className={`text-xs font-bold mb-1 font-['Plus_Jakarta_Sans'] ${isToday ? "text-indigo-400" : "text-[#a8b5d1]"}`}>
                    {day.getDate()}
                  </div>
                  {dayMeetings.slice(0, 2).map(m => {
                    const s = getEffectiveStatus(m);
                    return (
                      <button
                        key={m.id}
                        onClick={() => onSelect(m)}
                        className={`w-full text-left text-[9px] font-bold truncate px-1.5 py-0.5 rounded mb-0.5 font-['Plus_Jakarta_Sans'] ${
                          s === "scheduled" ? "bg-blue-500/20 text-blue-300" :
                          s === "ongoing"   ? "bg-emerald-500/20 text-emerald-300" :
                          s === "completed" ? "bg-violet-500/20 text-violet-300" :
                                              "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {m.title}
                      </button>
                    );
                  })}
                  {dayMeetings.length > 2 && (
                    <div className="text-[9px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">+{dayMeetings.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule Meeting Modal ─────────────────────────────────────
interface ScheduleModalProps {
  profiles: { id: string; name: string; appRole: string }[];
  organizerId: string;
  organizerName: string;
  editingMeeting?: Meeting | null;
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleModal({ profiles, organizerId, organizerName, editingMeeting, onClose, onSaved }: ScheduleModalProps) {
  const isEditing = !!editingMeeting;

  const [title,         setTitle]         = useState(editingMeeting?.title ?? "");
  const [type,          setType]          = useState(editingMeeting?.type  ?? "Client Meeting");
  const [platform,      setPlatform]      = useState(editingMeeting?.platform ?? "Zoom");
  const [link,          setLink]          = useState(editingMeeting?.meeting_link ?? "");
  const [date,          setDate]          = useState(editingMeeting?.date ?? todayStr());
  const [startTime,     setStartTime]     = useState(editingMeeting?.start_time?.slice(0,5) ?? "10:00");
  const [durationMins,  setDurationMins]  = useState(editingMeeting?.duration_mins ?? 30);
  const [agenda,        setAgenda]        = useState(editingMeeting?.agenda ?? "");
  const [selectedPIds,  setSelectedPIds]  = useState<string[]>(
    editingMeeting?.participants.map(p => p.participant_id) ?? []
  );
  const [participantSearch, setParticipantSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const endTime = useMemo(() => addMinutes(startTime, durationMins), [startTime, durationMins]);

  const filteredProfiles = useMemo(() =>
    profiles.filter(p => p.id !== organizerId &&
      p.name.toLowerCase().includes(participantSearch.toLowerCase())
    ),
  [profiles, organizerId, participantSearch]);

  function toggleParticipant(id: string) {
    setSelectedPIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!title.trim()) { toast.error("Meeting title is required"); return; }
    if (selectedPIds.length === 0) { toast.error("Add at least one participant"); return; }

    // Validate that meeting is not in the past
    if (!isEditing) {
      const now = new Date();
      const meetingDateTime = new Date(`${date}T${startTime}:00`);
      if (meetingDateTime < now) {
        toast.error("Meeting time cannot be in the past. Please select a future date and time.");
        return;
      }
    }

    setSaving(true);
    try {
      if (isEditing && editingMeeting) {
        const existingPIds = editingMeeting.participants.map(p => p.participant_id);
        const newPIds = selectedPIds.filter(id => !existingPIds.includes(id));
        await updateMeeting(
          editingMeeting.id,
          {
            title: title.trim(), type, platform,
            meeting_link: link || undefined,
            date, start_time: startTime,
            duration_mins: durationMins,
            agenda: agenda || undefined,
            new_participant_ids: newPIds,
          },
          organizerId,
          organizerName
        );
        toast.success("Meeting updated!");
      } else {
        await createMeeting({
          title: title.trim(), type, platform,
          meeting_link: link || undefined,
          date, start_time: startTime,
          duration_mins: durationMins,
          organizer_id: organizerId,
          organizer_name: organizerName,
          participant_ids: selectedPIds,
          agenda: agenda || undefined,
        });
        toast.success("Meeting scheduled! Participants notified.");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Failed to save meeting. Please try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`${cardCls} w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(99,102,241,0.12)]">
          <h2 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans']">
            {isEditing ? "Edit Meeting" : "Schedule Meeting"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-[#6b7fa8] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelCls}>Meeting Title *</label>
            <input
              id="meeting-title"
              className={inputCls}
              placeholder="e.g. Sprint Planning"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Type + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Meeting Type</label>
              <select id="meeting-type" className={inputCls} value={type} onChange={e => setType(e.target.value)}>
                {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Platform</label>
              <select id="meeting-platform" className={inputCls} value={platform} onChange={e => setPlatform(e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className={labelCls}>Meeting Link *</label>
            <input
              id="meeting-link"
              className={inputCls}
              placeholder="https://zoom.us/j/..."
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>

          {/* Date + Start Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Meeting Date *</label>
              <input
                id="meeting-date"
                type="date"
                className={inputCls}
                value={date}
                min={todayStr()}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Start Time *</label>
              <input
                id="meeting-start-time"
                type="time"
                className={inputCls}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
          </div>

          {/* Duration + End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Duration</label>
              <select
                id="meeting-duration"
                className={inputCls}
                value={durationMins}
                onChange={e => setDurationMins(Number(e.target.value))}
              >
                {DURATIONS.map(d => <option key={d.mins} value={d.mins}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ends At</label>
              <div className={`${inputCls} cursor-not-allowed opacity-60`}>{formatTime12(endTime)}</div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className={labelCls}>Participants *</label>
            <div className={`${cardCls} overflow-hidden`}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
                <input
                  id="participant-search"
                  className="w-full bg-transparent pl-9 pr-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none border-b border-[rgba(99,102,241,0.12)] font-['Plus_Jakarta_Sans']"
                  placeholder="Select participants"
                  value={participantSearch}
                  onChange={e => setParticipantSearch(e.target.value)}
                />
              </div>
              <div className="max-h-[160px] overflow-y-auto">
                {filteredProfiles.length === 0 ? (
                  <div className="text-center py-4 text-xs text-[#6b7fa8]">No employees found</div>
                ) : (
                  filteredProfiles.map(p => {
                    const selected = selectedPIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleParticipant(p.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors ${selected ? "bg-indigo-600/10" : ""}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(p.name)} flex items-center justify-center text-white font-bold text-xs shrink-0`}
                        >
                          {initials(p.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{p.name}</div>
                          <div className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{p.appRole}</div>
                        </div>
                        {selected && <Check size={14} className="text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            {selectedPIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedPIds.map(pid => {
                  const prof = profiles.find(p => p.id === pid);
                  if (!prof) return null;
                  return (
                    <span
                      key={pid}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/15 border border-indigo-500/20 rounded-full text-xs text-indigo-300 font-['Plus_Jakarta_Sans']"
                    >
                      {prof.name}
                      <button onClick={() => toggleParticipant(pid)} className="hover:text-white">
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Agenda */}
          <div>
            <label className={labelCls}>Agenda / Description</label>
            <textarea
              id="meeting-agenda"
              className={`${inputCls} h-24 resize-none`}
              placeholder="What will this meeting cover?"
              value={agenda}
              onChange={e => setAgenda(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[rgba(99,102,241,0.12)]">
          <button id="meeting-cancel-btn" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button
            id="meeting-save-btn"
            onClick={handleSave}
            disabled={saving}
            className={`${btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            {isEditing ? "Save Changes" : "Schedule Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meeting Details Panel ──────────────────────────────────────
function MeetingDetails({
  meeting,
  isOrganizer,
  onClose,
  onEdit,
  onCancelled,
  onStatusChanged,
}: {
  meeting: Meeting;
  isOrganizer: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelled: () => void;
  onStatusChanged: () => void;
}) {
  const status = getEffectiveStatus(meeting);
  const [copying, setCopying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCopy() {
    if (!meeting.meeting_link) return;
    await navigator.clipboard.writeText(meeting.meeting_link);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this meeting?")) return;
    setCancelling(true);
    const ok = await cancelMeeting(meeting.id);
    setCancelling(false);
    if (ok) { toast.success("Meeting cancelled."); onCancelled(); }
    else    { toast.error("Failed to cancel meeting."); }
  }

  async function handleStatusChange(newStatus: MeetingStatus) {
    await updateMeetingStatus(meeting.id, newStatus);
    toast.success(`Status updated to ${newStatus}.`);
    onStatusChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className={`${cardCls} w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60 rounded-b-none sm:rounded-xl`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(99,102,241,0.12)]">
          <h2 className="text-base font-bold text-[#6b7fa8] font-['Plus_Jakarta_Sans'] uppercase tracking-wider text-xs">Meeting Details</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-[#6b7fa8] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title + Status */}
          <div>
            <h3 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans'] mb-2">{meeting.title}</h3>
            <StatusBadge status={status} />
          </div>

          {/* Status change (organizer only, not cancelled/completed) */}
          {isOrganizer && status !== "cancelled" && (
            <div className="flex flex-wrap gap-2">
              {(["scheduled","ongoing","completed"] as MeetingStatus[])
                .filter(s => s !== status)
                .map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#131a35] border border-[rgba(99,102,241,0.2)] text-[#a8b5d1] hover:bg-indigo-600/10 hover:text-indigo-300 transition-colors font-['Plus_Jakarta_Sans']"
                  >
                    Mark as {STATUS_CONFIG[s].label}
                  </button>
                ))
              }
            </div>
          )}

          {/* Date/Time + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelCls}>Date & Time</div>
              <div className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{formatDateLabel(meeting.date)}</div>
              <div className="text-xs text-[#6b7fa8] font-['Geist_Mono']">{formatTime12(meeting.start_time)} – {formatTime12(meeting.end_time)}</div>
            </div>
            <div>
              <div className={labelCls}>Duration</div>
              <div className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{meeting.duration_mins}m</div>
            </div>
          </div>

          {/* Type + Platform */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={labelCls}>Meeting Type</div>
              <div className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{meeting.type}</div>
            </div>
            <div>
              <div className={labelCls}>Platform</div>
              <div className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{meeting.platform}</div>
            </div>
          </div>

          {/* Link */}
          {meeting.meeting_link && (
            <div>
              <div className={labelCls}>Meeting Link</div>
              <div className="flex items-center gap-2">
                <a
                  href={meeting.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-2 truncate font-['Plus_Jakarta_Sans']"
                >
                  {meeting.meeting_link}
                </a>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-white/[0.05] text-[#6b7fa8] hover:text-white transition-colors"
                >
                  {copying ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Organizer */}
          <div>
            <div className={labelCls}>Organizer</div>
            <div className="text-sm font-bold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{meeting.organizer_name}</div>
          </div>

          {/* Participants */}
          {meeting.participants.length > 0 && (
            <div>
              <div className={labelCls}>Participants ({meeting.participants.length})</div>
              <div className="space-y-2 mt-2">
                {meeting.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(p.participant_name ?? "")} flex items-center justify-center text-white font-bold text-xs shrink-0`}
                    >
                      {initials(p.participant_name ?? "?")}
                    </div>
                    <span className="text-sm text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{p.participant_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agenda */}
          {meeting.agenda && (
            <div>
              <div className={labelCls}>Agenda / Description</div>
              <div className="text-sm text-[#a8b5d1] font-['Plus_Jakarta_Sans'] leading-relaxed whitespace-pre-wrap">{meeting.agenda}</div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isOrganizer && status !== "cancelled" && (
          <div className="flex items-center gap-3 p-5 border-t border-[rgba(99,102,241,0.12)]">
            <button
              id="meeting-edit-btn"
              onClick={onEdit}
              className={`${btnSecondary} flex-1 justify-center`}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              id="meeting-cancel-action-btn"
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors font-['Plus_Jakarta_Sans'] disabled:opacity-60"
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Cancel Meeting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Meeting View ──────────────────────────────────────────
export interface MeetingViewProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function MeetingView({ userId, userName, userEmail }: MeetingViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const { data: profiles } = useEmployeeProfiles();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeetings(userId);
      setMeetings(data);
    } catch (e) {
      setError("Failed to load meetings. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  // Real-time subscription for new/updated meetings
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`meetings-user-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const filteredMeetings = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.organizer_name?.toLowerCase().includes(q) ||
      m.participants.some(p => p.participant_name?.toLowerCase().includes(q))
    );
  }, [meetings, search]);

  const profileList = useMemo(() =>
    profiles.map(p => ({ id: p.id, name: p.name, appRole: p.appRole })),
  [profiles]);

  function handleSelectMeeting(m: Meeting) { setSelectedMeeting(m); }
  function handleEditMeeting() {
    if (!selectedMeeting) return;
    setEditingMeeting(selectedMeeting);
    setSelectedMeeting(null);
    setShowSchedule(true);
  }
  function handleCloseModal() {
    setShowSchedule(false);
    setEditingMeeting(null);
  }

  const viewTabs: { key: ViewMode; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { key: "board",    label: "Board",    icon: LayoutDashboard },
    { key: "list",     label: "List",     icon: List            },
    { key: "calendar", label: "Calendar", icon: Calendar        },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 px-6 py-4 border-b border-[rgba(99,102,241,0.08)] flex flex-col gap-3">
        {/* Search + actions */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
            <input
              id="meetings-search"
              className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']"
              placeholder="Search meetings, participants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            id="schedule-meeting-btn"
            onClick={() => { setEditingMeeting(null); setShowSchedule(true); }}
            className="shrink-0 w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30"
          >
            <Plus size={18} className="text-white" />
          </button>
          <button className="shrink-0 w-10 h-10 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl flex items-center justify-center text-[#6b7fa8] hover:text-white hover:border-indigo-500/30 transition-all">
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* View mode tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#131a35] rounded-xl p-1 border border-[rgba(99,102,241,0.15)] gap-1">
            {viewTabs.map(t => (
              <button
                key={t.key}
                id={`view-mode-${t.key}`}
                onClick={() => setViewMode(t.key)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all font-['Plus_Jakarta_Sans'] ${
                  viewMode === t.key
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                    : "text-[#6b7fa8] hover:text-[#a8b5d1]"
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "board" && (
          <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
            Long-press a meeting and drag it to another column to change its status
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="text-indigo-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 gap-2 text-sm text-red-400 font-['Plus_Jakarta_Sans']">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : (
          <>
            {viewMode === "board"    && <BoardView    meetings={filteredMeetings} onSelect={handleSelectMeeting} />}
            {viewMode === "list"     && <ListView     meetings={filteredMeetings} onSelect={handleSelectMeeting} />}
            {viewMode === "calendar" && <CalendarView meetings={filteredMeetings} onSelect={handleSelectMeeting} />}
          </>
        )}
      </div>

      {/* Schedule/Edit Modal */}
      {showSchedule && (
        <ScheduleModal
          profiles={profileList}
          organizerId={userId}
          organizerName={userName}
          editingMeeting={editingMeeting}
          onClose={handleCloseModal}
          onSaved={load}
        />
      )}

      {/* Meeting Details Sheet */}
      {selectedMeeting && (
        <MeetingDetails
          meeting={selectedMeeting}
          isOrganizer={selectedMeeting.organizer_id === userId}
          onClose={() => setSelectedMeeting(null)}
          onEdit={handleEditMeeting}
          onCancelled={() => { setSelectedMeeting(null); void load(); }}
          onStatusChanged={() => { setSelectedMeeting(null); void load(); }}
        />
      )}
    </div>
  );
}
