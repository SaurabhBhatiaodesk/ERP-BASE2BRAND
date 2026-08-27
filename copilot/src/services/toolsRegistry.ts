import { Lead, Deal, Task, Activity, Note, Employee } from '../types/crm';

export interface ToolContext {
  leads: Lead[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
  notes: Note[];
  employees: Employee[];
  currentUserId: string;
  selectedLeadId?: string;
}

export const executeTool = async (
  toolName: string,
  args: Record<string, any>,
  ctx: ToolContext
): Promise<{ result: any; isActionProposal?: boolean; proposal?: any }> => {
  const { leads, deals, tasks, activities, notes, employees, currentUserId, selectedLeadId } = ctx;

  switch (toolName) {
    case 'search_leads': {
      const limit = Math.min(args.limit || 10, 20);
      let list = [...leads];

      if (args.status) {
        list = list.filter(l => l.status.toLowerCase() === args.status.toLowerCase());
      }
      if (args.assigned_to) {
        list = list.filter(l => l.assigned_to === args.assigned_to || l.assigned_to_name?.toLowerCase().includes(args.assigned_to.toLowerCase()));
      }
      if (args.stale_days && args.stale_days > 0) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - args.stale_days);
        list = list.filter(l => {
          if (['won', 'lost'].includes(l.status)) return false;
          return new Date(l.last_contacted_at) < threshold || l.status === 'stale';
        });
      }
      if (args.query) {
        const q = args.query.toLowerCase();
        list = list.filter(l =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.location && l.location.toLowerCase().includes(q))
        );
      }

      if (args.sort_by === 'deal_value') {
        list.sort((a, b) => b.deal_value - a.deal_value);
      } else if (args.sort_by === 'last_contacted_at') {
        list.sort((a, b) => new Date(a.last_contacted_at).getTime() - new Date(b.last_contacted_at).getTime());
      } else {
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      const projected = list.slice(0, limit).map(l => ({
        id: l.id,
        name: l.name,
        company: l.company,
        status: l.status,
        deal_value: l.deal_value,
        assigned_to_name: l.assigned_to_name,
        last_contacted_at: l.last_contacted_at,
        source: l.source,
        location: l.location,
        industry: l.industry,
      }));

      return { result: { total_matches: list.length, returned_count: projected.length, leads: projected } };
    }

    case 'get_lead': {
      const targetId = args.leadIdOrName || selectedLeadId;
      if (!targetId) throw new Error('No lead specified');

      const lead = leads.find(l => 
        l.id === targetId || 
        l.name.toLowerCase().includes(targetId.toLowerCase()) ||
        l.company.toLowerCase().includes(targetId.toLowerCase())
      );

      if (!lead) throw new Error(`Lead "${targetId}" not found`);

      return {
        result: {
          id: lead.id,
          name: lead.name,
          company: lead.company,
          email: lead.email,
          phone: lead.phone,
          designation: lead.designation,
          status: lead.status,
          deal_value: lead.deal_value,
          source: lead.source,
          assigned_to_name: lead.assigned_to_name,
          last_contacted_at: lead.last_contacted_at,
          industry: lead.industry,
          location: lead.location,
        }
      };
    }

