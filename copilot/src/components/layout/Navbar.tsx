import React from 'react';
import { Sparkles, Search, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCopilot } from '../../context/CopilotContext';

export const Navbar: React.FC = () => {
  const { currentUser, switchUser, availableUsers } = useAuth();
  const { toggleOpen, isOpen } = useCopilot();

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-20 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-copilot-600 to-indigo-500 flex items-center justify-center shadow-md shadow-copilot-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white font-['Outfit']">ApexCRM</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/50">
              Copilot AI
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search CRM or ask Copilot..."
            onClick={toggleOpen}
            className="w-72 pl-9 pr-14 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 hover:border-slate-700 focus:outline-none focus:border-copilot-500 transition-all cursor-pointer"
            readOnly
          />
          <kbd className="absolute right-2 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700 pointer-events-none">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Sleek Copilot Toggle */}
        <button
          onClick={toggleOpen}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isOpen
              ? 'bg-copilot-600 text-white shadow-lg shadow-copilot-600/30'
              : 'bg-copilot-950/60 text-copilot-300 border border-copilot-700/40 hover:bg-copilot-900/60 hover:border-copilot-500/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copilot</span>
        </button>

        {/* Persona Switcher Dropdown */}
        <div className="relative group">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-200">
              {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
            </div>
            <span className="text-xs font-medium text-slate-200 hidden sm:inline truncate max-w-[120px]">
              {currentUser.full_name}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>

          {/* Persona Menu */}
          <div className="absolute right-0 mt-1.5 w-60 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50 animate-fade-in max-h-72 overflow-y-auto">
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active User Persona
            </div>
            {availableUsers.slice(0, 15).map(u => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                  u.id === currentUser.id
                    ? 'bg-copilot-950 text-copilot-200 font-medium'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="truncate font-medium">{u.full_name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{u.department || u.role}</div>
                </div>
                {u.id === currentUser.id && <Check className="w-3.5 h-3.5 text-copilot-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
