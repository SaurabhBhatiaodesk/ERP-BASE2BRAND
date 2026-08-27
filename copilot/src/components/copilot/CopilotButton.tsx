import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

export const CopilotButton: React.FC = () => {
  const { toggleOpen, isOpen } = useCopilot();

  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-fade-in">
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-copilot-600 hover:bg-copilot-500 text-white font-medium text-xs shadow-xl shadow-copilot-600/30 hover:scale-[1.03] active:scale-[0.98] transition-all border border-copilot-400/20"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Ask Copilot</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-black/25 rounded text-white/90">
          ⌘K
        </kbd>
      </button>
    </div>
  );
};
