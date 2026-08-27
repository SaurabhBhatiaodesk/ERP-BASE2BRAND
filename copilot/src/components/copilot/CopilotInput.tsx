import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

export const CopilotInput: React.FC = () => {
  const { sendMessage, isLoading, pageContext } = useCopilot();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-slate-950/90 backdrop-blur-xl border-t border-white/[0.06] flex-shrink-0">
      <div className="relative flex items-center rounded-2xl bg-slate-900/90 border border-white/[0.1] focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition shadow-inner">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${pageContext}, team members, or CRM data...`}
          rows={1}
          disabled={isLoading}
          className="w-full pl-4 pr-11 py-3 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-28 leading-relaxed"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-2.5 w-7 h-7 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-20 disabled:cursor-not-allowed transition flex items-center justify-center shadow-md shadow-violet-600/30"
          title="Send"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      <div className="text-[10px] text-slate-500 text-center mt-1.5">
        AI Copilot connected to real Supabase CRM & ERP records
      </div>
    </form>
  );
};
