import React from 'react';
import { useCopilot } from '../../context/CopilotContext';

export const SuggestedPrompts: React.FC = () => {
  const { suggestedPrompts, sendMessage, isLoading, messages } = useCopilot();

  // If there are already messages, show a compact horizontal scrollable strip
  if (suggestedPrompts.length === 0) return null;

  return (
    <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/[0.04] bg-slate-950/40 shrink-0">
      {suggestedPrompts.map(item => (
        <button
          key={item.id}
          disabled={isLoading}
          onClick={() => sendMessage(item.prompt)}
          className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-violet-950/80 border border-white/[0.08] hover:border-violet-500/40 text-[11px] text-slate-300 hover:text-white transition disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
