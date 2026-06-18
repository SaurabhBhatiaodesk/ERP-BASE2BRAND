import type React from "react";

// ─── Shared Data Constants ────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: number;
};

export const revenueData = [
  { month: "Jan", revenue: 4.2, salary: 2.8, profit: 1.4 },
  { month: "Feb", revenue: 5.1, salary: 2.9, profit: 2.2 },
  { month: "Mar", revenue: 4.8, salary: 3.0, profit: 1.8 },
  { month: "Apr", revenue: 6.3, salary: 3.1, profit: 3.2 },
  { month: "May", revenue: 7.1, salary: 3.2, profit: 3.9 },
  { month: "Jun", revenue: 6.8, salary: 3.3, profit: 3.5 },
  { month: "Jul", revenue: 8.4, salary: 3.4, profit: 5.0 },
];

export const deptData = [
  { dept: "Dev", score: 87 },
  { dept: "Design", score: 92 },
  { dept: "Marketing", score: 78 },
  { dept: "HR", score: 84 },
  { dept: "Sales", score: 95 },
];

export const productivityData = [
  { day: "Mon", score: 82 },
  { day: "Tue", score: 91 },
  { day: "Wed", score: 78 },
  { day: "Thu", score: 88 },
  { day: "Fri", score: 94 },
  { day: "Sat", score: 60 },
  { day: "Sun", score: 45 },
];

export const pieData = [
  { name: "Development", value: 35, color: "#6366f1" },
  { name: "Design", value: 22, color: "#8b5cf6" },
  { name: "Marketing", value: 20, color: "#06b6d4" },
  { name: "HR", value: 13, color: "#f59e0b" },
  { name: "Sales", value: 10, color: "#10b981" },
];

export const employees = [
  { name: "Arjun Mehta", role: "Lead Developer", dept: "Dev", score: 94, status: "active", avatar: "AM", trend: "up" },
  { name: "Priya Sharma", role: "UI/UX Designer", dept: "Design", score: 91, status: "active", avatar: "PS", trend: "up" },
  { name: "Rahul Gupta", role: "Marketing Head", dept: "Mktg", score: 76, status: "idle", avatar: "RG", trend: "down" },
  { name: "Sneha Patil", role: "HR Manager", dept: "HR", score: 88, status: "active", avatar: "SP", trend: "up" },
  { name: "Dev Patel", role: "Full Stack Dev", dept: "Dev", score: 83, status: "active", avatar: "DP", trend: "up" },
  { name: "Kavya Nair", role: "Sales Executive", dept: "Sales", score: 96, status: "active", avatar: "KN", trend: "up" },
];

export const leads = [
  { name: "TechCorp Solutions", value: "₹12.5L", stage: "Proposal", temp: "hot", contact: "Raj Kumar", days: 3 },
  { name: "Innovate Digital", value: "₹8.2L", stage: "Negotiation", temp: "hot", contact: "Anita Singh", days: 7 },
  { name: "StartupXYZ", value: "₹3.8L", stage: "Discovery", temp: "warm", contact: "Vikram Joshi", days: 14 },
  { name: "Enterprises Ltd", value: "₹22L", stage: "Qualification", temp: "warm", contact: "Meera Das", days: 21 },
  { name: "NewBiz Co", value: "₹5.5L", stage: "Awareness", temp: "cold", contact: "Suresh Kumar", days: 45 },
];

