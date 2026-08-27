import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCw,
  Volume2,
  VolumeX,
  ArrowRight,
  Database
} from 'lucide-react';
import { CopilotMessage as MessageType } from '../../types/copilot';
import { ToolExecutionBadge } from './ToolExecutionBadge';
import { ActionConfirmation } from './ActionConfirmation';
import { DisambiguationSelector } from './DisambiguationSelector';
import { useCopilot } from '../../context/CopilotContext';

interface CopilotMessageProps {
  message: MessageType;
  isLast?: boolean;
}

export const CopilotMessage: React.FC<CopilotMessageProps> = ({ message, isLast }) => {
  const { rateMessage, retryLastMessage, isLoading, sendMessage } = useCopilot();
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Text to Speech Readout
  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    // Strip markdown formatting for natural speech
    const plainText = message.content
      .replace(/[#*`_•-]/g, ' ')
      .replace(/\|.*?\|/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Modern interactive markdown renderer
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    const flushTable = () => {
      if (tableBuffer.length > 0) {
        // Filter rows that contain pipe delimiters
        const rows = tableBuffer.map(r => r.trim()).filter(r => r.includes('|'));
        if (rows.length >= 2) {
          // Extract header row
          const headerCells = rows[0]
            .split('|')
            .map(c => c.trim())
            .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));

          // Extract data rows, skipping separator rows (e.g., |---|---| or |:---:|)
          const bodyRows = rows
            .slice(1)
            .filter(r => !/^[\s|:\-]+$/.test(r))
            .map(r => 
              r.split('|')
                .map(c => c.trim())
                .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''))
            );

          if (headerCells.length > 0 && bodyRows.length > 0) {
            elements.push(
              <div key={`table-${elements.length}-${Date.now()}`} className="my-3 overflow-x-auto rounded-2xl border border-[#1e2642] bg-[#090d1c] shadow-lg">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead className="bg-[#12182e] text-slate-300 text-[11px] uppercase font-bold tracking-wider border-b border-[#1e2642]">
                    <tr>
                      {headerCells.map((h, i) => (
                        <th key={i} className="py-2.5 px-3.5 text-slate-200 font-semibold whitespace-nowrap">
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#171e36]">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#11172e] transition group">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-3.5 text-slate-300 text-xs whitespace-nowrap">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
        tableBuffer = [];
      }
    };

    const renderInline = (text: string) => {
      // Parse Bold, Code, Italic, and highlight entity badges (₹, %, etc.)
      const parts = text.split(/(\*\*.*?\*\*|\`.*?\`|\_.*?\_)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          // Highlight currency
          if (inner.includes('₹') || inner.includes('L') || inner.includes('Cr')) {
            return (
              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 text-[11px] mx-0.5">
                {inner}
              </span>
            );
          }
          // Highlight percentage / Attendance
          if (inner.includes('%') || inner.toLowerCase().includes('attendance')) {
            return (
              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 font-bold border border-violet-500/30 text-[11px] mx-0.5">
                {inner}
              </span>
            );
          }
          return <strong key={idx} className="font-bold text-white">{inner}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={idx} className="px-1.5 py-0.5 rounded-md bg-[#101424] font-mono text-[11px] text-violet-300 border border-[#1e2642]">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={idx} className="italic text-slate-400">{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };

    let inCodeBlock = false;
    let codeBlockBuffer: string[] = [];

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${index}`} className="my-2.5 p-3.5 rounded-2xl bg-slate-950 border border-white/[0.08] text-xs font-mono text-slate-200 overflow-x-auto">
              <code>{codeBlockBuffer.join('\n')}</code>
            </pre>
          );
          codeBlockBuffer = [];
          inCodeBlock = false;
        } else {
          flushTable();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockBuffer.push(line);
        return;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableBuffer.push(line);
        return;
      } else {
        flushTable();
      }

      const trimmed = line.trim();
      if (line.startsWith('# ')) {
        elements.push(<h2 key={index} className="text-base font-bold text-white font-['Outfit'] mt-3.5 mb-1.5">{renderInline(line.slice(2))}</h2>);
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={index} className="text-sm font-bold text-white font-['Outfit'] mt-3 mb-1">{renderInline(line.slice(3))}</h3>);
      } else if (line.startsWith('### ')) {
        elements.push(<h4 key={index} className="text-xs font-bold text-violet-300 uppercase tracking-wider mt-3 mb-1">{renderInline(line.slice(4))}</h4>);
      } else if (line.startsWith('#### ')) {
        elements.push(<h5 key={index} className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-2 mb-1">{renderInline(line.slice(5))}</h5>);
      } else if (trimmed.startsWith('---')) {
        elements.push(<hr key={index} className="my-2.5 border-white/[0.06]" />);
      } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const isIndented = line.startsWith('  ') || line.startsWith('\t');
        const bulletText = trimmed.slice(2);
        elements.push(
          <div key={index} className={`flex items-start gap-2.5 text-xs text-slate-200 my-1 ${isIndented ? 'ml-4' : 'ml-1'}`}>
            <span className="text-violet-400 mt-1 text-[8px]">&bull;</span>
            <span className="flex-1 leading-relaxed">{renderInline(bulletText)}</span>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          elements.push(
            <div key={index} className="flex items-start gap-2 text-xs text-slate-200 my-1 ml-1">
              <span className="text-violet-400 font-semibold text-[11px] min-w-[16px]">{numMatch[1]}.</span>
              <span className="flex-1 leading-relaxed">{renderInline(numMatch[2])}</span>
            </div>
          );
        }
      } else if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="text-xs text-slate-200 leading-relaxed my-1.5">
            {renderInline(trimmed)}
          </p>
        );
      }
    });

    flushTable();
    return elements;
  };

  // Derive dynamic smart follow-up suggestions based on message content
  const getFollowUpSuggestions = (content: string): string[] => {
    const lower = content.toLowerCase();
    const suggestions: string[] = [];

    if (lower.includes('abhishek') || lower.includes('attendance') || lower.includes('employee')) {
      suggestions.push("Check team leaves for today");
      suggestions.push("Show upcoming team projects");
    } else if (lower.includes('lead') || lower.includes('ronald') || lower.includes('deal')) {
      suggestions.push("Schedule a follow-up task");
      suggestions.push("Show all high-value deals");
    } else if (lower.includes('pipeline') || lower.includes('revenue')) {
      suggestions.push("Which leads are stale (>7 days)?");
      suggestions.push("Show conversion rate breakdown");
    }

    return suggestions.slice(0, 2);
  };

  // User Message
  if (!isAssistant) {
    return (
      <div className="flex justify-end my-3 animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 shadow-lg shadow-violet-900/20 text-xs sm:text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const followUps = getFollowUpSuggestions(message.content);

  // Assistant Message
  return (
    <div className="flex flex-col space-y-2.5 my-4 group animate-fade-in">
      {/* Author Indicator */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-violet-600/30">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-white font-['Outfit']">Copilot AI</span>
        <span className="text-[10px] text-slate-500">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Tool Badges */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <ToolExecutionBadge toolCalls={message.toolCalls} />
      )}

      {/* Main Content */}
      <div className="pl-8 text-xs sm:text-[13px] text-slate-200 leading-relaxed space-y-1">
        {renderFormattedContent(message.content)}
      </div>

      {/* Action Proposal Confirmation Card */}
      {message.actionProposal && (
        <div className="pl-8 pt-1">
          <ActionConfirmation proposal={message.actionProposal} />
        </div>
      )}

      {/* Disambiguation Dropdown / Card */}
      {message.disambiguation && (
        <div className="pl-8 pt-1">
          <DisambiguationSelector disambiguation={message.disambiguation} />
        </div>
      )}

      {/* Dynamic Interactive Follow-up Prompt Chips */}
      {isLast && followUps.length > 0 && (
        <div className="pl-8 pt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">Suggested:</span>
          {followUps.map((p, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => sendMessage(p)}
              className="px-3 py-1 rounded-full bg-slate-900/90 hover:bg-violet-950 border border-white/[0.08] hover:border-violet-500/50 text-[11px] text-slate-300 hover:text-white transition flex items-center gap-1 shadow-sm"
            >
              <span>{p}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          ))}
        </div>
      )}

      {/* Micro Action Bar on Hover */}
      <div className="pl-8 flex items-center gap-2 pt-1 text-slate-500 text-[11px] opacity-70 group-hover:opacity-100 transition">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:text-slate-200 hover:bg-slate-850 transition flex items-center gap-1 text-[10px]"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        <button
          onClick={handleSpeak}
          className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] ${
            isSpeaking ? 'text-violet-400 bg-violet-950/60' : 'hover:text-slate-200 hover:bg-slate-850'
          }`}
          title="Read aloud"
        >
          {isSpeaking ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3" />}
          <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
        </button>

        {isLast && (
          <button
            onClick={retryLastMessage}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:text-slate-200 hover:bg-slate-850 transition flex items-center gap-1 text-[10px]"
            title="Retry query"
          >
            <RotateCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}

        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => rateMessage(message.id, 1)}
            className={`p-1.5 rounded-lg transition ${
              message.feedback === 1 ? 'text-emerald-400 bg-emerald-950/40' : 'hover:text-slate-300 hover:bg-slate-850'
            }`}
            title="Helpful response"
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => rateMessage(message.id, -1)}
            className={`p-1.5 rounded-lg transition ${
              message.feedback === -1 ? 'text-rose-400 bg-rose-950/40' : 'hover:text-slate-300 hover:bg-slate-850'
            }`}
            title="Not helpful"
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
