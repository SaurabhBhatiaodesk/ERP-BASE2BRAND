import React, { useEffect, useMemo, useState } from "react";
import { buildShiftEmployee } from "@/lib/shiftTimeline";
import {
  DEFAULT_TIMELINE_AXIS,
  currentTimelineNowMin,
  minToLabel,
  shiftWindowOnAxis,
  timelineHourLabels,
  timelineBlockDurationOnAxis,
} from "@/lib/shiftConfig";
import type { ClockSessionRecord, AppTask } from "@/lib/database";
import { kindMeta, type ActivityKind } from "./ShiftView";

type ProfileSlice = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  dept: string;
  shiftStart?: string | null;
  lastActiveAt?: string | null;
  profileImageUrl?: string;
};

export function EmployeeDailyTimeline({
  profile,
  session,
  workTasks = [],
}: {
  profile: ProfileSlice;
  session: ClockSessionRecord | null;
  workTasks?: AppTask[];
}) {
  const axis = DEFAULT_TIMELINE_AXIS;
  const [nowMin, setNowMin] = useState(() => currentTimelineNowMin(axis));

  useEffect(() => {
    setNowMin(currentTimelineNowMin(axis));
    const id = setInterval(() => setNowMin(currentTimelineNowMin(axis)), 15_000);
    return () => clearInterval(id);
  }, []);

  const emp = useMemo(
    () =>
      buildShiftEmployee({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        role: profile.role,
        dept: profile.dept,
        profileImageUrl: profile.profileImageUrl,
        shiftStart: profile.shiftStart,
        lastActiveAt: profile.lastActiveAt,
        session,
        workTasksInput: workTasks,
        trackedTasksInput: workTasks,
        timelineAxis: axis,
      }),
    [profile, session, workTasks],
  );

  const shiftWindow = shiftWindowOnAxis(emp.shiftStartMin, emp.shiftEndMin, axis);
  const effectiveNow = Math.min(nowMin, axis.duration);

  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-['Geist_Mono'] text-indigo-400 uppercase tracking-widest">Daily Timeline</p>
          <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] mt-1">
            {emp.shiftStartLabel} → {emp.shiftEndLabel}
            <span className="text-[#6b7fa8] font-normal font-['Geist_Mono'] text-xs ml-2">
              · only your shift
            </span>
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {(["working", "meeting", "break", "idle"] as ActivityKind[]).map(k => (
            <span key={k} className={`flex items-center gap-1 text-[10px] font-['Geist_Mono'] ${kindMeta[k].color}`}>
              <span className={`w-2 h-2 rounded-sm ${kindMeta[k].bg}`} /> {kindMeta[k].label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mb-2">
        {timelineHourLabels(axis, true).map(t => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <div className="relative h-12 bg-[#111828] rounded-xl overflow-hidden border border-[rgba(99,102,241,0.15)]">
        <div
          className="absolute top-0 bottom-0 bg-indigo-500/5 border-x border-indigo-400/10"
          style={{ left: `${shiftWindow.left}%`, width: `${shiftWindow.width}%` }}
          title={`Expected shift ${emp.shiftStartLabel} – ${emp.shiftEndLabel}`}
        />
        {Array.from({ length: axis.duration / 60 }, (_, i) => (i + 1) * 60).map(m => (
          <div
            key={m}
            className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
            style={{ left: `${(m / axis.duration) * 100}%` }}
          />
        ))}
        {emp.timeline.filter(b => b.kind !== "login").length > 0 ? (
          emp.timeline.filter(b => b.kind !== "login").map((block, i) => {
            const s = (block.start / axis.duration) * 100;
            const w = (timelineBlockDurationOnAxis(block.start, block.end, effectiveNow, axis) / axis.duration) * 100;
            const meta = kindMeta[block.kind];
            return (
              <div
                key={i}
                className={`absolute top-1.5 bottom-1.5 rounded-md ${meta.bg} ${block.end === null ? "opacity-90" : "opacity-70"}`}
                style={{ left: `${s}%`, width: `${w}%`, minWidth: "2px" }}
                title={`${block.label}: ${minToLabel(block.start, axis)} → ${block.end ? minToLabel(block.end, axis) : "Now"}`}
              />
            );
          })
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
              {session ? "No activity blocks yet" : "Clock in to start your timeline"}
            </span>
          </div>
        )}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
          style={{ left: `${Math.min((effectiveNow / axis.duration) * 100, 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
        <span>
          Status:{" "}
          <span className={kindMeta[emp.status].color}>{kindMeta[emp.status].label}</span>
        </span>
        {emp.clockInAt ? (
          <span className="text-emerald-400/90">Clock in: {emp.loginTime}</span>
        ) : null}
        <span>Active: <span className="text-white">{emp.activeFor}</span></span>
      </div>
    </div>
  );
}
