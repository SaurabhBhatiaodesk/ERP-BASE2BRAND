import React from 'react';
import { 
  Sparkles, 
  X, 
  Maximize2, 
  Minimize2, 
  Plus, 
  History,
  Trash2
} from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

interface CopilotHeaderProps {
  onToggleHistory: () => void;
  showHistory: boolean;
}

export const CopilotHeader: React.FC<CopilotHeaderProps> = ({ onToggleHistory, showHistory }) => {
  const { 
    setIsOpen, 
    isExpanded, 
    setIsExpanded, 
    clearConversation, 
    createNewConversation,
    pageContext
  } = useCopilot();

  return (
    <div className="h-13 px-4 py-3 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl flex items-center justify-between flex-shrink-0">
      {/* Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-white">Copilot</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-white/[0.08] text-slate-300 capitalize">
            {pageContext}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={createNewConversation}
          title="New Chat"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleHistory}
          title="Chat History"
          className={`p-1.5 rounded-lg transition ${
            showHistory
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <History className="w-4 h-4" />
        </button>

        <button
          onClick={clearConversation}
          title="Clear Chat"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-850 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Default width' : 'Expand width'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition hidden md:block"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setIsOpen(false)}
          title="Close (Esc)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
