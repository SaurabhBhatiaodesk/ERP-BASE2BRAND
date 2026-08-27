import React, { useRef, useEffect } from 'react';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';
import { CopilotMessage } from './CopilotMessage';

export const CopilotMessages: React.FC = () => {
  const { messages, isLoading, error } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, index) => (
        <CopilotMessage
          key={msg.id}
          message={msg}
          isLast={index === messages.length - 1}
        />
      ))}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3 animate-pulse">
          <div className="w-6 h-6 rounded-lg bg-copilot-600/30 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-copilot-400 animate-spin" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-200">Copilot is analyzing CRM data...</div>
            <div className="text-[10px] text-slate-400">Querying verified tables, executing tools & synthesizing insights</div>
          </div>
        </div>
      )}

      {/* Error state indicator */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
