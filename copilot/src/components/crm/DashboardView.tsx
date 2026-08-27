import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ChevronRight,
  Clock,
  PhoneCall,
  Mail,
  User
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';

interface DashboardViewProps {
  onNavigateToLead: (leadId: string) => void;
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToLead, onNavigate }) => {
  const { metrics, leads, activities, staleLeads } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();

  const handleAskCopilot = (prompt: string) => {
    setIsOpen(true);
    sendMessage(prompt);
  };

  const highValueLeads = [...leads]
    .filter(l => !['won', 'lost'].includes(l.status || ''))
    .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0))
    .slice(0, 5);

  const recentActivities = (activities || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Executive Overview"
        subtitle="Real-time sales performance, team operations, and AI intelligence."
        actions={
          <button
            onClick={() => handleAskCopilot('What are my top priorities for today?')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-medium shadow-md shadow-copilot-600/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Priorities</span>
          </button>
        }
      />

      {/* Modern KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Closed Won Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Closed Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-['Outfit']">
            ₹{(metrics.totalRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>{metrics.wonLeads || 0} deals closed won</span>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Active Pipeline</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-['Outfit']">
            ₹{(metrics.activePipelineValue || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            <span>{metrics.activeLeads || 0} opportunities in negotiation</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Conversion Rate</span>
            <div className="w-7 h-7 rounded-lg bg-copilot-500/10 text-copilot-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-['Outfit']">
            {metrics.conversionRate}%
          </div>
          <div className="text-[11px] text-copilot-400 font-medium">
            <span>Calculated from live conversions</span>
          </div>
        </div>

        {/* Active Leads */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Leads</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-['Outfit']">
            {metrics.totalLeads}
          </div>
          <div className="text-[11px] text-amber-400 font-medium">
            <span>{staleLeads.length} leads requiring follow-up</span>
          </div>
        </div>
      </div>

      {/* Quick Copilot Prompts Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-copilot-400" />
          <span>Quick AI Insights:</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { label: '✨ Today\'s Priorities', prompt: 'What should I focus on today?' },
            { label: '💰 Pipeline Summary', prompt: 'Show sales summary and pipeline value' },
            { label: '👤 Ronald Martin dossier', prompt: 'Summarize Ronald Martin' },
            { label: '❄️ Stale Leads (>7d)', prompt: "Show me leads that haven't been contacted for 7 days" },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleAskCopilot(item.prompt)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-copilot-950/80 border border-slate-800 hover:border-copilot-600/60 text-xs text-slate-300 hover:text-white transition shrink-0 flex items-center gap-1.5"
            >
              <span>{item.label}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Active Opportunities & Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Value Pipeline Opportunities */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white font-['Outfit']">Top Pipeline Opportunities</h2>
              <p className="text-xs text-slate-400">High-value leads currently in active discussions</p>
            </div>
            <button
              onClick={() => onNavigate('leads')}
              className="text-xs text-copilot-400 hover:text-copilot-300 font-medium flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {highValueLeads.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No active deals in pipeline.</div>
            ) : (
              highValueLeads.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => onNavigateToLead(lead.id)}
                  className="p-3 rounded-xl bg-slate-950/50 hover:bg-slate-900/80 border border-slate-800/60 hover:border-slate-700 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-semibold text-slate-200 truncate">{lead.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{lead.company} &bull; {lead.location || 'India'}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-100 font-['Outfit']">
                        ₹{(lead.deal_value || 0).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {lead.status}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAskCopilot(`Summarize ${lead.name}`);
                      }}
                      className="p-1.5 rounded-lg bg-copilot-950/60 hover:bg-copilot-900 border border-copilot-800/50 text-copilot-300 transition"
                      title="Ask Copilot about this lead"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white font-['Outfit']">Recent Activity Stream</h2>
              <p className="text-xs text-slate-400">Live interactions & updates across team</p>
            </div>
          </div>

          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No recent activity logs.</div>
            ) : (
              recentActivities.map(act => (
                <div key={act.id} className="flex items-start gap-3 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    {act.activity_type === 'call' ? (
                      <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
                    ) : act.activity_type === 'email' ? (
                      <Mail className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 font-medium truncate">{act.summary}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} &bull; {act.performed_by_name || 'System'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
