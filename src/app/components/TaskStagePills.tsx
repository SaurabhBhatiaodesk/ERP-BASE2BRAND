import { Timer } from "lucide-react";
import {
  aggregateStageSeconds,
  formatStageDuration,
  formatStageStartTime,
  getVisibleStageEntries,
  type ShiftActiveTask,
  type TaskStageHistoryRow,
} from "@/lib/taskStageTime";

type PillSize = "sm" | "md";

const pillSizeStyles: Record<PillSize, { wrap: string; pill: string; label: string; time: string; icon: number; gap: string }> = {
  sm: {
    wrap: "gap-1",
    pill: "px-1.5 py-0.5 rounded-md",
    label: "text-[9px]",
    time: "text-[11px]",
    icon: 8,
    gap: "gap-0.5",
  },
  md: {
    wrap: "gap-1.5",
    pill: "px-2.5 py-1.5 rounded-lg",
    label: "text-[10px]",
    time: "text-[13px]",
    icon: 11,
    gap: "gap-1",
  },
};

const ACTIVE_STAGE_COLORS: Record<string, string> = {
  todo: "bg-slate-500/20 text-slate-300 border-slate-500/40 shadow-sm shadow-slate-500/10",
  "in-progress": "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/10",
  "ready-for-testing": "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm shadow-violet-500/10",
  review: "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10",
  done: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10",
};

const INACTIVE_STAGE_COLORS: Record<string, string> = {
  todo: "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 transition-colors",
  "in-progress": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 transition-colors",
  "ready-for-testing": "bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20 transition-colors",
  review: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 transition-colors",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 transition-colors",
};

export function TaskStagePills({
  status,
  history,
  statusEnteredAt,
  totals: totalsProp,
  compact = false,
  size = "sm",
}: {
  status: string;
  history: TaskStageHistoryRow[];
  statusEnteredAt: string;
  totals?: Record<string, number>;
  compact?: boolean;
  size?: PillSize;
}) {
  const totals = totalsProp ?? aggregateStageSeconds(history, status, statusEnteredAt);
  const entries = getVisibleStageEntries(status, totals, history);
  if (entries.length === 0) return null;

  const s = pillSizeStyles[size];
  const isMd = size === "md";
  const stageStarted = formatStageStartTime(statusEnteredAt);

  return (
    <div className={`flex flex-wrap ${s.wrap} ${compact ? "mt-0.5" : "mt-1.5"}`}>
      {entries.map(entry => (
        <span
          key={entry.status}
          title={`${entry.label}: ${formatStageDuration(entry.seconds)}${entry.isCurrent ? (statusEnteredAt === "paused" ? " (paused)" : ` (live since ${stageStarted})`) : ""}`}
          className={`inline-flex ${isMd ? "flex-col items-start" : `items-center ${s.gap}`} ${s.pill} font-['Geist_Mono'] border ${
            entry.isCurrent
              ? ACTIVE_STAGE_COLORS[entry.status] || ACTIVE_STAGE_COLORS["in-progress"]
              : INACTIVE_STAGE_COLORS[entry.status] || INACTIVE_STAGE_COLORS["in-progress"]
          }`}
        >
          <span className={`inline-flex items-center ${s.gap} ${s.label} text-inherit ${!entry.isCurrent ? "opacity-80" : ""}`}>
            {entry.isCurrent && <Timer size={s.icon} className="shrink-0 opacity-90" />}
            <span>{entry.label}</span>
            {!isMd && <span className={`${s.time} font-extrabold text-red-400 tracking-wide drop-shadow-sm`}>{formatStageDuration(entry.seconds)}</span>}
          </span>
          {isMd ? (
            <span className={`${s.time} font-extrabold text-red-400 tracking-wide drop-shadow-sm`}>
              {formatStageDuration(entry.seconds)}
              {entry.isCurrent ? (statusEnteredAt === "paused" ? <span className="text-white/70 font-normal"> · paused</span> : <span className="text-white/70 font-normal"> · live</span>) : ""}
            </span>
          ) : null}
          {entry.isCurrent && stageStarted && statusEnteredAt !== "paused" && (
            <span className={`${isMd ? "text-[10px] mt-0.5" : "text-[8px]"} text-white/70 ml-0.5`}>
              from {stageStarted}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function TaskStagePillsFromActive({
  task,
  size = "sm",
}: {
  task: ShiftActiveTask;
  size?: PillSize;
}) {
  return (
    <TaskStagePills
      status={task.status}
      history={task.stageHistory}
      statusEnteredAt={task.statusEnteredAt}
      totals={task.stageTotals}
      size={size}
    />
  );
}
