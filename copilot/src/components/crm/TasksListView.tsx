import React, { useState } from 'react';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Phone, 
  Mail, 
  Users,
  Check
} from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useCopilot } from '../../context/CopilotContext';
import { PageHeader } from '../layout/PageHeader';
import { TaskPriority } from '../../types/crm';

interface TasksListViewProps {
  onOpenCreateModal: () => void;
  onNavigateToLead: (leadId: string) => void;
}

export const TasksListView: React.FC<TasksListViewProps> = ({ onOpenCreateModal, onNavigateToLead }) => {
  const { tasks, toggleTaskComplete, todayTasks, overdueTasks } = useCRM();
  const { sendMessage, setIsOpen } = useCopilot();

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'overdue' | 'completed'>('all');
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'today') return !t.is_completed && t.due_date === todayStr;
    if (activeTab === 'overdue') return !t.is_completed && t.due_date < todayStr;
    if (activeTab === 'completed') return t.is_completed;
    return true;
  });

  const handleAskCopilot = (prompt: string) => {
    setIsOpen(true);
    sendMessage(prompt);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    const map = {
      urgent: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      high: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      medium: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      low: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${map[p] || map.medium}`}>
        {p}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks & Schedule"
        subtitle="Manage scheduled follow-ups, calls, reviews, and client reminders."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleAskCopilot('What should I focus on today?')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-copilot-500/50 text-slate-300 hover:text-white text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-copilot-400" />
              <span>Prioritize Tasks</span>
            </button>
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-copilot-600 hover:bg-copilot-500 text-white text-xs font-semibold shadow-md shadow-copilot-600/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </button>
          </div>
        }
      />

      {/* Clean Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
        {[
          { id: 'all', label: `All Tasks (${tasks.length})` },
          { id: 'today', label: `Today (${todayTasks.length})` },
          { id: 'overdue', label: `Overdue (${overdueTasks.length})` },
          { id: 'completed', label: `Completed (${tasks.filter(t => t.is_completed).length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            No tasks in this view.
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-4 ${
                task.is_completed
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => toggleTaskComplete(task.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                    task.is_completed
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-slate-700 hover:border-copilot-500 bg-slate-950'
                  }`}
                >
                  {task.is_completed && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div className="min-w-0">
                  <div className={`text-xs font-semibold truncate ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                    {task.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-2">
                    <span
                      onClick={() => onNavigateToLead(task.lead_id)}
                      className="hover:text-copilot-300 cursor-pointer underline decoration-dotted"
                    >
                      {task.lead_name}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {task.due_date} {task.due_time || ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {getPriorityBadge(task.priority)}
                <span className="text-[11px] text-slate-400 hidden sm:inline">{task.assigned_to_name || 'Assigned'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
