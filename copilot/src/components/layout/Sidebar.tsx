import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  Contact2, 
  UserCheck2, 
  BarChart3,
  Sparkles
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { metrics } = useCRM();
  const { toggleOpen, isOpen } = useCopilot();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads & Pipeline', icon: Users, count: metrics.totalLeads },
    { id: 'deals', label: 'Deals', icon: Briefcase },
    { id: 'tasks', label: 'Tasks & Follow-ups', icon: CheckSquare, count: metrics.todayFollowupsCount > 0 ? metrics.todayFollowupsCount : undefined },
    { id: 'contacts', label: 'Contacts', icon: Contact2 },
    { id: 'employees', label: 'Team & Directory', icon: UserCheck2 },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <aside className="w-56 border-r border-slate-800/80 bg-slate-950/60 flex flex-col justify-between p-3 flex-shrink-0">
      {/* Navigation Links */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView === 'lead-details' && item.id === 'leads');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-800/80 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-copilot-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Minimal Copilot Launch Card */}
      <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/70 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-copilot-400" />
            Copilot Assistant
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Instant answers & summaries across all CRM data.
        </p>
        <button
          onClick={toggleOpen}
          className="w-full py-1.5 px-3 rounded-lg bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-medium transition shadow-sm"
        >
          {isOpen ? 'Close Assistant' : 'Open Assistant'}
        </button>
      </div>
    </aside>
  );
};