export const tasks = [
  { id: 1,  title: "Redesign client portal UI",          assignee: "Priya Sharma",  priority: "high",   status: "in-progress", due: "May 25", dueDay: 25, startDay: 20, project: "ClientHub v2",   est: "6h" },
  { id: 2,  title: "API integration for CRM module",     assignee: "Arjun Mehta",   priority: "urgent", status: "in-progress", due: "May 24", dueDay: 24, startDay: 21, project: "ERP Platform",   est: "8h" },
  { id: 3,  title: "Q2 campaign performance report",     assignee: "Rahul Gupta",   priority: "medium", status: "todo",        due: "May 28", dueDay: 28, startDay: 26, project: "Marketing Q2",   est: "3h" },
  { id: 4,  title: "Employee onboarding automation",     assignee: "Sneha Patil",   priority: "medium", status: "review",      due: "May 26", dueDay: 26, startDay: 22, project: "HR System",      est: "5h" },
  { id: 5,  title: "Fix payment gateway bug",            assignee: "Dev Patel",     priority: "urgent", status: "todo",        due: "May 23", dueDay: 23, startDay: 22, project: "ERP Platform",   est: "4h" },
  { id: 6,  title: "Lead scoring model v3",              assignee: "Kavya Nair",    priority: "high",   status: "done",        due: "May 22", dueDay: 22, startDay: 19, project: "CRM Pro",        est: "5h" },
  { id: 7,  title: "Sprint #14 retrospective doc",       assignee: "Arjun Mehta",   priority: "low",    status: "todo",        due: "May 30", dueDay: 30, startDay: 28, project: "ERP Platform",   est: "2h" },
  { id: 8,  title: "Social media content calendar",      assignee: "Rahul Gupta",   priority: "medium", status: "in-progress", due: "May 27", dueDay: 27, startDay: 24, project: "Marketing Q2",   est: "4h" },
  { id: 9,  title: "Payroll processing — May cycle",     assignee: "Sneha Patil",   priority: "high",   status: "review",      due: "May 29", dueDay: 29, startDay: 25, project: "HR System",      est: "3h" },
  { id: 10, title: "Figma component library audit",      assignee: "Priya Sharma",  priority: "low",    status: "done",        due: "May 21", dueDay: 21, startDay: 18, project: "ClientHub v2",   est: "6h" },
  { id: 11, title: "TechCorp proposal deck v2",          assignee: "Kavya Nair",    priority: "urgent", status: "in-progress", due: "May 23", dueDay: 23, startDay: 22, project: "CRM Pro",        est: "4h" },
  { id: 12, title: "Database query optimisation",        assignee: "Dev Patel",     priority: "high",   status: "done",        due: "May 21", dueDay: 21, startDay: 19, project: "ERP Platform",   est: "5h" },
];

export const aiInsights = [
  { type: "warning", title: "Team Overload Alert", desc: "Dev team has 140% workload this sprint. Risk of burnout — reassign 2 tasks.", action: "Review Tasks" },
  { type: "opportunity", title: "Revenue Opportunity", desc: "TechCorp proposal has been idle 3 days. A follow-up call could close ₹12.5L deal.", action: "Schedule Call" },
  { type: "insight", title: "Productivity Peak", desc: "Design team performs 31% better on Tues–Wed. Schedule reviews on those days.", action: "View Analytics" },
  { type: "hiring", title: "Hiring Suggestion", desc: "Marketing throughput dropped 18% this quarter. Consider hiring a content strategist.", action: "Open HR" },
];

export const activityFeed = [
  { user: "Arjun Mehta", action: "pushed 4 commits to", target: "feature/crm-api", time: "2m ago", avatar: "AM" },
  { user: "Kavya Nair", action: "closed deal with", target: "Innovate Digital — ₹8.2L", time: "14m ago", avatar: "KN" },
  { user: "Priya Sharma", action: "uploaded designs for", target: "ClientHub v2 Dashboard", time: "31m ago", avatar: "PS" },
  { user: "Sneha Patil", action: "approved leave for", target: "Dev Patel (3 days)", time: "45m ago", avatar: "DP" },
  { user: "System", action: "AI detected bottleneck in", target: "Sprint #14 pipeline", time: "1h ago", avatar: "AI" },
  { user: "Rahul Gupta", action: "launched campaign", target: "B2B LinkedIn Ads Q2", time: "2h ago", avatar: "RG" },
];

export const roles = [
  { id: "ceo", label: "CEO / Admin", desc: "Full platform access", color: "from-indigo-600 to-violet-600" },
  { id: "teamlead", label: "Team Leader", desc: "Team management & approvals", color: "from-indigo-500 to-blue-600" },
  { id: "employee", label: "Employee", desc: "Personal tasks & time tracking", color: "from-violet-600 to-purple-700" },
  { id: "developer", label: "Developer", desc: "Sprint, bugs & code metrics", color: "from-blue-600 to-cyan-600" },
  { id: "designer", label: "Designer", desc: "Projects, revisions & approvals", color: "from-pink-600 to-rose-600" },
  { id: "marketing", label: "Marketing", desc: "Campaigns, leads & ROI", color: "from-amber-500 to-orange-600" },
  { id: "hr", label: "HR Manager", desc: "People, payroll & hiring", color: "from-emerald-500 to-teal-600" },
];

