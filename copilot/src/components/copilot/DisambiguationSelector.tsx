import React, { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { DisambiguationCard, DisambiguationOption } from '../../types/copilot';
import { useCopilot } from '../../context/CopilotContext';

interface DisambiguationSelectorProps {
  disambiguation: DisambiguationCard;
}

export const DisambiguationSelector: React.FC<DisambiguationSelectorProps> = ({ disambiguation }) => {
  const { sendMessage, isLoading } = useCopilot();
  const [selectedId, setSelectedId] = useState<string>(disambiguation.options[0]?.id || '');

  const handleSelectAndSend = (option: DisambiguationOption) => {
    if (isLoading) return;

    const originalQuery = (disambiguation.query || '').trim();
    const token = disambiguation.matchedToken || option.name.split(' ')[0];

    let targetQuery = '';
    if (originalQuery && token) {
      // Replace the token in original user query with the chosen full name
      const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
      if (wordRegex.test(originalQuery)) {
        targetQuery = originalQuery.replace(wordRegex, option.name);
      } else {
        // In case of glued prefix like "isabhishek present today?" -> "is Abhishek Jain present today?"
        const gluedRegex = new RegExp(token, 'i');
        if (gluedRegex.test(originalQuery)) {
          targetQuery = originalQuery.replace(gluedRegex, ` ${option.name} `).replace(/\s+/g, ' ').trim();
        } else {
          targetQuery = `${originalQuery} (${option.name})`;
        }
      }
    } else {
      targetQuery = `Tell me about ${option.name}`;
    }

    sendMessage(targetQuery);
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    const chosen = disambiguation.options.find(o => o.id === id);
    if (chosen) {
      handleSelectAndSend(chosen);
    }
  };

  return (
    <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-900/80 border border-white/[0.08] shadow-sm space-y-3">
      <div className="text-xs font-semibold text-white">
        {disambiguation.title || `Select ${disambiguation.entityType}:`}
      </div>

      {/* Modern Dropdown */}
      <div className="relative">
        <select
          value={selectedId}
          onChange={handleDropdownChange}
          disabled={isLoading}
          className="w-full appearance-none bg-slate-950 border border-white/[0.1] hover:border-violet-500 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-violet-500 transition cursor-pointer"
        >
          {disambiguation.options.map(opt => (
            <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-200 py-1">
              {opt.name} — {opt.role} ({opt.department})
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Quick Option Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {disambiguation.options.map(opt => (
          <button
            key={opt.id}
            onClick={() => handleSelectAndSend(opt)}
            disabled={isLoading}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 hover:bg-violet-950/50 border border-white/[0.06] hover:border-violet-500/50 text-left transition group"
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-white group-hover:text-violet-300 truncate">
                {opt.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {opt.role} &bull; {opt.department}
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 shrink-0 transition" />
          </button>
        ))}
      </div>
    </div>
  );
};
