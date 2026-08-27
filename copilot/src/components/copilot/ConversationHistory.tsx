import React from 'react';
import { MessageSquare, Trash2, Plus, Clock, X } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

interface ConversationHistoryProps {
  onClose: () => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({ onClose }) => {
  const { 
    conversations, 
    activeConversationId, 
    switchConversation, 
    deleteConversation, 
    createNewConversation 
  } = useCopilot();

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-4 flex flex-col justify-between animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-copilot-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Conversation History</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => {
            createNewConversation();
            onClose();
          }}
          className="w-full py-2 px-3 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-copilot-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Start New Conversation</span>
        </button>

        {/* List of Conversations */}
        <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
          {conversations.map(conv => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => {
                  switchConversation(conv.id);
                  onClose();
                }}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                  isActive
                    ? 'bg-copilot-950/80 border-copilot-800/80 text-white'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-copilot-400' : 'text-slate-500'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{conv.title}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{new Date(conv.lastMessageAt).toLocaleDateString()}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{conv.pageContext}</span>
                    </div>
                  </div>
                </div>

                {conversations.length > 1 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
