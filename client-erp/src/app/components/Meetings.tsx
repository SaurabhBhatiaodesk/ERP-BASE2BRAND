import { useEffect, useState } from "react";
import { Video, CalendarDays, Clock, PlayCircle, Sparkles, CheckSquare, Loader2, PhoneCall, X } from "lucide-react";
import { fetchMeetings, scheduleMeeting, getMeetingRoomName, startInstantMeeting, type MeetingItem, type MeetingType } from "@/lib/database";
import { JitsiMeetEmbed } from "./JitsiMeetEmbed";

function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: "rgba(13,16,48,0.7)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", ...style }}>
      {children}
    </div>
  );
}

const typeColors: Record<MeetingType, string> = {
  planning: "#7B5CF5",
  review: "#4C6EF5",
  design: "#F47B52",
  retro: "#10B981",
};

const typeLabels: Record<MeetingType, string> = {
  planning: "Planning",
  review: "Review",
  design: "Design",
  retro: "Retrospective",
};

function ScheduleMeetingDialog({ organizationId, onClose, onScheduled }: { organizationId: string; onClose: () => void; onScheduled: () => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<MeetingType>("planning");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim() || !date || !time) return;
    setSaving(true);
    setError("");
    try {
      await scheduleMeeting(organizationId, { title: title.trim(), date, time, durationMinutes: duration, type });
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't schedule the meeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(7,9,26,0.85)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ width: 420, background: "#0B0E28", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h3 style={{ color: "#E2E4F0", fontSize: 15, fontWeight: 600 }}>Schedule a Meeting</h3>
          <button onClick={onClose} style={{ color: "#8891B8" }}><X size={18} /></button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title…"
          className="w-full rounded-lg p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 13, outline: "none" }}
        />

        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            min={todayIso}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-lg p-2.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 13, outline: "none" }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-lg p-2.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E4F0", fontSize: 13, outline: "none" }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span style={{ color: "#8891B8", fontSize: 12 }}>Duration</span>
          {[15, 30, 45, 60].map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className="rounded-lg px-3 py-1"
              style={{ background: duration === d ? "rgba(123,92,245,0.2)" : "rgba(255,255,255,0.05)", color: duration === d ? "#C4B5FD" : "#8891B8", fontSize: 12, fontWeight: 600 }}
            >
              {d}m
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "#8891B8", fontSize: 12 }}>Type</span>
          {(Object.keys(typeLabels) as MeetingType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="rounded-lg px-3 py-1"
              style={{ background: type === t ? `${typeColors[t]}25` : "rgba(255,255,255,0.05)", color: type === t ? typeColors[t] : "#8891B8", fontSize: 12, fontWeight: 600 }}
            >
              {typeLabels[t]}
            </button>
          ))}
        </div>

        {error && <p style={{ color: "#EF4444", fontSize: 12 }}>{error}</p>}

        <button
          onClick={submit}
          disabled={!title.trim() || saving}
          className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: !title.trim() || saving ? 0.6 : 1 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CalendarDays size={15} />}
          Schedule Meeting
        </button>
      </div>
    </div>
  );
}

