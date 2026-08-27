import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';
import { DealStage } from '../../types/crm';

interface DealsPipelineViewProps {
  onNavigateToLead: (leadId: string) => void;
}

const STAGES: { id: DealStage; label: string; accent: string }[] = [
  { id: 'prospecting', label: 'Prospecting', accent: 'bg-blue-500' },
  { id: 'qualification', label: 'Qualification', accent: 'bg-purple-500' },
  { id: 'proposal', label: 'Proposal', accent: 'bg-indigo-500' },
  { id: 'negotiation', label: 'Negotiation', accent: 'bg-amber-500' },
  { id: 'closed_won', label: 'Closed Won', accent: 'bg-emerald-500' },
  { id: 'closed_lost', label: 'Closed Lost', accent: 'bg-slate-500' },
];

export const DealsPipelineView: React.FC<DealsPipelineViewProps> = ({ onNavigateToLead }) => {
  const { deals } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();

  const handleAskCopilot = () => {
    setIsOpen(true);
    sendMessage('Show sales summary and pipeline value');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deals Pipeline"
        subtitle="Live Kanban workflow showing deal values and stage progression."
        actions={
          <button
            onClick={handleAskCopilot}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-semibold shadow-md shadow-copilot-600/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Pipeline Analysis</span>
          </button>
        }
      />

      {/* Modern Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3.5 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.id);
          const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div
              key={stage.id}
              className="rounded-2xl border border-slate-800/80 p-3 flex flex-col min-w-[230px] space-y-3 bg-slate-900/40"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stage.accent}`} />
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">{stage.label}</h3>
                    <div className="text-[11px] font-bold text-slate-400 font-['Outfit'] mt-0.5">
                      ₹{stageTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                  {stageDeals.length}
                </span>
              </div>

              {/* Deal Cards */}
              <div className="space-y-2 flex-1">
                {stageDeals.length === 0 ? (
                  <div className="text-[11px] text-slate-600 text-center py-8">No deals</div>
                ) : (
                  stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      onClick={() => onNavigateToLead(deal.lead_id)}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-copilot-500/50 transition cursor-pointer space-y-2 shadow-sm group"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-copilot-300 transition truncate">
                          {deal.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{deal.company}</div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <div className="text-xs font-bold text-white font-['Outfit']">
                          ₹{deal.value.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-500">{deal.probability}% prob.</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
