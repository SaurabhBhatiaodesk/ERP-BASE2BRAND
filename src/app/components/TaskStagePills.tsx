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
    time: "text-[9px]",
    icon: 8,
    gap: "gap-0.5",
  },
  md: {
    wrap: "gap-1.5",
    pill: "px-2.5 py-1.5 rounded-lg",
    label: "text-[10px]",
    time: "text-[11px] font-semibold",
    icon: 11,
    gap: "gap-1",
  },
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
              ? entry.status === "done"
                ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "bg-amber-500/15 text-amber-200 border-amber-500/30 shadow-sm shadow-amber-500/10"
              : "bg-[#131a35] text-[#c5d0ea] border-[rgba(99,102,241,0.18)]"
          }`}
        >
          <span className={`inline-flex items-center ${s.gap} ${s.label} ${entry.isCurrent ? "text-inherit" : "text-[#8fa0c4]"}`}>
            {entry.isCurrent && <Timer size={s.icon} className="shrink-0 opacity-90" />}
            <span>{entry.label}</span>
            {!isMd && <span className={s.time}>{formatStageDuration(entry.seconds)}</span>}
          </span>
          {isMd ? (
            <span className={`${s.time} ${entry.isCurrent ? "text-inherit" : "text-white"}`}>
              {formatStageDuration(entry.seconds)}
              {entry.isCurrent ? (statusEnteredAt === "paused" ? " · paused" : " · live") : ""}
            </span>
          ) : null}
          {entry.isCurrent && stageStarted && statusEnteredAt !== "paused" && (
            <span className={`${isMd ? "text-[10px] mt-0.5" : "text-[8px]"} opacity-80`}>
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
