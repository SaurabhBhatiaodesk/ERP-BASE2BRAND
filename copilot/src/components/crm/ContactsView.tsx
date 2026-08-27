import React, { useState } from 'react';
import { Contact2, Search, Phone, Mail, Building2, User, Sparkles } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';

interface ContactsViewProps {
  onNavigateToLead: (leadId: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ onNavigateToLead }) => {
  const { contacts } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts & Accounts"
        subtitle={`Directory of verified customer and stakeholder contacts (${filtered.length})`}
      />

      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts by name, company..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-crm-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-crm-600/20 border border-crm-500/30 text-crm-400 font-bold flex items-center justify-center">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">{c.name}</h3>
                <p className="text-xs text-slate-400">{c.designation} &bull; {c.company}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{c.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{c.phone}</span>
              </div>
            </div>

            {c.linked_lead_id && (
              <div className="pt-2">
                <button
                  onClick={() => onNavigateToLead(c.linked_lead_id!)}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-xs font-medium text-crm-400 border border-slate-800 text-center transition"
                >
                  View Linked Lead Profile
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
