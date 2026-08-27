import React from 'react';
import { CheckCircle2, Loader2, Search, Database, Calendar, UserCheck, ShieldAlert } from 'lucide-react';
import { ToolCall } from '../../types/copilot';

interface ToolExecutionBadgeProps {
  toolCalls?: ToolCall[];
}

export const ToolExecutionBadge: React.FC<ToolExecutionBadgeProps> = ({ toolCalls }) => {
  if (!toolCalls || toolCalls.length === 0) return null;

  const getToolIcon = (name: string) => {
    if (name.includes('search')) return Search;
    if (name.includes('task')) return Calendar;
    if (name.includes('employee') || name.includes('team')) return UserCheck;
    return Database;
  };

  return (
    <div className="space-y-1 my-2">
      {toolCalls.map(tc => {
        const Icon = getToolIcon(tc.name);
        return (
          <div
            key={tc.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300 mr-1.5"
          >
            {tc.status === 'running' ? (
              <Loader2 className="w-3 h-3 text-copilot-400 animate-spin" />
            ) : tc.status === 'failed' ? (
              <ShieldAlert className="w-3 h-3 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
            <Icon className="w-3 h-3 text-slate-400" />
            <span>
              {tc.name} {tc.args && Object.keys(tc.args).length > 0 ? `(${JSON.stringify(tc.args).slice(0, 30)}...)` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
};
