import React, { useState } from 'react';
import { useCopilot } from '../../context/CopilotContext';
import { CopilotHeader } from './CopilotHeader';
import { CopilotMessages } from './CopilotMessages';
import { SuggestedPrompts } from './SuggestedPrompts';
import { CopilotInput } from './CopilotInput';
import { ConversationHistory } from './ConversationHistory';

export const CopilotPanel: React.FC = () => {
  const { isOpen, isExpanded } = useCopilot();
  const [showHistory, setShowHistory] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={() => {}}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-fade-in"
      />

      {/* Main Copilot Drawer Container */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl transition-all duration-300 ease-out ${
          isExpanded ? 'w-full md:w-[680px]' : 'w-full md:w-[440px]'
        }`}
      >
        {/* Header */}
        <CopilotHeader
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory(!showHistory)}
        />

        {/* Relative content area for messages or history drawer */}
        <div className="relative flex-1 flex flex-col min-h-0">
          {showHistory && (
            <ConversationHistory onClose={() => setShowHistory(false)} />
          )}

          {/* Chat Messages */}
          <CopilotMessages />

          {/* Contextual Suggested Prompt Chips */}
          <SuggestedPrompts />

          {/* User Input Bar */}
          <CopilotInput />
        </div>
      </div>
    </>
  );
};
