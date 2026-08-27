import React, { useState } from 'react';
import { Sparkles, Search, User } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';

export const EmployeesView: React.FC = () => {
  const { employees, leads } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();
  const [searchTerm, setSearchTerm] = useState('');

  const handleAskCopilot = (prompt: string) => {
    setIsOpen(true);
    sendMessage(prompt);
  };

  const filteredEmployees = employees.filter(e => {
    const q = searchTerm.toLowerCase();
    return (
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team & Operations Directory"
        subtitle={`${employees.length} team members registered in the organization database.`}
        actions={
          <button
            onClick={() => handleAskCopilot('Show team attendance and operational status')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-semibold shadow-md shadow-copilot-600/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Attendance & Shift Report</span>
          </button>
        }
      />

      {/* Search Filter */}
      <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search team by name, role, department..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-copilot-500 transition"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map(emp => {
          const empLeadsCount = leads.filter(l => l.assigned_to === emp.id).length;
          return (
            <div
              key={emp.id}
              className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition space-y-3 relative group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 overflow-hidden">
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                    ) : (
                      emp.full_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-100 truncate group-hover:text-copilot-300 transition">
                      {emp.full_name}
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate capitalize">{emp.department || 'General'}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAskCopilot(`Summarize ${emp.full_name}`)}
                  className="p-1.5 rounded-lg bg-slate-950/60 hover:bg-copilot-950 text-slate-400 hover:text-copilot-200 border border-slate-800 hover:border-copilot-700/50 transition shrink-0"
                  title="Ask Copilot about this member"
                >
                  <Sparkles className="w-3 h-3" />
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Role:</span>
                  <span className="font-medium text-slate-200 truncate capitalize">{emp.role || 'Member'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Email:</span>
                  <span className="font-medium text-slate-200 truncate max-w-[140px]">{emp.email || 'N/A'}</span>
                </div>
                {empLeadsCount > 0 && (
                  <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>Assigned Leads:</span>
                    <span className="font-bold text-copilot-300">{empLeadsCount}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