export function Meetings({ organizationId, personName }: { organizationId?: string; personName?: string }) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingInstant, setStartingInstant] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<{ roomName: string; title: string } | null>(null);

  const load = () => {
    if (!organizationId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    fetchMeetings(organizationId)
      .then(result => setMeetings(result))
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load meetings."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [organizationId]);

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
        <p style={{ color: "#8891B8", fontSize: 13 }}>Pick a client from the switcher above to view their meetings.</p>
      </div>
    );
  }

  const upcoming = meetings.filter(m => !m.isPast);
  const past = meetings.filter(m => m.isPast);

  const handleJoin = (meet: MeetingItem) => {
    setMeetingError("");
    setActiveMeeting({ roomName: getMeetingRoomName(meet.id), title: meet.title });
  };

  const handleStartInstant = async () => {
    setMeetingError("");
    setStartingInstant(true);
    try {
      const { roomName } = await startInstantMeeting(organizationId);
      setActiveMeeting({ roomName, title: "Instant Meeting" });
      load(); // so the client sees it appear in Upcoming Meetings once they're in the call
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : "Couldn't start the meeting.");
    } finally {
      setStartingInstant(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      {showScheduleDialog && (
        <ScheduleMeetingDialog organizationId={organizationId} onClose={() => setShowScheduleDialog(false)} onScheduled={load} />
      )}

      {activeMeeting && (
        <JitsiMeetEmbed
          roomName={activeMeeting.roomName}
          title={activeMeeting.title}
          displayName={personName ?? "Guest"}
          onClose={() => { setActiveMeeting(null); load(); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "#E2E4F0", fontSize: 22, fontWeight: 700 }}>Meeting Center</h1>
          <p style={{ color: "#8891B8", fontSize: 13, marginTop: 2 }}>Upcoming meetings, recordings, and AI summaries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStartInstant}
            disabled={startingInstant}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff", fontSize: 13, fontWeight: 600, opacity: startingInstant ? 0.7 : 1 }}
          >
            {startingInstant ? <Loader2 size={14} className="animate-spin" /> : <PhoneCall size={14} />}
            Start Meeting
          </button>
          <button
            onClick={() => setShowScheduleDialog(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)", color: "#fff", fontSize: 13, fontWeight: 600 }}
          >
            <CalendarDays size={14} />
            Schedule Meeting
          </button>
        </div>
      </div>

      {meetingError && <p style={{ color: "#EF4444", fontSize: 13 }}>{meetingError}</p>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={22} color="#8891B8" className="animate-spin" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>Loading meetings...</p>
        </div>
      )}

      {!loading && error && <p style={{ color: "#EF4444", fontSize: 13 }}>{error}</p>}

      {!loading && !error && meetings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <CalendarDays size={22} color="#8891B8" />
          <p style={{ color: "#8891B8", fontSize: 13 }}>No meetings scheduled yet.</p>
        </div>
      )}

      {!loading && !error && upcoming.length > 0 && (
        <GlassCard className="p-5">
          <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Upcoming Meetings</p>
          <div className="flex flex-col gap-3">
            {upcoming.map((meet) => {
              const color = typeColors[meet.type ?? "planning"] || "#7B5CF5";
              return (
                <div
                  key={meet.id}
                  className="flex items-center gap-4 rounded-lg p-4 cursor-pointer transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                    <Video size={16} style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ color: "#E2E4F0", fontSize: 13, fontWeight: 600 }}>{meet.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1" style={{ color: "#8891B8", fontSize: 11 }}>
                        <CalendarDays size={10} />
                        {meet.dateLabel}
                      </span>
                      {meet.timeLabel && (
                        <span className="flex items-center gap-1" style={{ color: "#8891B8", fontSize: 11 }}>
                          <Clock size={10} />
                          {meet.timeLabel}
                        </span>
                      )}
                      <span style={{ color: "#8891B8", fontSize: 11 }}>{meet.durationLabel}</span>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {meet.attendeeInitials.slice(0, 4).map((a, i) => (
                      <div
                        key={`${a}-${i}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: `${color}25`, border: "2px solid #07091A", color, fontSize: 9, fontWeight: 700 }}
                      >
                        {a}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleJoin(meet)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                    style={{ background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 12, fontWeight: 600 }}
                  >
                    Join
                  </button>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {!loading && !error && past.length > 0 && (
        <div>
          <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Past Meetings & AI Summaries</p>
          <div className="flex flex-col gap-4">
            {past.map((meet) => (
              <GlassCard key={meet.id} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(76,110,245,0.15)" }}>
                      <PlayCircle size={16} color="#4C6EF5" />
                    </div>
                    <div>
                      <p style={{ color: "#E2E4F0", fontSize: 14, fontWeight: 600 }}>{meet.title}</p>
                      <p style={{ color: "#8891B8", fontSize: 12 }}>{meet.dateLabel} · {meet.durationLabel}</p>
                    </div>
                  </div>
                  {meet.recordingUrl && (
                    <a
                      href={meet.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#8891B8", fontSize: 12 }}
                    >
                      <PlayCircle size={13} />
                      Recording
                    </a>
                  )}
                </div>

                {meet.aiSummary && (
                  <div className="rounded-lg p-4 mb-4" style={{ background: "rgba(123,92,245,0.08)", border: "1px solid rgba(123,92,245,0.15)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} color="#C4B5FD" />
                      <p style={{ color: "#C4B5FD", fontSize: 11, fontWeight: 600 }}>AI Meeting Summary</p>
                    </div>
                    <p style={{ color: "#C4C8E0", fontSize: 12, lineHeight: 1.7 }}>{meet.aiSummary}</p>
                  </div>
                )}

                {(meet.actionItems.length > 0 || meet.decisions.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p style={{ color: "#8891B8", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Action Items
                      </p>
                      {meet.actionItems.length === 0 && <p style={{ color: "#8891B8", fontSize: 12 }}>None</p>}
                      {meet.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <CheckSquare size={12} color="#4C6EF5" style={{ flexShrink: 0, marginTop: 2 }} />
                          <p style={{ color: "#E2E4F0", fontSize: 12 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p style={{ color: "#8891B8", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Decisions Made
                      </p>
                      {meet.decisions.length === 0 && <p style={{ color: "#8891B8", fontSize: 12 }}>None</p>}
                      {meet.decisions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#10B981" }} />
                          <p style={{ color: "#E2E4F0", fontSize: 12 }}>{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
