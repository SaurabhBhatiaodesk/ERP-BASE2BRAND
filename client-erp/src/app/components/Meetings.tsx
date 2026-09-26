import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Video, CalendarDays, Clock, PlayCircle, Sparkles, CheckSquare, Loader2, PhoneCall, X, FileText } from "lucide-react";
import {
  fetchMeetings, scheduleMeeting, getMeetingRoomName, startInstantMeeting,
  saveMeetingRecordingUrl, transcribeMeetingRecording,
  type MeetingItem, type MeetingType,
} from "@/lib/database";
import { canRecordTab, startMeetingRecording, stopMeetingRecording, type ActiveRecording } from "@/lib/meetingRecording";
import { uploadMeetingRecording } from "@/lib/cloudinary";
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

export function Meetings({ organizationId, personName, canRecord = false }: { organizationId?: string; personName?: string; canRecord?: boolean }) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingInstant, setStartingInstant] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<{ meetingId: string; roomName: string; title: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<ActiveRecording | null>(null);

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

  /**
   * Must be the FIRST await in its caller (a direct button onClick) — Chrome
   * only allows getDisplayMedia() while a user gesture is still "active",
   * which an intervening await would consume. Never blocks joining the
   * meeting: if the user declines the share prompt (or it errors), the
   * meeting still opens, it's just not recorded this time.
   */
  const tryStartRecording = async () => {
    if (!canRecord || !canRecordTab()) {
      console.warn("[meetingRecording] skipped:", { canRecord, canRecordTab: canRecordTab(), isSecureContext: typeof window !== "undefined" && window.isSecureContext });
      return;
    }
    try {
      recordingRef.current = await startMeetingRecording();
      setIsRecording(true);
    } catch (err) {
      console.error("[meetingRecording] failed to start:", err);
      recordingRef.current = null;
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      toast.info(`Meeting not recorded (${reason}).`, { duration: 8000 });
    }
  };

  const processRecording = async (meetingId: string) => {
    const active = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!active) return;

    const toastId = toast.loading("Saving meeting recording...");
    try {
      console.log("[meetingRecording] stopping...");
      const blob = await stopMeetingRecording(active);
      console.log("[meetingRecording] stopped, uploading...", blob.size, "bytes");
      const recordingUrl = await uploadMeetingRecording(blob, meetingId);
      console.log("[meetingRecording] uploaded:", recordingUrl);
      await saveMeetingRecordingUrl(meetingId, recordingUrl);
      console.log("[meetingRecording] saved recording_url, transcribing...");
      toast.loading("Transcribing meeting...", { id: toastId });
      await transcribeMeetingRecording(meetingId, recordingUrl);
      console.log("[meetingRecording] transcribed.");
      toast.success("Recording saved and transcribed.", { id: toastId });
      load();
    } catch (err) {
      console.error("[meetingRecording] processRecording failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save/transcribe the recording.", { id: toastId });
    }
  };

  const handleJoin = async (meet: MeetingItem) => {
    setMeetingError("");
    await tryStartRecording();
    setActiveMeeting({ meetingId: meet.id, roomName: getMeetingRoomName(meet.id), title: meet.title });
  };

  const handleStartInstant = async () => {
    setMeetingError("");
    setStartingInstant(true);
    try {
      await tryStartRecording();
      const { meetingId, roomName } = await startInstantMeeting(organizationId);
      setActiveMeeting({ meetingId, roomName, title: "Instant Meeting" });
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
          recording={isRecording}
          onClose={() => {
            const meetingId = activeMeeting.meetingId;
            setActiveMeeting(null);
            load();
            void processRecording(meetingId);
          }}
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
                </div>

                {meet.recordingUrl && (
                  <details className="rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <summary className="flex items-center justify-between gap-2 p-3 cursor-pointer select-none">
                      <span className="flex items-center gap-2" style={{ color: "#8891B8", fontSize: 11, fontWeight: 600 }}>
                        <PlayCircle size={12} /> View Recording
                      </span>
                      <a
                        href={meet.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#8891B8", fontSize: 11 }}
                      >
                        Open Original
                      </a>
                    </summary>
                    <video
                      controls
                      preload="metadata"
                      src={meet.recordingUrl}
                      className="w-full rounded-b-lg"
                      style={{ maxHeight: 340, background: "#000" }}
                    />
                  </details>
                )}

                {meet.aiSummary && (
                  <div className="rounded-lg p-4 mb-4" style={{ background: "rgba(123,92,245,0.08)", border: "1px solid rgba(123,92,245,0.15)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} color="#C4B5FD" />
                      <p style={{ color: "#C4B5FD", fontSize: 11, fontWeight: 600 }}>AI Meeting Summary</p>
                    </div>
                    <p style={{ color: "#C4C8E0", fontSize: 12, lineHeight: 1.7 }}>{meet.aiSummary}</p>
                  </div>
                )}

                {meet.transcript && (
                  <details className="rounded-lg mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <summary className="flex items-center gap-2 p-3 cursor-pointer select-none" style={{ color: "#8891B8", fontSize: 11, fontWeight: 600 }}>
                      <FileText size={12} /> View Full Transcript
                    </summary>
                    <p className="px-3 pb-3" style={{ color: "#C4C8E0", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{meet.transcript}</p>
                  </details>
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
