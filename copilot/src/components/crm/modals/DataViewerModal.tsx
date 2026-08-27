import React, { useState } from 'react';
import { X, Users, Briefcase, UserCheck2, ArrowRight } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useCopilot } from '../../../context/CopilotContext';

interface DataViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataViewerModal: React.FC<DataViewerModalProps> = ({ isOpen, onClose }) => {
  const { leads, employees, deals } = useCRM();
  const { sendMessage } = useCopilot();
  const [tab, setTab] = useState<'leads' | 'employees' | 'deals'>('leads');

  if (!isOpen) return null;

  const handleAskAbout = (name: string) => {
    onClose();
    sendMessage(`Summarize ${name}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl bg-slate-900 border border-white/[0.1] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white font-['Outfit']">CRM Database Records</h2>
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => setTab('leads')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  tab === 'leads' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Leads ({leads.length})
              </button>
              <button
                onClick={() => setTab('employees')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  tab === 'employees' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Team ({employees.length})
              </button>
              <button
                onClick={() => setTab('deals')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  tab === 'deals' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Deals ({deals.length})
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'leads' && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => handleAskAbout(lead.name)}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-violet-500/40 hover:bg-slate-950 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-semibold text-white group-hover:text-violet-300 transition truncate">
                        {lead.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {lead.company} &bull; {lead.location || 'India'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-white font-['Outfit']">
                        ₹{(lead.deal_value || 0).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {lead.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'employees' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {employees.map(emp => (
                <div
                  key={emp.id}
                  onClick={() => handleAskAbout(emp.full_name)}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-violet-500/40 hover:bg-slate-950 transition cursor-pointer flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-center shrink-0">
                    {emp.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-violet-300 truncate">
                      {emp.full_name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {emp.role} &bull; {emp.department}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'deals' && (
            <div className="space-y-2">
              {deals.map(deal => (
                <div
                  key={deal.id}
                  onClick={() => handleAskAbout(deal.lead_name)}
                  className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-violet-500/40 hover:bg-slate-950 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{deal.title}</div>
                    <div className="text-[10px] text-slate-400">{deal.company} &bull; {deal.stage}</div>
                  </div>
                  <div className="text-xs font-bold text-white font-['Outfit']">
                    ₹{deal.value.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