export const employeeProfiles = [
  {
    id: "E001", name: "Kavya Nair", role: "Senior Designer", dept: "Design", email: "kavya@base2brand.com",
    phone: "+91 98765 43210", location: "Bangalore", joined: "Mar 2023", score: 97, status: "Active",
    salary: "₹85,000", manager: "Priya Sharma", skills: ["Figma", "Illustrator", "Prototyping", "Brand Design", "Motion"],
    bio: "Top-performing designer with expertise in brand identity and enterprise UI. Consistently delivers above expectations.",
    weeklyHours: [{ day: "Mon", h: 8.5 }, { day: "Tue", h: 9 }, { day: "Wed", h: 8 }, { day: "Thu", h: 7.5 }, { day: "Fri", h: 6 }],
    recentTasks: [
      { title: "ERP Dashboard UI", status: "Done", due: "May 24" },
      { title: "Brand Identity v3", status: "Done", due: "May 22" },
      { title: "Mobile App Screens", status: "In Progress", due: "May 27" },
      { title: "Social Media Kit", status: "To Do", due: "May 30" },
    ],
    attendance: 98, leaves: 1, projects: 8, revenue: "₹8.2L",
  },
  {
    id: "E002", name: "Arjun Mehta", role: "Lead Developer", dept: "Development", email: "arjun@base2brand.com",
    phone: "+91 97654 32109", location: "Mumbai", joined: "Jan 2022", score: 88, status: "Active",
    salary: "₹1,10,000", manager: "Priya Sharma", skills: ["React", "Node.js", "TypeScript", "AWS", "PostgreSQL"],
    bio: "Full-stack lead with deep expertise in scalable SaaS architecture. Drives technical decisions for the dev team.",
    weeklyHours: [{ day: "Mon", h: 9 }, { day: "Tue", h: 8.5 }, { day: "Wed", h: 9.5 }, { day: "Thu", h: 8 }, { day: "Fri", h: 7 }],
    recentTasks: [
      { title: "API Gateway Refactor", status: "In Progress", due: "May 26" },
      { title: "Payment Integration", status: "In Review", due: "May 25" },
      { title: "Auth Middleware", status: "Done", due: "May 20" },
      { title: "DB Migration v4", status: "To Do", due: "Jun 1" },
    ],
    attendance: 95, leaves: 2, projects: 5, revenue: "₹12.4L",
  },
  {
    id: "E003", name: "Priya Sharma", role: "Dev Lead", dept: "Development", email: "priya@base2brand.com",
    phone: "+91 96543 21098", location: "Hyderabad", joined: "Jun 2021", score: 94, status: "Active",
    salary: "₹1,25,000", manager: "CEO Admin", skills: ["System Design", "React", "Go", "DevOps", "Agile"],
    bio: "Senior engineering lead overseeing cross-functional delivery. Champion of clean architecture and team velocity.",
    weeklyHours: [{ day: "Mon", h: 8 }, { day: "Tue", h: 8 }, { day: "Wed", h: 9 }, { day: "Thu", h: 8.5 }, { day: "Fri", h: 7.5 }],
    recentTasks: [
      { title: "Q2 Sprint Planning", status: "Done", due: "May 18" },
      { title: "Tech Debt Audit", status: "In Progress", due: "May 28" },
      { title: "Team Hiring Review", status: "Done", due: "May 22" },
      { title: "Architecture RFC", status: "In Review", due: "May 30" },
    ],
    attendance: 97, leaves: 1, projects: 6, revenue: "₹11.1L",
  },
];

