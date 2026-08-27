import { askOpenAICopilot, ChatHistoryMessage } from './openaiService';
import { ToolContext } from './toolsRegistry';
import { ActionProposal, ToolCall, DisambiguationCard } from '../types/copilot';

export interface CopilotResponse {
  content: string;
  toolCalls: ToolCall[];
  actionProposal?: ActionProposal;
  disambiguation?: DisambiguationCard;
}

export async function processCopilotMessage(
  userQuery: string,
  ctx: ToolContext,
  pageContext: string,
  history: ChatHistoryMessage[] = []
): Promise<CopilotResponse> {
  const queryLower = userQuery.toLowerCase().trim();

  // 1. Prompt Injection & Security Guardrails
  if (
    queryLower.includes('ignore previous') ||
    queryLower.includes('drop table') ||
    queryLower.includes('service_role') ||
    queryLower.includes('database credentials')
  ) {
    return {
      content: `🔒 **Security Guardrail Triggered**\n\nI cannot execute commands that attempt to override security boundaries or expose internal service keys. I only query verified CRM and ERP data.`,
      toolCalls: [],
    };
  }

  // 2. Call OpenAI Live Engine with Grounded Supabase DB Context, Tool Context, and Chat History
  return await askOpenAICopilot(userQuery, pageContext, ctx, history);
}