    case 'get_lead_activity': {
      const leadId = args.lead_id || selectedLeadId;
      if (!leadId) throw new Error('No lead ID specified');

      const acts = activities
        .filter(a => a.lead_id === leadId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      return { result: { lead_id: leadId, activity_count: acts.length, activities: acts } };
    }

    case 'get_lead_notes': {
      const leadId = args.lead_id || selectedLeadId;
      if (!leadId) throw new Error('No lead ID specified');

      const leadNotes = notes.filter(n => n.lead_id === leadId);
      return { result: { lead_id: leadId, notes_count: leadNotes.length, notes: leadNotes } };
    }

    case 'get_lead_tasks': {
      const leadId = args.lead_id || selectedLeadId;
      if (!leadId) throw new Error('No lead ID specified');

      const leadTasks = tasks.filter(t => t.lead_id === leadId);
      return { result: { lead_id: leadId, tasks: leadTasks } };
    }

    case 'get_sales_summary': {
      const wonDeals = deals.filter(d => d.stage === 'closed_won');
      const activePipeline = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
      const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
      const pipelineValue = activePipeline.reduce((sum, d) => sum + d.value, 0);
      const avgDeal = wonDeals.length > 0 ? Math.round(totalRevenue / wonDeals.length) : 0;

      return {
        result: {
          closed_won_deals_count: wonDeals.length,
          total_closed_revenue: totalRevenue,
          active_pipeline_deals_count: activePipeline.length,
          active_pipeline_value: pipelineValue,
          average_deal_size: avgDeal,
          conversion_rate: leads.length > 0 ? ((leads.filter(l => l.status === 'won').length / leads.length) * 100).toFixed(1) + '%' : '0%',
        }
      };
    }

    case 'get_conversion_rate': {
      const total = leads.length;
      const won = leads.filter(l => l.status === 'won').length;
      const overall = total > 0 ? ((won / total) * 100).toFixed(1) + '%' : '0%';

      if (args.breakdownBy === 'source') {
        const sourceMap: Record<string, { total: number; won: number; value: number }> = {};
        for (const lead of leads) {
          const s = lead.source;
          if (!sourceMap[s]) sourceMap[s] = { total: 0, won: 0, value: 0 };
          sourceMap[s].total++;
          if (lead.status === 'won') {
            sourceMap[s].won++;
            sourceMap[s].value += lead.deal_value;
          }
        }
        const breakdown = Object.entries(sourceMap).map(([src, stats]) => ({
          source: src,
          total_leads: stats.total,
          won_leads: stats.won,
          conversion_rate: stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) + '%' : '0%',
          revenue: stats.value,
        }));
        return { result: { overall_conversion_rate: overall, total_leads: total, total_won: won, breakdown } };
      }

      return { result: { overall_conversion_rate: overall, total_leads: total, total_won: won } };
    }

    case 'get_revenue_summary': {
      const wonDeals = deals.filter(d => d.stage === 'closed_won');
      const totalWonRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
      return {
        result: {
          total_won_revenue: totalWonRevenue,
          won_deal_count: wonDeals.length,
          closed_deals: wonDeals.map(d => ({ title: d.title, company: d.company, value: d.value, closed_at: d.closed_at })),
        }
      };
    }

    case 'get_deal_summary': {
      const stageDistribution: Record<string, { count: number; total_value: number }> = {
        prospecting: { count: 0, total_value: 0 },
        qualification: { count: 0, total_value: 0 },
        proposal: { count: 0, total_value: 0 },
        negotiation: { count: 0, total_value: 0 },
        closed_won: { count: 0, total_value: 0 },
        closed_lost: { count: 0, total_value: 0 },
      };

      for (const d of deals) {
        if (stageDistribution[d.stage]) {
          stageDistribution[d.stage].count++;
          stageDistribution[d.stage].total_value += d.value;
        }
      }

      return { result: { total_deals: deals.length, stages: stageDistribution } };
    }

    case 'get_today_followups': {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTasks = tasks.filter(t => !t.is_completed && t.due_date === todayStr);
      return { result: { count: todayTasks.length, date: todayStr, followups: todayTasks } };
    }

    case 'get_overdue_tasks': {
      const todayStr = new Date().toISOString().split('T')[0];
      const overdue = tasks.filter(t => !t.is_completed && t.due_date < todayStr);
      return { result: { count: overdue.length, tasks: overdue } };
    }

    case 'get_pending_tasks': {
      let pending = tasks.filter(t => !t.is_completed);
      if (args.assigned_to) {
        pending = pending.filter(t => t.assigned_to === args.assigned_to);
      }
      return { result: { count: pending.length, tasks: pending.slice(0, 10) } };
    }

    case 'get_employee_performance': {
      const empIdentifier = args.employeeIdOrName || currentUserId;
      const emp = employees.find(e => e.id === empIdentifier || e.full_name.toLowerCase().includes(empIdentifier.toLowerCase()));
      if (!emp) throw new Error(`Employee "${empIdentifier}" not found`);

      const empLeads = leads.filter(l => l.assigned_to === emp.id);
      const wonLeads = empLeads.filter(l => l.status === 'won');
      const empWonDeals = deals.filter(d => d.assigned_to === emp.id && d.stage === 'closed_won');
      const revenueAchieved = empWonDeals.reduce((sum, d) => sum + d.value, 0);

      return {
        result: {
          employee_id: emp.id,
          name: emp.full_name,
          role: emp.role,
          target_revenue: emp.target_revenue,
          revenue_achieved: revenueAchieved,
          quota_attainment: emp.target_revenue > 0 ? ((revenueAchieved / emp.target_revenue) * 100).toFixed(1) + '%' : '0%',
          assigned_leads_count: empLeads.length,
          won_leads_count: wonLeads.length,
          conversion_rate: empLeads.length > 0 ? ((wonLeads.length / empLeads.length) * 100).toFixed(1) + '%' : '0%',
        }
      };
    }

