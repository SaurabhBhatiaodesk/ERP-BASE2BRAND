/**
 * Real AI Copilot logic — ported from the standalone `copilot/` project's
 * `src/services/openaiService.ts` (kept unmodified there per the user's
 * request; this is a faithful port, not a rework). Calls OpenAI directly
 * from the client with `VITE_OPENAI_API_KEY`, same as the original — the
 * user explicitly chose to keep it this way rather than proxy it through a
 * server-side function.
 */
import { supabase } from "./supabase";

const OPENAI_API_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || "";

export interface ChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AICopilotResult {
  content: string;
}

// Core operational tables the copilot reads for live context — same set the
// standalone project uses.
const CORE_TABLES = [
  "employee_profiles",
  "leads",
  "projects",
  "leave_requests",
  "clock_sessions",
  "project_tasks",
  "ats_vacancies",
  "activity_logs",
  "employee_payroll_monthly",
  "call_schedule",
] as const;

interface FullDatabaseContext {
  tablesData: Record<string, any[]>;
  tablesQueried: string[];
  leads: any[];
  employees: any[];
}

function cleanRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (
      key.includes("screenshot") ||
      key.includes("base64") ||
      key.includes("image_data") ||
      key.includes("token") ||
      key.includes("password")
    ) {
      continue;
    }
    if (val === null || val === undefined || val === "") continue;
    if (typeof val === "string" && val.length > 300) {
      cleaned[key] = val.slice(0, 300) + "...";
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

let cachedDbContext: FullDatabaseContext | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 45_000;

async function fetchLiveDatabaseContext(forceRefresh = false): Promise<FullDatabaseContext> {
  const now = Date.now();
  if (!forceRefresh && cachedDbContext && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedDbContext;
  }

  const tablesData: Record<string, any[]> = {};
  const tablesQueried: string[] = [];

  await Promise.all(
    CORE_TABLES.map(async tableName => {
      try {
        const { data, error } = await supabase.from(tableName).select("*").limit(60);
        if (!error && data && data.length > 0) {
          tablesData[tableName] = data.map(cleanRow);
          tablesQueried.push(`${tableName} (${data.length})`);
        } else {
          tablesData[tableName] = [];
        }
      } catch {
        tablesData[tableName] = [];
      }
    })
  );

  cachedDbContext = {
    tablesData,
    tablesQueried,
    leads: tablesData["leads"] || [],
    employees: tablesData["employee_profiles"] || [],
  };
  cacheTimestamp = now;
  return cachedDbContext;
}

/** Ambiguous-name detector — surfaced as an informative text list rather than an interactive picker. */
function checkDisambiguation(userQuery: string, employees: any[], leads: any[]): string | null {
  let queryLower = userQuery.toLowerCase().trim();
  for (const prefix of ["is", "about", "who", "tell", "for", "with", "show", "summarize"]) {
    const re = new RegExp(`\\b${prefix}([a-z]{3,})`, "g");
    queryLower = queryLower.replace(re, `${prefix} $1`);
  }

  const stopWords = new Set([
    "who", "is", "the", "tell", "me", "about", "what", "give", "show", "summarize",
    "profile", "attendance", "details", "of", "for", "a", "an", "please", "yesterday",
    "today", "tomorrow", "leave", "leaves", "shift", "department", "team", "status",
    "pipeline", "deals", "tasks", "metrics", "conversion", "revenue", "info", "check",
    "present", "absent",
  ]);

  const cleanTokens = queryLower
    .replace(/[?!,.:;]/g, "")
    .split(/\s+/)
    .filter(t => !stopWords.has(t));

  for (const token of cleanTokens) {
    if (token.length < 3) continue;

    const empMatches = employees.filter(e => {
      const nameParts = (e.name || "").toLowerCase().split(/\s+/);
      return nameParts.some((part: string) => part === token) || (e.name || "").toLowerCase().startsWith(token);
    });
    const exactEmpMatch = empMatches.find(e => queryLower.includes((e.name || "").toLowerCase()));
    if (!exactEmpMatch && empMatches.length > 1) {
      const formattedToken = token.charAt(0).toUpperCase() + token.slice(1);
      return `I found ${empMatches.length} team members matching "${formattedToken}":\n\n${empMatches
        .map((e: any) => `- ${e.name} (${e.role || "Team Member"}, ${e.dept || "General"})`)
        .join("\n")}\n\nCould you give me a bit more detail (e.g. their full name or department) so I can answer precisely?`;
    }

    const leadMatches = leads.filter(l => {
      const nameParts = (l.name || "").toLowerCase().split(/\s+/);
      return nameParts.some((part: string) => part === token) || (l.name || "").toLowerCase().startsWith(token);
    });
    const exactLeadMatch = leadMatches.find(l => queryLower.includes((l.name || "").toLowerCase()));
    if (!exactLeadMatch && leadMatches.length > 1) {
      const formattedToken = token.charAt(0).toUpperCase() + token.slice(1);
      return `I found ${leadMatches.length} leads matching "${formattedToken}":\n\n${leadMatches
        .map((l: any) => `- ${l.name} (${l.stage || "Discovery"}, ${l.value || "₹0"})`)
        .join("\n")}\n\nCould you give me a bit more detail so I can answer precisely?`;
    }
  }

  return null;
}

export async function askOpenAICopilot(
  userQuery: string,
  history?: ChatHistoryMessage[]
): Promise<AICopilotResult> {
  if (!OPENAI_API_KEY) {
    return { content: "AI Copilot isn't configured — VITE_OPENAI_API_KEY is missing from .env." };
  }

  const dbContext = await fetchLiveDatabaseContext();

  const disambiguationText = checkDisambiguation(userQuery, dbContext.employees, dbContext.leads);
  if (disambiguationText) {
    return { content: disambiguationText };
  }

  const liveDataSnapshot: Record<string, any> = {};
  if (dbContext.tablesData["employee_profiles"]?.length > 0) liveDataSnapshot.employee_profiles = dbContext.tablesData["employee_profiles"];
  if (dbContext.tablesData["leave_requests"]?.length > 0) liveDataSnapshot.leave_requests = dbContext.tablesData["leave_requests"];
  if (dbContext.tablesData["leads"]?.length > 0) liveDataSnapshot.leads = dbContext.tablesData["leads"];
  if (dbContext.tablesData["projects"]?.length > 0) liveDataSnapshot.projects = dbContext.tablesData["projects"];
  if (dbContext.tablesData["project_tasks"]?.length > 0) liveDataSnapshot.project_tasks = dbContext.tablesData["project_tasks"].slice(0, 30);
  if (dbContext.tablesData["clock_sessions"]?.length > 0) liveDataSnapshot.clock_sessions = dbContext.tablesData["clock_sessions"].slice(0, 20);
  if (dbContext.tablesData["ats_vacancies"]?.length > 0) liveDataSnapshot.ats_vacancies = dbContext.tablesData["ats_vacancies"];
  if (dbContext.tablesData["activity_logs"]?.length > 0) liveDataSnapshot.activity_logs = dbContext.tablesData["activity_logs"].slice(0, 15);
  if (dbContext.tablesData["employee_payroll_monthly"]?.length > 0) liveDataSnapshot.employee_payroll_monthly = dbContext.tablesData["employee_payroll_monthly"].slice(0, 20);

  const compactSnapshotStr = JSON.stringify(liveDataSnapshot);

  // Kept deliberately plain-text-leaning: this renders inside a real chat
  // bubble, not a document viewer, so heavy Markdown (headers, dense bold,
  // tables) reads as clutter even once rendered correctly.
  const systemPrompt = `You are the enterprise CRM & ERP AI Copilot with real-time access to the company's live Supabase PostgreSQL database.
All records provided below are genuine company records. NEVER invent fake data.

### SUPABASE DATABASE SNAPSHOT:
${compactSnapshotStr}

### RESPONSE STYLE — this is a live chat, not a report:
1. Answer using ONLY the authentic Supabase records above.
2. Write like a person replying in chat — short, plain sentences by default.
3. Keep formatting minimal and earn it:
   - Do NOT use headers (#, ##, ###) unless the answer genuinely has several distinct sections. Never use a header for a one- or two-line answer.
   - Bold only the one or two figures that actually matter (e.g. **1 employee absent**). Most sentences should have no bold at all.
   - Use a bullet list only when actually listing 3+ items.
   - Skip filler sections like a "Conclusion" heading — just say the answer.
   - Use a Markdown table only when comparing several people/records side by side.
4. Attendance & shift questions: cross-reference \`employee_profiles\`, \`clock_sessions\`, and \`leave_requests\` and answer directly.
5. Team dossier questions: give role, department, shift timing, attendance %, salary, and active projects as prose, not a bulleted spec sheet, unless a full profile is explicitly asked for.`;

  const openAiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (history && history.length > 0) {
    const recent = history.slice(-6);
    for (const msg of recent) {
      if (msg.content && msg.role !== "system") {
        openAiMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content.length > 800 ? msg.content.slice(0, 800) + "..." : msg.content,
        });
      }
    }
  }

  const lastMsg = openAiMessages[openAiMessages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== userQuery) {
    openAiMessages.push({ role: "user", content: userQuery });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openAiMessages,
        temperature: 0.25,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `OpenAI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const replyContent = data.choices?.[0]?.message?.content || "No response generated.";
    return { content: replyContent };
  } catch (err: any) {
    console.error("OpenAI Copilot error:", err);
    return { content: `Connection error: ${err.message || "Unable to connect to AI engine"}. Please check your connection or try again.` };
  }
}