export const clientProfiles = [
  {
    id: "C001", company: "TechCorp Solutions", contact: "Rohit Verma", title: "CTO",
    email: "rohit@techcorp.io", phone: "+91 98001 12345", location: "Delhi NCR",
    value: "₹18.4L", stage: "Proposal Sent", temperature: "Hot",
    since: "Feb 2024", industry: "SaaS", employees: "200–500",
    notes: "Key enterprise prospect. Has evaluated 3 other vendors. Decision expected by end of May. Needs custom API integration.",
    meetings: [
      { date: "May 20", type: "Video Call", outcome: "Positive — demo approved", duration: "45 min" },
      { date: "May 12", type: "In-Person", outcome: "Requirements gathered", duration: "90 min" },
      { date: "Apr 28", type: "Discovery Call", outcome: "Shortlisted", duration: "30 min" },
    ],
    proposals: [
      { name: "ERP Pro Suite v2", value: "₹18.4L", status: "Sent", date: "May 18" },
      { name: "Initial Scoping", value: "₹4.2L", status: "Rejected", date: "Apr 30" },
    ],
    payments: [] as { invoice: string; amount: string; status: string; date: string }[],
    tags: ["Enterprise", "API Required", "High Priority"],
  },
  {
    id: "C002", company: "FinEdge Capital", contact: "Sneha Iyer", title: "VP Operations",
    email: "sneha@finedge.in", phone: "+91 97002 23456", location: "Mumbai",
    value: "₹9.6L", stage: "Negotiation", temperature: "Warm",
    since: "Jan 2024", industry: "Fintech", employees: "50–200",
    notes: "Long sales cycle. Budget approved but legal review pending. Strong champion internally.",
    meetings: [
      { date: "May 22", type: "Video Call", outcome: "Pricing discussion", duration: "60 min" },
      { date: "May 8", type: "Demo", outcome: "Impressed with analytics", duration: "75 min" },
    ],
    proposals: [
      { name: "CRM Starter + Analytics", value: "₹9.6L", status: "Under Review", date: "May 10" },
    ],
    payments: [
      { invoice: "INV-001", amount: "₹1.5L", status: "Paid", date: "Feb 14" },
    ],
    tags: ["Fintech", "Negotiation", "Legal Hold"],
  },
  {
    id: "C003", company: "GreenLeaf Organics", contact: "Aditya Patel", title: "Founder",
    email: "aditya@greenleaf.com", phone: "+91 96003 34567", location: "Ahmedabad",
    value: "₹3.8L", stage: "Closed Won", temperature: "Cold",
    since: "Nov 2023", industry: "D2C / E-commerce", employees: "10–50",
    notes: "Active client. Social media kit delivered. Looking to expand to full marketing suite next quarter.",
    meetings: [
      { date: "May 15", type: "Check-in", outcome: "Happy with delivery", duration: "20 min" },
    ],
    proposals: [
      { name: "Social Media + Branding", value: "₹3.8L", status: "Accepted", date: "Dec 5" },
    ],
    payments: [
      { invoice: "INV-004", amount: "₹1.9L", status: "Paid", date: "Dec 10" },
      { invoice: "INV-007", amount: "₹1.9L", status: "Paid", date: "Mar 1" },
    ],
    tags: ["D2C", "Active Client", "Upsell Opportunity"],
  },
];

export const projectsData = [
  {
    id: "P001", name: "TechCorp ERP Implementation", client: "TechCorp Solutions", lead: "Priya Sharma",
    dept: "Development", status: "In Progress", priority: "Critical", progress: 62,
    start: "May 1", end: "Jun 30", budget: "₹18.4L", spent: "₹9.2L",
    desc: "Full ERP rollout including modules for HR, Finance, CRM, and Operations. Custom API integration with TechCorp's existing billing system.",
    team: ["Priya Sharma", "Arjun Mehta", "Amit Kumar", "Kavya Nair"],
    tasks: [
      { title: "API Gateway setup", status: "Done", assignee: "Arjun Mehta", due: "May 15" },
      { title: "Auth & Roles module", status: "Done", assignee: "Amit Kumar", due: "May 18" },
      { title: "HR module backend", status: "In Progress", assignee: "Priya Sharma", due: "May 28" },
      { title: "Payment gateway integration", status: "In Progress", assignee: "Arjun Mehta", due: "May 30" },
      { title: "UI: Dashboard screens", status: "In Progress", assignee: "Kavya Nair", due: "Jun 5" },
      { title: "QA & load testing", status: "To Do", assignee: "Amit Kumar", due: "Jun 20" },
    ],
    timeline: [
      { phase: "Discovery & Planning", start: 0, width: 15, color: "bg-emerald-500" },
      { phase: "Backend Development", start: 15, width: 35, color: "bg-indigo-500" },
      { phase: "Frontend & UI", start: 35, width: 25, color: "bg-violet-500" },
      { phase: "QA & Testing", start: 60, width: 25, color: "bg-amber-500" },
      { phase: "Go Live", start: 85, width: 15, color: "bg-emerald-600" },
    ],
  },
  {
    id: "P002", name: "Brand Identity v3", client: "FinEdge Capital", lead: "Kavya Nair",
    dept: "Design", status: "Review", priority: "High", progress: 85,
    start: "Apr 20", end: "May 30", budget: "₹3.8L", spent: "₹3.1L",
    desc: "Complete brand refresh including logo, color palette, typography, and marketing collateral.",
    team: ["Kavya Nair"],
    tasks: [
      { title: "Logo concepts (3 directions)", status: "Done", assignee: "Kavya Nair", due: "Apr 28" },
      { title: "Color system & typography", status: "Done", assignee: "Kavya Nair", due: "May 5" },
      { title: "Brand guidelines PDF", status: "In Review", assignee: "Kavya Nair", due: "May 26" },
      { title: "Collateral templates", status: "To Do", assignee: "Kavya Nair", due: "May 30" },
    ],
    timeline: [
      { phase: "Research", start: 0, width: 20, color: "bg-emerald-500" },
      { phase: "Concepts", start: 20, width: 30, color: "bg-indigo-500" },
      { phase: "Refinement", start: 50, width: 30, color: "bg-violet-500" },
      { phase: "Delivery", start: 80, width: 20, color: "bg-amber-500" },
    ],
  },
];

