export type LeadStatus = 'new' | 'contacted' | 'interested' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'stale';

export type LeadSource = 'Website' | 'LinkedIn' | 'Referral' | 'Google Ads' | 'Cold Outreach' | 'Events';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  designation?: string;
  status: LeadStatus;
  deal_value: number;
  source: LeadSource;
  assigned_to: string; // Employee ID
  assigned_to_name?: string;
  last_contacted_at: string;
  notes_count: number;
  created_at: string;
  location?: string;
  industry?: string;
  custom_fields?: Record<string, any>;
}

export type DealStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Deal {
  id: string;
  lead_id: string;
  lead_name: string;
  company: string;
  title: string;
  value: number;
  stage: DealStage;
  probability: number;
  expected_close_date: string;
  assigned_to: string;
  assigned_to_name?: string;
  created_at: string;
  closed_at?: string;
}

export type TaskType = 'call' | 'email' | 'meeting' | 'demo' | 'follow_up' | 'review';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  lead_id: string;
  lead_name: string;
  assigned_to: string;
  assigned_to_name?: string;
  title: string;
  description?: string;
  task_type: TaskType;
  priority: TaskPriority;
  due_date: string; // YYYY-MM-DD
  due_time?: string; // HH:mm
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'status_change' | 'task_completed' | 'copilot_action';

export interface Activity {
  id: string;
  lead_id: string;
  lead_name?: string;
  performed_by: string;
  performed_by_name: string;
  activity_type: ActivityType;
  summary: string;
  details?: string;
  duration_minutes?: number;
  created_at: string;
}

export interface Note {
  id: string;
  lead_id: string;
  author_id: string;
  author_name: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'bde' | 'support';
  avatar_url?: string;
  phone: string;
  target_revenue: number;
  department: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  linked_lead_id?: string;
  created_at: string;
}

export interface KPIMetrics {
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  conversionRate: number;
  totalRevenue: number;
  activePipelineValue: number;
  averageDealValue: number;
  todayFollowupsCount: number;
  overdueTasksCount: number;
  staleLeadsCount: number;
}