    case 'get_team_performance': {
      const leaderboard = employees.map(emp => {
        const empLeads = leads.filter(l => l.assigned_to === emp.id);
        const wonLeads = empLeads.filter(l => l.status === 'won');
        const empWonDeals = deals.filter(d => d.assigned_to === emp.id && d.stage === 'closed_won');
        const revenueAchieved = empWonDeals.reduce((sum, d) => sum + d.value, 0);

        return {
          employee_id: emp.id,
          name: emp.full_name,
          role: emp.role,
          revenue_achieved: revenueAchieved,
          target_revenue: emp.target_revenue,
          conversion_rate: empLeads.length > 0 ? ((wonLeads.length / empLeads.length) * 100).toFixed(1) + '%' : '0%',
          quota_attainment: emp.target_revenue > 0 ? Math.round((revenueAchieved / emp.target_revenue) * 100) + '%' : '0%',
          assigned_leads: empLeads.length,
          deals_won: empWonDeals.length,
        };
      });

      leaderboard.sort((a, b) => b.revenue_achieved - a.revenue_achieved);

      return {
        result: {
          total_team_members: leaderboard.length,
          leaderboard,
        }
      };
    }

    // Action Proposals (Require Confirmation)
    case 'propose_create_task': {
      let targetLead = leads.find(l => l.id === args.lead_id);
      if (!targetLead && args.lead_name) {
        targetLead = leads.find(l => l.name.toLowerCase().includes(args.lead_name.toLowerCase()));
      }
      if (!targetLead && selectedLeadId) {
        targetLead = leads.find(l => l.id === selectedLeadId);
      }

      if (!targetLead) {
        targetLead = leads[0];
      }

      const proposal = {
        id: `prop-${Date.now()}`,
        toolName: 'create_task' as const,
        entityType: 'task' as const,
        entityId: targetLead?.id,
        entityName: targetLead?.name || 'Lead',
        title: 'Schedule CRM Task / Follow-up',
        summary: `Create task "${args.title}" for ${targetLead?.name} on ${args.due_date} at ${args.due_time || '10:00 AM'}`,
        args: {
          lead_id: targetLead?.id,
          lead_name: targetLead?.name,
          title: args.title,
          description: args.description || '',
          due_date: args.due_date,
          due_time: args.due_time || '10:00',
          priority: args.priority || 'medium',
          task_type: args.task_type || 'follow_up',
          assigned_to: currentUserId,
        },
        status: 'pending_confirmation' as const,
      };

      return { result: { message: 'Action proposal prepared. Awaiting user confirmation.' }, isActionProposal: true, proposal };
    }

    case 'propose_update_lead': {
      let targetLead = leads.find(l => l.id === args.lead_id);
      if (!targetLead && args.lead_name) {
        targetLead = leads.find(l => l.name.toLowerCase().includes(args.lead_name.toLowerCase()));
      }
      if (!targetLead && selectedLeadId) {
        targetLead = leads.find(l => l.id === selectedLeadId);
      }

      if (!targetLead) {
        targetLead = leads[0];
      }

      const updates: string[] = [];
      if (args.status) updates.push(`Status: ${args.status}`);
      if (args.deal_value) updates.push(`Deal Value: ₹${Number(args.deal_value).toLocaleString('en-IN')}`);

      const proposal = {
        id: `prop-${Date.now()}`,
        toolName: 'update_lead' as const,
        entityType: 'lead' as const,
        entityId: targetLead?.id,
        entityName: targetLead?.name || 'Lead',
        title: 'Update Lead Details',
        summary: `Update ${targetLead?.name} (${updates.join(', ')})`,
        args: {
          lead_id: targetLead?.id,
          status: args.status,
          deal_value: args.deal_value,
        },
        status: 'pending_confirmation' as const,
      };

      return { result: { message: 'Action proposal prepared. Awaiting user confirmation.' }, isActionProposal: true, proposal };
    }

    default:
      throw new Error(`Unrecognized tool: ${toolName}`);
  }
};
