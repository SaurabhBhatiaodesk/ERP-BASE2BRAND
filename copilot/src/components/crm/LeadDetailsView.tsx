import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  MessageSquare, 
  Send
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { LeadStatus } from '../../types/crm';

interface LeadDetailsViewProps {
  leadId: string;
  onBack: () => void;
}

export const LeadDetailsView: React.FC<LeadDetailsViewProps> = ({ leadId, onBack }) => {
  const { leads, activities, notes, tasks, updateLeadStatus, addNote, toggleTaskComplete } = useCRM();
  const { sendMessage, setIsOpen, setSelectedLeadId, setPageContext } = useCopilot();

  const [newNoteContent, setNewNoteContent] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'notes'>('timeline');

  const lead = leads.find(l => l.id === leadId);

  useEffect(() => {
    setSelectedLeadId(leadId);
    setPageContext('lead-details');
    return () => {
      setSelectedLeadId(undefined);
      setPageContext('leads');
    };
  }, [leadId, setSelectedLeadId, setPageContext]);

  if (!lead) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-base font-bold text-slate-100">Lead not found</h2>
        <button onClick={onBack} className="px-4 py-2 bg-slate-800 rounded-xl text-xs text-white">
          Back to Leads
        </button>
      </div>
    );
  }

  const leadActivities = activities.filter(a => a.lead_id === leadId);
  const leadNotes = notes.filter(n => n.lead_id === leadId);
  const leadTasks = tasks.filter(t => t.lead_id === leadId);

  const handleAskCopilot = (prompt: string) => {
    setIsOpen(true);
    sendMessage(prompt);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    addNote(leadId, newNoteContent.trim());
    setNewNoteContent('');
  };

  const handleStatusChange = (status: LeadStatus) => {
    updateLeadStatus(leadId, status);
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to directory</span>
        </button>

        {/* Copilot Action Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAskCopilot(`Summarize ${lead.name}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Dossier</span>
          </button>
          <button
            onClick={() => handleAskCopilot(`Draft a follow-up message for ${lead.name}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <span>Draft Email</span>
          </button>
        </div>
      </div>

      {/* Main Dossier Card */}
      <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">{lead.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{lead.company} &bull; {lead.designation || 'Decision Maker'}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white font-['Outfit']">
              ₹{(lead.deal_value || 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400">Potential Contract Value</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/60 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50">
            <div className="text-[10px] text-slate-500">Email</div>
            <div className="text-slate-200 font-medium truncate mt-0.5">{lead.email || 'N/A'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50">
            <div className="text-[10px] text-slate-500">Phone</div>
            <div className="text-slate-200 font-medium truncate mt-0.5">{lead.phone || 'N/A'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50">
            <div className="text-[10px] text-slate-500">Location</div>
            <div className="text-slate-200 font-medium truncate mt-0.5">{lead.location || 'India'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50">
            <div className="text-[10px] text-slate-500">Industry</div>
            <div className="text-slate-200 font-medium truncate mt-0.5">{lead.industry || 'Technology'}</div>
          </div>
        </div>

        {/* Stage Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs text-slate-400 mr-2">Pipeline Stage:</span>
          {(['contacted', 'interested', 'proposal', 'negotiation', 'won'] as LeadStatus[]).map(st => (
            <button
              key={st}
              onClick={() => handleStatusChange(st)}
              className={`px-3 py-1 rounded-xl text-xs font-medium uppercase transition ${
                lead.status === st
                  ? 'bg-copilot-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === 'timeline' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activity Timeline ({leadActivities.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === 'notes' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Notes ({leadNotes.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === 'tasks' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tasks ({leadTasks.length})
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                placeholder="Add a private note about this lead..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-copilot-500 transition"
              />
              <button
                type="submit"
                disabled={!newNoteContent.trim()}
                className="px-4 py-2 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-medium transition disabled:opacity-40"
              >
                Add Note
              </button>
            </form>

            <div className="space-y-2">
              {leadNotes.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl">No notes logged yet.</div>
              ) : (
                leadNotes.map(n => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                    <p className="text-xs text-slate-200 leading-relaxed">{n.content}</p>
                    <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-2">
            {leadActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl">No timeline records.</div>
            ) : (
              leadActivities.map(a => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-slate-200 font-medium">{a.summary}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] uppercase font-semibold">
                    {a.activity_type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-2">
            {leadTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl">No tasks assigned to this lead.</div>
            ) : (
              leadTasks.map(t => (
                <div key={t.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className={t.is_completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                    {t.title}
                  </div>
                  <span className="text-[10px] text-slate-400">{t.due_date}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
