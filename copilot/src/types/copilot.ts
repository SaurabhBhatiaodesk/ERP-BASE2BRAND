export interface ToolCall {
  id: string;
  name: string;
  args?: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  result?: any;
}

export interface ActionProposal {
  id: string;
  toolName: string;
  entityType: 'lead' | 'deal' | 'task' | 'activity' | 'employee';
  entityId: string;
  entityName: string;
  title: string;
  summary: string;
  args: Record<string, any>;
  status: 'pending_confirmation' | 'executed' | 'cancelled';
}

export interface DisambiguationOption {
  id: string;
  name: string;
  role?: string;
  department?: string;
  type: 'employee' | 'lead' | 'project';
  details?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  attendance?: number;
}

export interface DisambiguationCard {
  query: string;
  matchedToken?: string;
  title?: string;
  entityType: 'employee' | 'lead' | 'project';
  options: DisambiguationOption[];
}

export interface CopilotMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  actionProposal?: ActionProposal;
  disambiguation?: DisambiguationCard;
  pageContext?: string;
  selectedLeadId?: string;
  feedback?: 1 | -1;
}

export interface CopilotConversation {
  id: string;
  title: string;
  pageContext: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface SuggestedPrompt {
  id: string;
  label: string;
  prompt: string;
  category: 'lead' | 'task' | 'analytics' | 'action' | 'hr';
}
