import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { CopilotMessage, CopilotConversation, SuggestedPrompt, ActionProposal } from '../types/copilot';
import { useCRM } from './CRMContext';
import { useAuth } from './AuthContext';
import { processCopilotMessage } from '../services/copilotService';
import { ToolContext } from '../services/toolsRegistry';

interface CopilotContextType {
  isOpen: boolean;
  isExpanded: boolean;
  toggleOpen: () => void;
  setIsOpen: (open: boolean) => void;
  setIsExpanded: (expanded: boolean) => void;

  pageContext: string;
  setPageContext: (page: string) => void;
  selectedLeadId?: string;
  setSelectedLeadId: (leadId?: string) => void;

  conversations: CopilotConversation[];
  activeConversationId: string;
  messages: CopilotMessage[];
  isLoading: boolean;
  error?: string;

  suggestedPrompts: SuggestedPrompt[];
  sendMessage: (content: string) => Promise<void>;
  confirmAction: (proposal: ActionProposal) => Promise<void>;
  cancelAction: (proposal: ActionProposal) => void;
  clearConversation: () => void;
  createNewConversation: () => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  rateMessage: (messageId: string, rating: 1 | -1) => void;
  retryLastMessage: () => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

const INITIAL_CONVERSATION_ID = 'conv-default-001';

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { leads, deals, tasks, activities, notes, employees, createTask, updateLeadStatus, updateLead, assignLead } = useCRM();
  const { currentUser } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pageContext, setPageContext] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Conversations & Messages
  const [conversations, setConversations] = useState<CopilotConversation[]>(() => {
    const saved = localStorage.getItem('copilot_conversations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{
      id: INITIAL_CONVERSATION_ID,
      title: 'General CRM Assistant',
      pageContext: 'dashboard',
      lastMessageAt: new Date().toISOString(),
      messageCount: 1,
    }];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    return localStorage.getItem('copilot_active_conv_id') || INITIAL_CONVERSATION_ID;
  });

  const [messagesMap, setMessagesMap] = useState<Record<string, CopilotMessage[]>>(() => {
    const saved = localStorage.getItem('copilot_messages_map');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      [INITIAL_CONVERSATION_ID]: [
        {
          id: 'msg-welcome-001',
          conversationId: INITIAL_CONVERSATION_ID,
          role: 'assistant',
          content: "Good day. I'm your B2B AI Copilot — trained on your company data, team performance, pipeline, and operations.\n\nI can analyse your business in real-time, draft communications, flag risks, forecast revenue, and help you make faster decisions. What would you like to know?",
          timestamp: new Date().toISOString(),
        }
      ]
    };
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('copilot_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('copilot_messages_map', JSON.stringify(messagesMap));
  }, [messagesMap]);

  useEffect(() => {
    localStorage.setItem('copilot_active_conv_id', activeConversationId);
  }, [activeConversationId]);

  const messages = useMemo(() => {
    return messagesMap[activeConversationId] || [];
  }, [messagesMap, activeConversationId]);

  const toggleOpen = () => setIsOpen(prev => !prev);

  // Dynamic Suggested Prompts based on Context
  const suggestedPrompts = useMemo<SuggestedPrompt[]>(() => {
    if (pageContext === 'lead-details' || selectedLeadId) {
      const selectedLead = leads.find(l => l.id === selectedLeadId);
      const name = selectedLead?.name || 'this lead';
      return [
        { id: 'p1', label: `✨ Summarize ${name}`, prompt: `Summarize ${name}`, category: 'lead' },
        { id: 'p2', label: '✉️ Draft follow-up message', prompt: `Draft a follow-up message for ${name}`, category: 'action' },
        { id: 'p3', label: '📅 Create follow-up tomorrow', prompt: `Create a follow-up task for ${name} tomorrow at 10 AM`, category: 'action' },
        { id: 'p4', label: '🔄 Update status to Negotiation', prompt: `Update ${name}'s status to negotiation`, category: 'action' },
      ];
    }

    if (pageContext === 'leads') {
      return [
        { id: 'p1', label: '❄️ Leads not contacted for 7 days', prompt: "Show me leads that haven't been contacted for 7 days", category: 'lead' },
        { id: 'p2', label: '💎 Highest deal value leads', prompt: 'Which leads have the highest deal value?', category: 'analytics' },
        { id: 'p3', label: '🔥 Leads needing attention today', prompt: 'Which leads should I follow up with today?', category: 'lead' },
        { id: 'p4', label: '👤 Summarize B2B Infotech', prompt: 'Summarize B2B Infotech', category: 'lead' },
      ];
    }

    if (pageContext === 'deals') {
      return [
        { id: 'p1', label: '💰 Sales & Pipeline summary', prompt: 'Show sales summary and pipeline value', category: 'analytics' },
        { id: 'p2', label: '🎯 High probability opportunities', prompt: 'Which deals have highest closing probability?', category: 'analytics' },
        { id: 'p3', label: '📈 Conversion rate breakdown', prompt: 'What is our lead conversion rate by source?', category: 'analytics' },
      ];
    }

    if (pageContext === 'tasks') {
      return [
        { id: 'p1', label: '📅 Today\'s follow-ups', prompt: 'Show my pending follow-ups for today', category: 'task' },
        { id: 'p2', label: '🚨 Overdue follow-up tasks', prompt: 'Show me all overdue tasks', category: 'task' },
        { id: 'p3', label: '✍️ Schedule task for Ronald Martin', prompt: 'Create a follow-up task for Ronald Martin tomorrow at 10 AM', category: 'action' },
      ];
    }

    if (pageContext === 'employees') {
      return [
        { id: 'p1', label: '🏆 Best BDE conversion rate', prompt: 'Which BDE has the best conversion rate?', category: 'analytics' },
        { id: 'p2', label: '📊 Team leaderboard & quota', prompt: 'Show team performance and closed revenue', category: 'analytics' },
      ];
    }

    // Default Dashboard Prompts
    return [
      { id: 'p1', label: '✨ What should I focus on today?', prompt: 'What should I focus on today?', category: 'task' },
      { id: 'p2', label: '❄️ Stale leads (>7 days)', prompt: "Show me leads that haven't been contacted for 7 days", category: 'lead' },
      { id: 'p3', label: '📊 Sales & conversion summary', prompt: 'How many leads did we convert and what is our revenue?', category: 'analytics' },
      { id: 'p4', label: '🏆 Top BDE performance', prompt: 'Which BDE has the best conversion rate?', category: 'analytics' },
    ];
  }, [pageContext, selectedLeadId, leads]);

  // Keyboard shortcut (Ctrl+K or Ctrl+J or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(undefined);
    setIsLoading(true);

    const userMessageId = `msg-user-${Date.now()}`;
    const userMsg: CopilotMessage = {
      id: userMessageId,
      conversationId: activeConversationId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      pageContext,
      selectedLeadId,
    };

    // Append user message immediately
    setMessagesMap(prev => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), userMsg],
    }));

    try {
      const toolCtx: ToolContext = {
        leads,
        deals,
        tasks,
        activities,
        notes,
        employees,
        currentUserId: currentUser.id,
        selectedLeadId,
      };

      const existingMessages = messagesMap[activeConversationId] || [];
      const history = existingMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Process query with Copilot Service
      const response = await processCopilotMessage(content, toolCtx, pageContext, history);

      const assistantMsgId = `msg-asst-${Date.now()}`;
      const assistantMsg: CopilotMessage = {
        id: assistantMsgId,
        conversationId: activeConversationId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls,
        actionProposal: response.actionProposal,
        disambiguation: response.disambiguation,
        pageContext,
      };

      setMessagesMap(prev => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), assistantMsg],
      }));

      // Update conversation title if first message
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          const isFirstUserMsg = (messagesMap[activeConversationId] || []).length <= 1;
          const newTitle = isFirstUserMsg ? content.slice(0, 30) : c.title;
          return {
            ...c,
            title: newTitle,
            lastMessageAt: new Date().toISOString(),
            messageCount: (messagesMap[activeConversationId] || []).length + 2,
          };
        }
        return c;
      }));

    } catch (err: any) {
      setError(err.message || 'An error occurred while communicating with Copilot.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, activeConversationId, pageContext, selectedLeadId, leads, deals, tasks, activities, notes, employees, currentUser, messagesMap]);

  const confirmAction = useCallback(async (proposal: ActionProposal) => {
    try {
      if (proposal.toolName === 'create_task') {
        const { lead_id, lead_name, title, description, due_date, due_time, priority, task_type, assigned_to } = proposal.args;
        createTask({
          lead_id,
          lead_name,
          title,
          description: description || '',
          due_date,
          due_time,
          priority: priority || 'medium',
          task_type: task_type || 'follow_up',
          assigned_to: assigned_to || currentUser.id,
        });
      } else if (proposal.toolName === 'update_lead' || proposal.toolName === 'update_lead_status') {
        const { lead_id, status, deal_value } = proposal.args;
        if (status) updateLeadStatus(lead_id, status);
        if (deal_value) updateLead(lead_id, { deal_value });
      } else if (proposal.toolName === 'assign_lead') {
        const { lead_id, assigned_to } = proposal.args;
        assignLead(lead_id, assigned_to);
      }

      // Update message state with confirmed status
      setMessagesMap(prev => {
        const currentList = prev[activeConversationId] || [];
        return {
          ...prev,
          [activeConversationId]: currentList.map(msg => {
            if (msg.actionProposal?.id === proposal.id) {
              return {
                ...msg,
                actionProposal: {
                  ...msg.actionProposal,
                  status: 'executed',
                }
              };
            }
            return msg;
          })
        };
      });

      // Append success notification from Copilot
      const successMsg: CopilotMessage = {
        id: `msg-success-${Date.now()}`,
        conversationId: activeConversationId,
        role: 'assistant',
        content: `✅ **Action Confirmed & Executed Successfully!**\n\nThe changes have been committed directly to the CRM database.`,
        timestamp: new Date().toISOString(),
      };

      setMessagesMap(prev => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), successMsg],
      }));

    } catch (err: any) {
      setError(`Failed to execute action: ${err.message}`);
    }
  }, [activeConversationId, createTask, updateLeadStatus, updateLead, assignLead, currentUser]);

  const cancelAction = useCallback((proposal: ActionProposal) => {
    setMessagesMap(prev => {
      const currentList = prev[activeConversationId] || [];
      return {
        ...prev,
        [activeConversationId]: currentList.map(msg => {
          if (msg.actionProposal?.id === proposal.id) {
            return {
              ...msg,
              actionProposal: {
                ...msg.actionProposal,
                status: 'cancelled',
              }
            };
          }
          return msg;
        })
      };
    });
  }, [activeConversationId]);

  const clearConversation = useCallback(() => {
    setMessagesMap(prev => ({
      ...prev,
      [activeConversationId]: [
        {
          id: `msg-cleared-${Date.now()}`,
          conversationId: activeConversationId,
          role: 'assistant',
          content: `🧹 Conversation cleared. How can I assist you with your CRM records?`,
          timestamp: new Date().toISOString(),
        }
      ],
    }));
  }, [activeConversationId]);

  const createNewConversation = useCallback(() => {
    const newId = `conv-${Date.now()}`;
    const newConv: CopilotConversation = {
      id: newId,
      title: 'New Conversation',
      pageContext,
      lastMessageAt: new Date().toISOString(),
      messageCount: 1,
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessagesMap(prev => ({
      ...prev,
      [newId]: [
        {
          id: `msg-wel-${Date.now()}`,
          conversationId: newId,
          role: 'assistant',
          content: `👋 New conversation started. Ask me about leads, sales figures, follow-ups, or request an action.`,
          timestamp: new Date().toISOString(),
        }
      ]
    }));
  }, [pageContext]);

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    setMessagesMap(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeConversationId === id) {
      setActiveConversationId(INITIAL_CONVERSATION_ID);
    }
  }, [activeConversationId]);

  const rateMessage = useCallback((messageId: string, rating: 1 | -1) => {
    setMessagesMap(prev => {
      const currentList = prev[activeConversationId] || [];
      return {
        ...prev,
        [activeConversationId]: currentList.map(m => m.id === messageId ? { ...m, feedback: rating } : m)
      };
    });
  }, [activeConversationId]);

  const retryLastMessage = useCallback(() => {
    const currentList = messagesMap[activeConversationId] || [];
    const lastUserMsg = [...currentList].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  }, [messagesMap, activeConversationId, sendMessage]);

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        isExpanded,
        toggleOpen,
        setIsOpen,
        setIsExpanded,
        pageContext,
        setPageContext,
        selectedLeadId,
        setSelectedLeadId,
        conversations,
        activeConversationId,
        messages,
        isLoading,
        error,
        suggestedPrompts,
        sendMessage,
        confirmAction,
        cancelAction,
        clearConversation,
        createNewConversation,
        switchConversation,
        deleteConversation,
        rateMessage,
        retryLastMessage,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
};

export const useCopilot = () => {
  const context = useContext(CopilotContext);
  if (!context) throw new Error('useCopilot must be used within a CopilotProvider');
  return context;
};
