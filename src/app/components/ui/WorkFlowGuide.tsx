import React from "react";
import { Briefcase, Clock, LayoutDashboard, Layers } from "lucide-react";

export function WorkFlowGuide({ compact = false }: { compact?: boolean }) {
  const steps = [
    {
      icon: LayoutDashboard,
      title: "Dashboard",
      desc: "Office Clock In / Out only",
      color: "text-emerald-400",
    },
    {
      icon: Layers,
      title: "Projects & Work",
      desc: "Open project → Tasks + log project hours",
      color: "text-indigo-400",
    },
    {
      icon: Clock,
      title: "Time Reports",
      desc: "View all office & project time",
      color: "text-sky-400",
    },
  ];

  if (compact) {
    return (
      <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed">
        <span className="text-indigo-300">Projects</span> = tasks & project time ·{" "}
        <span className="text-emerald-300">Dashboard</span> = office clock ·{" "}
        <span className="text-sky-300">Time Reports</span> = full history
      </p>
    );
  }

  return (
    <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
      <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider mb-3">
        Where to do what
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {steps.map(step => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="flex items-start gap-3 bg-[#131a35]/60 rounded-lg px-3 py-2.5 border border-[rgba(99,102,241,0.08)]"
            >
              <Icon size={16} className={`${step.color} shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs font-semibold font-['Plus_Jakarta_Sans'] ${step.color}`}>
                  {step.title}
                </p>
                <p className="text-[11px] text-[#8b9cc4] font-['Plus_Jakarta_Sans'] mt-0.5 leading-snug">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-3 flex items-center gap-1.5">
        <Briefcase size={11} className="text-indigo-400/70" />
        All project tasks live inside each project — not a separate menu.
      </p>
    </div>
  );
}