export const invoicesData = [
  { id: "INV-012", client: "TechCorp Solutions", project: "ERP Implementation", amount: "₹4.6L", issued: "May 20", due: "Jun 5", status: "Unpaid", type: "Milestone" },
  { id: "INV-011", client: "FinEdge Capital", project: "CRM Starter", amount: "₹1.5L", issued: "May 15", due: "May 22", status: "Overdue", type: "Recurring" },
  { id: "INV-010", client: "GreenLeaf Organics", project: "Social Media Kit", amount: "₹95K", issued: "May 10", due: "May 17", status: "Paid", type: "Final" },
  { id: "INV-009", client: "TechCorp Solutions", project: "ERP Implementation", amount: "₹4.6L", issued: "Apr 20", due: "May 5", status: "Paid", type: "Milestone" },
  { id: "INV-008", client: "FinEdge Capital", project: "CRM Starter", amount: "₹1.5L", issued: "Apr 15", due: "Apr 22", status: "Paid", type: "Recurring" },
];

export const allNotifications = [
  { id: 1, color: "text-amber-400", bg: "bg-amber-500/10", title: "Dev team at 140% capacity", body: "Sprint #14 has 38 points assigned but team velocity is 27. 3 tasks at risk of slipping.", time: "5 min ago", read: false, category: "Alert" },
  { id: 2, color: "text-indigo-400", bg: "bg-indigo-500/10", title: "TechCorp deal idle for 3 days", body: "No activity on the ₹18.4L proposal since May 18. Recommended action: schedule a follow-up call.", time: "1 hour ago", read: false, category: "CRM" },
  { id: 3, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Kavya Nair closed ₹8.2L deal", body: "GreenLeaf Organics final milestone payment received. Project marked complete.", time: "2 hours ago", read: false, category: "Revenue" },
  { id: 4, color: "text-red-400", bg: "bg-red-500/10", title: "Sprint #14 has 3 blockers", body: "Payment gateway, auth middleware, and DB migration are blocking 6 downstream tasks.", time: "3 hours ago", read: true, category: "Tasks" },
  { id: 5, color: "text-violet-400", bg: "bg-violet-500/10", title: "Rahul Gupta late login — 4th time", body: "Employee started work at 11:48 AM today. Consider a 1:1 check-in.", time: "5 hours ago", read: true, category: "HR" },
  { id: 6, color: "text-indigo-400", bg: "bg-indigo-500/10", title: "AI Weekly Summary Ready", body: "Your weekly performance briefing for May 18–24 is ready. Revenue up 22%, avg productivity 86.4%.", time: "Yesterday", read: true, category: "AI" },
  { id: 7, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "INV-009 payment overdue", body: "FinEdge Capital invoice for ₹1.5L was due May 20. Send a reminder.", time: "Yesterday", read: true, category: "Revenue" },
  { id: 8, color: "text-blue-400", bg: "bg-blue-500/10", title: "New hire request approved", body: "DevOps Engineer role approved by CEO. Recruiter has been notified to begin sourcing.", time: "2 days ago", read: true, category: "HR" },
];

export const pastAnnouncements = [
  { id: 1, title: "Q1 Results — Record Revenue!", body: "Team Base2Brand hit ₹96L in Q1, our best quarter ever. Special performance bonuses will be processed this Friday. Thank you for your incredible work!", author: "CEO Admin", time: "May 22, 11:00 AM", audience: "All Staff", priority: "High", read: 34 },
  { id: 2, title: "New Leave Policy Effective June 1", body: "Please review the updated leave policy in the HR portal. Key change: carry-forward limit increased from 12 to 18 days.", author: "Sneha Reddy", time: "May 19, 2:30 PM", audience: "All Staff", priority: "Normal", read: 31 },
  { id: 3, title: "Dev Team — Sprint #15 Kickoff", body: "Sprint #15 starts May 27. Please complete your task estimates in the system by EOD Friday.", author: "Priya Sharma", time: "May 18, 9:00 AM", audience: "Development", priority: "Normal", read: 11 },
];
