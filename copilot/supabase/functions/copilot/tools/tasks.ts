// Supabase Edge Function - Tasks & Follow-up Tools
export async function getPendingTasks(client: any, orgId: string, assignedTo?: string, limit = 10) {
  let query = client
    .from("tasks")
    .select("id, title, description, task_type, priority, due_date, due_time, is_completed, lead_id, assigned_to")
    .eq("organization_id", orgId)
    .eq("is_completed", false)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch pending tasks: ${error.message}`);
  return data;
}

export async function getOverdueTasks(client: any, orgId: string, assignedTo?: string) {
  const today = new Date().toISOString().split("T")[0];
  let query = client
    .from("tasks")
    .select("id, title, description, task_type, priority, due_date, due_time, lead_id, assigned_to")
    .eq("organization_id", orgId)
    .eq("is_completed", false)
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch overdue tasks: ${error.message}`);
  return data;
}

export async function getTodayFollowups(client: any, orgId: string, assignedTo?: string) {
  const today = new Date().toISOString().split("T")[0];
  let query = client
    .from("tasks")
    .select("id, title, description, task_type, priority, due_date, due_time, lead_id, assigned_to")
    .eq("organization_id", orgId)
    .eq("is_completed", false)
    .eq("due_date", today)
    .order("due_time", { ascending: true });

  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch today's followups: ${error.message}`);
  return data;
}
