import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({ label, value, sub, trend, icon: Icon, color }: {
  label: string; value: string; sub: string; trend: "up" | "down" | "neutral";
  icon: React.FC<{ size?: number; className?: string }>; color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[rgba(99,102,241,0.12)] bg-[#0d1326] p-5 group hover:border-[rgba(99,102,241,0.3)] transition-all duration-300">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 ${color}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color} bg-opacity-15`}>
          <Icon size={16} className="text-white opacity-80" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-mono ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-400"}`}>
          {trend === "up" ? <TrendingUp size={11} /> : trend === "down" ? <TrendingDown size={11} /> : null}
          {sub}
        </span>
      </div>
      <div className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans'] tracking-tight">{value}</div>
      <div className="text-xs text-[#6b7fa8] mt-1 font-['Geist_Mono']">{label}</div>
    </div>
  );
}

export function Avatar({
  initials,
  src,
  size = "sm",
  color,
}: {
  initials: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
}) {
  const sz =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "md"
        ? "w-9 h-9 text-sm"
        : size === "lg"
          ? "w-11 h-11 text-base"
          : "w-16 h-16 text-xl";
  const colors: Record<string, string> = {
    AM: "bg-indigo-600", PS: "bg-violet-600", RG: "bg-cyan-700",
    SP: "bg-amber-700", DP: "bg-emerald-700", KN: "bg-pink-700", AI: "bg-purple-800",
  };
  const bg = color || colors[initials] || "bg-indigo-700";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${sz} rounded-full object-cover shrink-0 border border-[rgba(99,102,241,0.2)]`}
      />
    );
  }

  return (
    <div className={`${sz} ${bg} rounded-full flex items-center justify-center text-white font-semibold font-['Plus_Jakarta_Sans'] shrink-0`}>
      {initials}
    </div>
  );
}

export function Badge({ label, variant, children }: { label?: string; variant: string; children?: React.ReactNode }) {
  const styles: Record<string, string> = {
    hot: "bg-red-500/15 text-red-400 border-red-500/20",
    warm: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    cold: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    urgent: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    low: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    "in-progress": "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    todo: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    review: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    "ready-for-testing": "bg-violet-500/15 text-violet-400 border-violet-500/20",
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    idle: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    // extra variants used in role dashboards
    red: "bg-red-500/15 text-red-400 border-red-500/20",
    yellow: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    blue: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  };
  const cls = styles[variant] ?? "bg-slate-500/15 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-['Geist_Mono'] border ${cls}`}>
      {children ?? label}
    </span>
  );
}

export const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-lg p-3 shadow-xl">
      <p className="text-[#6b7fa8] text-xs font-['Geist_Mono'] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-['Geist_Mono']" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" && entry.value < 30 ? `₹${entry.value}L` : entry.value}
        </p>
      ))}
    </div>
  );
};
