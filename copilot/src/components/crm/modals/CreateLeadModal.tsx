import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useAuth } from '../../../context/AuthContext';
import { LeadStatus, LeadSource } from '../../../types/crm';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ isOpen, onClose }) => {
  const { createLead, employees } = useCRM();
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dealValue, setDealValue] = useState('50000');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [source, setSource] = useState<LeadSource>('Website');
  const [assignedTo, setAssignedTo] = useState(currentUser.id);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;

    createLead({
      name: name.trim(),
      company: company.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: phone.trim() || '+91 98000 11223',
      designation: 'Director',
      deal_value: Number(dealValue) || 0,
      status,
      source,
      assigned_to: assignedTo,
      last_contacted_at: new Date().toISOString(),
      location: 'India',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-crm-600/20 border border-crm-500/30 text-crm-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white font-['Outfit']">Add New Lead</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Lead Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Company Name *</label>
              <input
                type="text"
                required
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Apex Dynamics"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rahul@apex.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98201 44552"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Deal Value (₹)</label>
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Source</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
              >
                <option value="Website">Website</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Events">Events</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Assign to BDE</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-crm-500"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>
              ))}
            </select>
          </div>

          {/* Modal Actions */}
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
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
