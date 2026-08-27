// Supabase Edge Function - Employee & Team Performance Tools
export async function getEmployeePerformance(client: any, orgId: string, employeeIdOrName: string) {
  let empQuery = client
    .from("profiles")
    .select("id, full_name, email, role, target_revenue")
    .eq("organization_id", orgId);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeIdOrName);
  if (isUuid) {
    empQuery = empQuery.eq("id", employeeIdOrName);
  } else {
    empQuery = empQuery.ilike("full_name", `%${employeeIdOrName}%`).limit(1);
  }

  const { data: emp, error: empErr } = await empQuery.single();
  if (empErr || !emp) throw new Error(`Employee "${employeeIdOrName}" not found`);

  // Fetch leads assigned to this employee
  const { data: leads } = await client
    .from("leads")
    .select("id, status, deal_value")
    .eq("organization_id", orgId)
    .eq("assigned_to", emp.id);

  // Fetch closed deals
  const { data: deals } = await client
    .from("deals")
    .select("id, value, stage")
    .eq("organization_id", orgId)
    .eq("assigned_to", emp.id);

  const totalLeads = leads?.length || 0;
  const wonLeads = leads?.filter((l: any) => l.status === "won").length || 0;
  const closedWonDeals = deals?.filter((d: any) => d.stage === "closed_won") || [];
  const totalRevenue = closedWonDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

  return {
    employee_id: emp.id,
    name: emp.full_name,
    email: emp.email,
    role: emp.role,
    target_revenue: emp.target_revenue,
    total_assigned_leads: totalLeads,
    won_leads: wonLeads,
    conversion_rate: totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) + "%" : "0%",
    closed_deals_count: closedWonDeals.length,
    revenue_achieved: totalRevenue,
    quota_attainment: emp.target_revenue > 0 ? ((totalRevenue / emp.target_revenue) * 100).toFixed(1) + "%" : "N/A",
  };
}

export async function getTeamPerformance(client: any, orgId: string) {
  const { data: team, error } = await client
    .from("profiles")
    .select("id, full_name, email, role, target_revenue")
    .eq("organization_id", orgId);

  if (error) throw new Error(`Failed to fetch team performance: ${error.message}`);

  const rankings = [];
  for (const emp of team || []) {
    const stats = await getEmployeePerformance(client, orgId, emp.id);
    rankings.push(stats);
  }

  // Sort by revenue achieved descending
  rankings.sort((a, b) => b.revenue_achieved - a.revenue_achieved);

  return {
    total_team_members: rankings.length,
    leaderboard: rankings,
  };
}
