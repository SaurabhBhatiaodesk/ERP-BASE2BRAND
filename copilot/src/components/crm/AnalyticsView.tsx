import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';

export const AnalyticsView: React.FC = () => {
  const { metrics, leads } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();

  const handleAskCopilot = (prompt: string) => {
    setIsOpen(true);
    sendMessage(prompt);
  };

  // Channel breakdown
  const sources = ['Website', 'LinkedIn', 'Referral', 'Google Ads', 'Cold Outreach', 'Events'] as const;
  const sourceStats = sources.map(src => {
    const srcLeads = leads.filter(l => l.source === src);
    const won = srcLeads.filter(l => l.status === 'won').length;
    const value = srcLeads.filter(l => l.status === 'won').reduce((sum, l) => sum + l.deal_value, 0);
    const rate = srcLeads.length > 0 ? ((won / srcLeads.length) * 100).toFixed(1) : '0';
    return { source: src, total: srcLeads.length, won, value, rate };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Analytics & Sales Intelligence"
        subtitle="Comprehensive conversion funnels, source attribution, and revenue forecasting."
        actions={
          <button
            onClick={() => handleAskCopilot('How many leads did we convert and what is our revenue?')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-copilot-950 border border-copilot-800 text-copilot-300 text-xs font-semibold hover:bg-copilot-900 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-copilot-400" />
            <span>Copilot: Sales Summary</span>
          </button>
        }
      />

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">Total Booked Revenue</div>
          <div className="text-2xl font-bold text-white font-['Outfit']">₹{metrics.totalRevenue.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-emerald-400 font-medium">100% realized from closed won deals</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">Average Deal Size</div>
          <div className="text-2xl font-bold text-white font-['Outfit']">₹{metrics.averageDealValue.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-500">Across qualified pipeline opportunities</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="text-xs text-slate-400">Overall Win Rate</div>
          <div className="text-2xl font-bold text-copilot-400 font-['Outfit']">{metrics.conversionRate}%</div>
          <div className="text-[11px] text-copilot-300 font-medium">{metrics.wonLeads} converted of {metrics.totalLeads} total leads</div>
        </div>
      </div>

      {/* Channel Attribution Table */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-['Outfit']">Lead Acquisition Channel Performance</h2>
            <p className="text-xs text-slate-400">Conversion efficiency and revenue yield by marketing source</p>
          </div>
          <button
            onClick={() => handleAskCopilot('What is our lead conversion rate by source?')}
            className="text-xs text-copilot-400 hover:text-copilot-300 font-medium flex items-center gap-1"
          >
            Analyze with Copilot <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Channel Source</th>
                <th className="py-3 px-4">Total Leads</th>
                <th className="py-3 px-4">Converted</th>
                <th className="py-3 px-4">Conversion Rate</th>
                <th className="py-3 px-4">Total Closed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sourceStats.map(s => (
                <tr key={s.source} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-slate-200">{s.source}</td>
                  <td className="py-3 px-4 text-slate-300">{s.total}</td>
                  <td className="py-3 px-4 text-slate-300">{s.won}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-copilot-400">{s.rate}%</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-100 font-['Outfit']">
                    ₹{s.value.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
