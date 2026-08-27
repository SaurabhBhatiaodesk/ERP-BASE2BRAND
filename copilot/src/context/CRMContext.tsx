import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Lead, Deal, Task, Activity, Note, Contact, Employee, KPIMetrics, LeadStatus, DealStage } from '../types/crm';
import { 
  INITIAL_LEADS, 
  INITIAL_DEALS, 
  INITIAL_TASKS, 
  INITIAL_ACTIVITIES, 
  INITIAL_NOTES, 
  INITIAL_CONTACTS, 
  INITIAL_EMPLOYEES 
} from '../lib/crmDataStore';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface CRMContextType {
  leads: Lead[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  notes: Note[];
  contacts: Contact[];
  employees: Employee[];
  metrics: KPIMetrics;
  
  // Actions
  getLeadById: (id: string) => Lead | undefined;
  createLead: (lead: Omit<Lead, 'id' | 'created_at' | 'notes_count'>) => Lead;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  assignLead: (leadId: string, employeeId: string) => void;
  
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'is_completed'>) => Task;
  toggleTaskComplete: (id: string) => void;
  
  addNote: (leadId: string, content: string, isPinned?: boolean) => Note;
  logActivity: (activity: Omit<Activity, 'id' | 'created_at'>) => Activity;
  
  updateDealStage: (dealId: string, stage: DealStage) => void;
  createDeal: (deal: Omit<Deal, 'id' | 'created_at'>) => Deal;

  // Stale detection
  staleLeads: Lead[];
  todayTasks: Task[];
  overdueTasks: Task[];
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  // State populated exclusively from live Supabase
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Live Supabase Sync when configured
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.from('leads').select('*').order('id', { ascending: true }).then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const derivedContacts: Contact[] = [];
          const derivedDeals: Deal[] = [];
          const derivedNotes: Note[] = [];
          const derivedActivities: Activity[] = [];

          const mappedLeads: Lead[] = data.map((item: any) => {
            // Parse monetary values like "₹50.0L", "₹40.0L", "₹0"
            let numValue = 0;
            if (typeof item.value === 'number') {
              numValue = item.value;
            } else if (typeof item.value === 'string') {
              const cleaned = item.value.replace(/[^0-9.]/g, '');
              if (item.value.includes('L') || item.value.includes('l')) {
                numValue = parseFloat(cleaned) * 100000;
              } else if (item.value.includes('k') || item.value.includes('K')) {
                numValue = parseFloat(cleaned) * 1000;
              } else if (item.value.includes('Cr') || item.value.includes('cr')) {
                numValue = parseFloat(cleaned) * 10000000;
              } else {
                numValue = parseFloat(cleaned) || 0;
              }
            }

            // Map temp/stage to LeadStatus
            let status: LeadStatus = 'contacted';
            const temp = (item.temp || '').toLowerCase();
            const stage = (item.stage || '').toLowerCase();
            if (temp === 'hot') status = 'interested';
            else if (temp === 'warm') status = 'proposal';
            else if (temp === 'cold') status = 'stale';
            if (stage.includes('negotiat')) status = 'negotiation';
            if (stage.includes('won') || stage.includes('close')) status = 'won';

            const leadObj: Lead = {
              id: String(item.id),
              name: item.name || 'Unnamed Lead',
              email: item.email || '',
              phone: item.phone || item.contact || '+91 90876 54321',
              company: item.name?.includes('Pvt') || item.name?.includes('Ltd') || item.name?.includes('Inc') 
                ? item.name 
                : `${item.name} Enterprises`,
              designation: item.title || (item.temp === 'hot' ? 'Director of Tech' : 'Decision Maker'),
              status,
              deal_value: numValue,
              source: (item.industry === 'SaaS' ? 'Website' : 'LinkedIn') as LeadSource,
              assigned_to: currentUser.id,
              assigned_to_name: currentUser.full_name,
              last_contacted_at: item.created_at || new Date().toISOString(),
              notes_count: item.notes ? 1 : 0,
              created_at: item.created_at || new Date().toISOString(),
              location: item.location || 'India',
              industry: item.industry || 'Technology / SaaS',
            };

            // Derive Contact
            if (item.name) {
              derivedContacts.push({
                id: `cnt-${item.id}`,
                name: item.name,
                email: item.email || '',
                phone: item.phone || item.contact || '+91 90876 54321',
                company: leadObj.company,
                designation: leadObj.designation || 'Contact',
                linked_lead_id: String(item.id),
                created_at: item.created_at || new Date().toISOString(),
              });
            }

            // Derive Deal if value or stage present
            if (numValue > 0 || item.stage) {
              derivedDeals.push({
                id: `deal-${item.id}`,
                lead_id: String(item.id),
                lead_name: item.name,
                company: leadObj.company,
                title: `${item.name} - ${item.stage || 'Discovery'} Contract`,
                value: numValue,
                stage: numValue > 1000000 ? 'proposal' : 'prospecting',
                probability: numValue > 1000000 ? 60 : 30,
                expected_close_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                assigned_to: currentUser.id,
                assigned_to_name: currentUser.full_name,
                created_at: item.created_at || new Date().toISOString(),
              });
            }

            // Derive Note if present
            if (item.notes) {
              derivedNotes.push({
                id: `note-${item.id}`,
                lead_id: String(item.id),
                author_id: currentUser.id,
                author_name: currentUser.full_name,
                content: item.notes,
                is_pinned: true,
                created_at: item.created_at || new Date().toISOString(),
              });
            }

            // Derive Activity
            derivedActivities.push({
              id: `act-${item.id}`,
              lead_id: String(item.id),
              lead_name: item.name,
              performed_by: currentUser.id,
              performed_by_name: currentUser.full_name,
              activity_type: item.temp === 'hot' ? 'call' : 'email',
              summary: `Discovery logged for ${item.name} (${item.location || 'India'})`,
              details: item.notes || `Lead registered with status: ${item.temp || 'warm'} in stage: ${item.stage || 'Discovery'}`,
              created_at: item.created_at || new Date().toISOString(),
            });

            return leadObj;
          });

          setLeads(mappedLeads);
          setContacts(derivedContacts);
          setDeals(derivedDeals);
          setNotes(derivedNotes);
          setActivities(derivedActivities);
        }
      });

      supabase.from('employee_profiles').select('*').order('name', { ascending: true }).then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const realEmployees: Employee[] = data.map((item: any) => ({
            id: String(item.id),
            full_name: item.name || 'Team Member',
            email: item.email || '',
            role: (item.app_role === 'admin' || (item.role && item.role.toLowerCase().includes('ceo')) ? 'admin' : (item.role && item.role.toLowerCase().includes('leader')) ? 'manager' : 'bde') as any,
            phone: item.phone || '',
            target_revenue: 500000,
            department: item.dept || 'General',
            avatar_url: item.profile_image_url || undefined,
          }));
          setEmployees(realEmployees);
        }
      });
    }
  }, [currentUser]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('crm_leads_data', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('crm_deals_data', JSON.stringify(deals));
  }, [deals]);

  useEffect(() => {
    localStorage.setItem('crm_tasks_data', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('crm_activities_data', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('crm_notes_data', JSON.stringify(notes));
  }, [notes]);

  // Derived state
  const todayStr = new Date().toISOString().split('T')[0];

  const staleLeads = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return leads.filter(l => {
      if (['won', 'lost'].includes(l.status)) return false;
      const last = new Date(l.last_contacted_at);
      return last < sevenDaysAgo || l.status === 'stale';
    });
  }, [leads]);

  const todayTasks = useMemo(() => {
    return tasks.filter(t => !t.is_completed && t.due_date === todayStr);
  }, [tasks, todayStr]);

  const overdueTasks = useMemo(() => {
    return tasks.filter(t => !t.is_completed && t.due_date < todayStr);
  }, [tasks, todayStr]);

  const metrics = useMemo<KPIMetrics>(() => {
    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.status === 'won').length;
    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status)).length;
    const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;
    
    const wonDeals = deals.filter(d => d.stage === 'closed_won');
    const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
    
    const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
    const activePipelineValue = activeDeals.reduce((sum, d) => sum + d.value, 0);
    
    const totalDealSum = leads.filter(l => l.deal_value > 0).reduce((s, l) => s + l.deal_value, 0);
    const validLeadsCount = leads.filter(l => l.deal_value > 0).length;
    const averageDealValue = validLeadsCount > 0 ? Math.round(totalDealSum / validLeadsCount) : 0;

    return {
      totalLeads,
      activeLeads,
      wonLeads,
      conversionRate,
      totalRevenue,
      activePipelineValue,
      averageDealValue,
      todayFollowupsCount: todayTasks.length,
      overdueTasksCount: overdueTasks.length,
      staleLeadsCount: staleLeads.length,
    };
  }, [leads, deals, todayTasks, overdueTasks, staleLeads]);

  const getLeadById = (id: string) => leads.find(l => l.id === id);

  const createLead = (newLeadData: Omit<Lead, 'id' | 'created_at' | 'notes_count'>): Lead => {
    const emp = employees.find(e => e.id === newLeadData.assigned_to);
    const newLead: Lead = {
      ...newLeadData,
      id: `lead-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
      notes_count: 0,
      assigned_to_name: emp?.full_name || currentUser.full_name,
    };
    setLeads(prev => [newLead, ...prev]);

    // Safe mode: mutations stay in client application state without altering remote Supabase entries
    logActivity({
      lead_id: newLead.id,
      lead_name: newLead.name,
      performed_by: currentUser.id,
      performed_by_name: currentUser.full_name,
      activity_type: 'copilot_action',
      summary: `Lead created: ${newLead.name} (${newLead.company})`,
    });

    return newLead;
  };

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        let assigned_to_name = lead.assigned_to_name;
        if (updates.assigned_to) {
          const emp = employees.find(e => e.id === updates.assigned_to);
          if (emp) assigned_to_name = emp.full_name;
        }
        return { ...lead, ...updates, assigned_to_name };
      }
      return lead;
    }));
    // Note: Remote Supabase database is strictly protected (Read-Only) to prevent altering original records
  };

  const updateLeadStatus = (id: string, status: LeadStatus) => {
    const lead = getLeadById(id);
    if (!lead) return;
    const oldStatus = lead.status;
    updateLead(id, { status, last_contacted_at: new Date().toISOString() });

    logActivity({
      lead_id: id,
      lead_name: lead.name,
      performed_by: currentUser.id,
      performed_by_name: currentUser.full_name,
      activity_type: 'status_change',
      summary: `Changed lead status from "${oldStatus}" to "${status}"`,
    });
  };

  const assignLead = (leadId: string, employeeId: string) => {
    const lead = getLeadById(leadId);
    const emp = employees.find(e => e.id === employeeId);
    if (!lead || !emp) return;

    updateLead(leadId, { assigned_to: employeeId, assigned_to_name: emp.full_name });

    logActivity({
      lead_id: leadId,
      lead_name: lead.name,
      performed_by: currentUser.id,
      performed_by_name: currentUser.full_name,
      activity_type: 'copilot_action',
      summary: `Reassigned lead to ${emp.full_name}`,
    });
  };

  const createTask = (taskData: Omit<Task, 'id' | 'created_at' | 'is_completed'>): Task => {
    const emp = employees.find(e => e.id === taskData.assigned_to);
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now().toString(36)}`,
      is_completed: false,
      created_at: new Date().toISOString(),
      assigned_to_name: emp?.full_name || currentUser.full_name,
    };
    setTasks(prev => [newTask, ...prev]);

    logActivity({
      lead_id: taskData.lead_id,
      lead_name: taskData.lead_name,
      performed_by: currentUser.id,
      performed_by_name: currentUser.full_name,
      activity_type: 'copilot_action',
      summary: `Scheduled task: "${taskData.title}" for ${taskData.due_date} ${taskData.due_time || ''}`,
    });

    return newTask;
  };

  const toggleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextState = !t.is_completed;
        if (nextState) {
          logActivity({
            lead_id: t.lead_id,
            lead_name: t.lead_name,
            performed_by: currentUser.id,
            performed_by_name: currentUser.full_name,
            activity_type: 'task_completed',
            summary: `Completed task: "${t.title}"`,
          });
        }
        return {
          ...t,
          is_completed: nextState,
          completed_at: nextState ? new Date().toISOString() : undefined,
        };
      }
      return t;
    }));
  };

  const addNote = (leadId: string, content: string, isPinned = false): Note => {
    const lead = getLeadById(leadId);
    const newNote: Note = {
      id: `note-${Date.now().toString(36)}`,
      lead_id: leadId,
      author_id: currentUser.id,
      author_name: currentUser.full_name,
      content,
      is_pinned: isPinned,
      created_at: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);

    // increment note count
    if (lead) {
      updateLead(leadId, { notes_count: (lead.notes_count || 0) + 1 });
      logActivity({
        lead_id: leadId,
        lead_name: lead.name,
        performed_by: currentUser.id,
        performed_by_name: currentUser.full_name,
        activity_type: 'note',
        summary: `Added note: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
      });
    }

    return newNote;
  };

  const logActivity = (activityData: Omit<Activity, 'id' | 'created_at'>): Activity => {
    const newAct: Activity = {
      ...activityData,
      id: `act-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
    };
    setActivities(prev => [newAct, ...prev]);
    return newAct;
  };

  const updateDealStage = (dealId: string, stage: DealStage) => {
    setDeals(prev => prev.map(d => {
      if (d.id === dealId) {
        return {
          ...d,
          stage,
          closed_at: stage === 'closed_won' || stage === 'closed_lost' ? new Date().toISOString() : undefined,
        };
      }
      return d;
    }));
  };

  const createDeal = (dealData: Omit<Deal, 'id' | 'created_at'>): Deal => {
    const emp = employees.find(e => e.id === dealData.assigned_to);
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
      assigned_to_name: emp?.full_name || currentUser.full_name,
    };
    setDeals(prev => [newDeal, ...prev]);
    return newDeal;
  };

  return (
    <CRMContext.Provider
      value={{
        leads,
        deals,
        tasks,
        activities,
        notes,
        contacts,
        employees,
        metrics,
        staleLeads,
        todayTasks,
        overdueTasks,
        getLeadById,
        createLead,
        updateLead,
        updateLeadStatus,
        assignLead,
        createTask,
        toggleTaskComplete,
        addNote,
        logActivity,
        updateDealStage,
        createDeal,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error('useCRM must be used within a CRMProvider');
  return context;
};
