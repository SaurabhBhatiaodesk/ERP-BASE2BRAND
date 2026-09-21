// Same pattern as the main ERP's copilot (src/lib/copilotAi.ts there): a direct
// client-side call to OpenAI, grounded by stuffing a JSON snapshot of live data
// into the system prompt — no server-side proxy, no real function-calling, kept
// simple and consistent with the main ERP's own explicit choice for this key.
//
// Unlike the main ERP's copilot (internal staff, sees the whole company), every
// snapshot built here is already scoped to a single client's own organization —
// never fetch or include another client's data.
import type { AiManagerContext, ChangeRequest, KnowledgeArticle, Project, BillingData } from "./database";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const MODEL = "gpt-4o-mini";

export type CopilotMessage = { role: "user" | "assistant"; content: string };

/** The only OpenAI I/O in this module — both pages below just build a system prompt and call this. */
export async function askCopilot(systemPrompt: string, history: CopilotMessage[], userMessage: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("AI assistant isn't configured — missing VITE_OPENAI_API_KEY.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.25,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-6),
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI assistant request failed (${res.status}). ${errText}`.trim());
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content as string | undefined;
  if (!reply) throw new Error("The AI assistant didn't return a response.");
  return reply;
}

const RESPONSE_STYLE = `### RESPONSE STYLE
Keep answers concise and conversational, like a knowledgeable teammate, not a report generator. Use **bold** for key facts, numbers, and dates. Only use bullet points for lists of 3 or more items. Never fabricate a date, amount, name, or fact that isn't in the data below — if something isn't covered, say so plainly and suggest the client ask their Base2Brand account team.`;

/** Knowledge Base assistant: grounded in this client's own documents, meeting notes, project, and billing — nothing else. */
export function buildKnowledgeBaseSystemPrompt(opts: {
  organizationName: string;
  project: Project | null;
  changeRequests: ChangeRequest[];
  articles: KnowledgeArticle[];
  billing: BillingData;
}): string {
  const snapshot = {
    project: opts.project ? {
      name: opts.project.name,
      category: opts.project.category,
      status: opts.project.status,
      progressPct: opts.project.progressPct,
      startDate: opts.project.startDate,
      launchDate: opts.project.launchDate,
      description: opts.project.description,
    } : null,
    changeRequests: opts.changeRequests.map(cr => ({ title: cr.title, status: cr.status, priority: cr.priority, due: cr.dueLabel })),
    documentsAndMeetingNotes: opts.articles.map(a => ({
      title: a.title,
      category: a.category,
      date: a.dateLabel,
      // Only meeting notes have real text content synced today — documents are metadata-only (no file text extraction yet).
      meetingSummary: a.content,
    })),
    contract: opts.billing.contract,
    invoices: opts.billing.invoices.map(i => ({ number: i.invoiceNumber, description: i.description, amount: i.amount, status: i.status, due: i.dueDateLabel })),
  };

  return `You are the Base2Brand Client Portal's Knowledge Base Assistant for ${opts.organizationName}. You have real-time access to this client's own project data below — never invent facts, and never reference or imply knowledge of any other client's data.

### CLIENT DATA SNAPSHOT
${JSON.stringify(snapshot)}

${RESPONSE_STYLE}`;
}

/** AI Project Manager assistant: grounded in fetchAiManagerContext's snapshot (already built for the stat cards). */
export function buildAiManagerSystemPrompt(personName: string | undefined, ctx: AiManagerContext): string {
  const snapshot = {
    project: ctx.project ? {
      name: ctx.project.name,
      status: ctx.project.status,
      progressPct: ctx.project.progressPct,
      healthScore: ctx.project.healthScore,
      budgetTotal: ctx.project.budgetTotal,
      budgetUsed: ctx.project.budgetUsed,
      launchDate: ctx.project.launchDate,
      startDate: ctx.project.startDate,
    } : null,
    projectManagerName: ctx.projectManagerName,
    aiExecutiveSummary: ctx.aiSummary,
    pendingDeliverablesCount: ctx.pendingDeliverablesCount,
    blockedTasksCount: ctx.blockedTasksCount,
    openSupportTicketsCount: ctx.openTicketsCount,
    changeRequests: ctx.changeRequests.map(cr => ({ title: cr.title, status: cr.status, priority: cr.priority, progressPct: cr.progressPct, due: cr.dueLabel })),
    recentActivity: ctx.recentActivity.map(a => ({ text: a.text, when: a.timeLabel, by: a.user })),
  };

  return `You are ${personName ? `${personName}'s` : "the client's"} AI Project Manager at Base2Brand${ctx.project ? `, for the project "${ctx.project.name}"` : ""}. You have real-time access to the live project data below — never invent facts. Be direct, proactive, and specific with the real numbers and dates provided.

### PROJECT DATA SNAPSHOT
${JSON.stringify(snapshot)}

${RESPONSE_STYLE}`;
}
