import React from 'react';
import { AlertCircle, Check, X, ShieldAlert, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { ActionProposal } from '../../types/copilot';
import { useCopilot } from '../../context/CopilotContext';

interface ActionConfirmationProps {
  proposal: ActionProposal;
}

export const ActionConfirmation: React.FC<ActionConfirmationProps> = ({ proposal }) => {
  const { confirmAction, cancelAction } = useCopilot();

  if (proposal.status === 'executed') {
    return (
      <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 space-y-1 my-3 animate-fade-in">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Action Confirmed & Executed</span>
        </div>
        <p className="text-[11px] text-emerald-400/90">{proposal.summary}</p>
      </div>
    );
  }

  if (proposal.status === 'cancelled') {
    return (
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 my-3">
        <span>Action was cancelled. No changes made to CRM database.</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-copilot-950/30 border border-copilot-800/60 shadow-xl space-y-3.5 my-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-copilot-600/20 border border-copilot-500/30 text-copilot-400 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white font-['Outfit']">{proposal.title}</div>
            <div className="text-[10px] text-copilot-300">Explicit confirmation required</div>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold uppercase">
          Awaiting Approval
        </span>
      </div>

      {/* Summary Box */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 space-y-2">
        <div className="font-medium text-slate-100">{proposal.summary}</div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
          {proposal.entityName && (
            <div>
              <span className="text-slate-500">Target Lead:</span>{' '}
              <strong className="text-slate-200">{proposal.entityName}</strong>
            </div>
          )}
          {proposal.args.due_date && (
            <div>
              <span className="text-slate-500">Scheduled Date:</span>{' '}
              <strong className="text-slate-200">{proposal.args.due_date} {proposal.args.due_time || ''}</strong>
            </div>
          )}
          {proposal.args.status && (
            <div>
              <span className="text-slate-500">New Status:</span>{' '}
              <strong className="text-slate-200 uppercase">{proposal.args.status}</strong>
            </div>
          )}
          {proposal.args.deal_value && (
            <div>
              <span className="text-slate-500">Deal Value:</span>{' '}
              <strong className="text-slate-200">₹{Number(proposal.args.deal_value).toLocaleString('en-IN')}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation & Cancel Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => cancelAction(proposal)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>

        <button
          onClick={() => confirmAction(proposal)}
          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-copilot-600 to-indigo-600 hover:from-copilot-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-copilot-600/30 transition flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Confirm & Execute</span>
        </button>
      </div>
    </div>
  );
};
