import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  AlertTriangle
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';
import { LeadStatus } from '../../types/crm';

interface LeadsListViewProps {
  onSelectLead: (leadId: string) => void;
  onOpenCreateModal: () => void;
}

export const LeadsListView: React.FC<LeadsListViewProps> = ({ onSelectLead, onOpenCreateModal }) => {
  const { leads, employees, staleLeads } = useCRM();
  const { sendMessage, setIsOpen, setSelectedLeadId } = useCopilot();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bdeFilter, setBdeFilter] = useState<string>('all');
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (showStaleOnly) {
        const isStale = staleLeads.some(s => s.id === lead.id);
        if (!isStale) return false;
      }
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (bdeFilter !== 'all' && lead.assigned_to !== bdeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = (lead.name || '').toLowerCase().includes(q);
        const matchesCompany = (lead.company || '').toLowerCase().includes(q);
        const matchesEmail = (lead.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesEmail) return false;
      }
      return true;
    });
  }, [leads, statusFilter, bdeFilter, searchQuery, showStaleOnly, staleLeads]);

  const handleAskCopilotAboutLead = (e: React.MouseEvent, leadId: string, leadName: string) => {
    e.stopPropagation();
    setSelectedLeadId(leadId);
    setIsOpen(true);
    sendMessage(`Summarize full dossier and recommended next steps for ${leadName}`);
  };

  const getStatusBadge = (status: LeadStatus, isStale: boolean) => {
    if (isStale && !['won', 'lost'].includes(status)) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 inline-flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" /> STALE
        </span>
      );
    }

    const map: Record<LeadStatus, { bg: string; text: string; border: string }> = {
      new: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
      contacted: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      interested: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
      proposal: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
      negotiation: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
      won: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      lost: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
      stale: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
    };

    const s = map[status] || map.new;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text} border ${s.border}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads Directory"
        subtitle={`${filteredLeads.length} total enterprise leads found in live database.`}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setIsOpen(true);
                sendMessage("Show me leads that haven't been contacted for 7 days");
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-copilot-500/50 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-copilot-400" />
              <span>Analyze Stale</span>
            </button>
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-semibold shadow-md shadow-copilot-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
          </div>
        }
      />

      {/* Modern Search & Filters */}
      <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search leads by name, company, email..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-copilot-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Filter className="w-3 h-3" />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-copilot-500 cursor-pointer"
          >
            <option value="all">All Stages</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Closed Won</option>
            <option value="lost">Closed Lost</option>
          </select>

          {employees.length > 0 && (
            <select
              value={bdeFilter}
              onChange={e => setBdeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-copilot-500 cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">All Team</option>
              {employees.slice(0, 15).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowStaleOnly(!showStaleOnly)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition border flex items-center gap-1 ${
              showStaleOnly
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Stale ({staleLeads.length})</span>
          </button>
        </div>
      </div>

      {/* Modern Leads Table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800/80 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-4 font-semibold">Lead Details</th>
                <th className="py-3 px-4 font-semibold">Stage</th>
                <th className="py-3 px-4 font-semibold">Deal Value</th>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold text-right">Copilot Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No leads matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => {
                  const isStale = staleLeads.some(s => s.id === lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead.id)}
                      className="hover:bg-slate-850/50 transition cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 group-hover:text-copilot-300 transition">
                          {lead.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {lead.company} {lead.designation ? `&bull; ${lead.designation}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lead.email || lead.phone || 'No email provided'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(lead.status, isStale)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 font-['Outfit']">
                          ₹{(lead.deal_value || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-500">{lead.industry || 'Technology'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-medium">{lead.location || 'India'}</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={e => handleAskCopilotAboutLead(e, lead.id, lead.name)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-copilot-950/80 text-slate-300 hover:text-copilot-200 border border-slate-800 hover:border-copilot-700/50 text-[11px] font-medium transition inline-flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3 text-copilot-400" />
                          <span>Dossier</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
