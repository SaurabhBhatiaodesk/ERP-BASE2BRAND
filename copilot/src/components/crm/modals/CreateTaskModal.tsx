import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useAuth } from '../../../context/AuthContext';
import { TaskType, TaskPriority } from '../../../types/crm';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLeadId?: string;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, defaultLeadId }) => {
  const { leads, createTask } = useCRM();
  const { currentUser } = useAuth();

  const [leadId, setLeadId] = useState(defaultLeadId || leads[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('follow_up');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [dueTime, setDueTime] = useState('10:00');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !leadId) return;

    const targetLead = leads.find(l => l.id === leadId);

    createTask({
      lead_id: leadId,
      lead_name: targetLead?.name || 'Lead',
      title: title.trim(),
      description: description.trim() || undefined,
      task_type: taskType,
      priority,
      due_date: dueDate,
      due_time: dueTime,
      assigned_to: currentUser.id,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-copilot-600/20 border border-copilot-500/30 text-copilot-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white font-['Outfit']">Schedule Task / Follow-up</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Select CRM Lead *</label>
            <select
              value={leadId}
              onChange={e => setLeadId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
            >
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.company})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Follow up on pricing proposal"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Due Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Task Type</label>
              <select
                value={taskType}
                onChange={e => setTaskType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              >
                <option value="follow_up">Follow Up</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
                <option value="review">Review</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Description / Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional context or agenda..."
              rows={2}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-crm-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-crm-600 hover:bg-crm-500 text-white font-semibold shadow-md shadow-crm-600/30 transition"
            >
              Schedule Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
