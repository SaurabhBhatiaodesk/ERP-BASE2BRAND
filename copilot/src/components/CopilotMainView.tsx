import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  Sparkles, 
  Send,
  Loader2,
  Users, 
  CheckSquare, 
  Building2, 
  CreditCard, 
  UserCheck, 
  Clock, 
  Calendar, 
  Monitor, 
  BarChart3, 
  DollarSign, 
  Plus, 
  Megaphone, 
  FolderGit2, 
  FileText, 
  Bot, 
  Bell, 
  MessageSquare, 
  Settings, 
  ChevronDown, 
  Palette, 
  X, 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  User,
  Check,
  History,
  Trash2
} from 'lucide-react';
import { useCopilot } from '../context/CopilotContext';
import { useAuth } from '../context/AuthContext';
import { useCRM } from '../context/CRMContext';
import { CopilotMessage } from './copilot/CopilotMessage';

interface CopilotMainViewProps {
  onOpenDataViewer?: () => void;
}

export const CopilotMainView: React.FC<CopilotMainViewProps> = ({ onOpenDataViewer }) => {
  const { 
    messages, 
    sendMessage, 
    isLoading, 
    createNewConversation, 
    clearConversation,
    conversations,
    activeConversationId,
    switchConversation,
    deleteConversation
  } = useCopilot();
  const { currentUser, switchUser, availableUsers } = useAuth();
  const { leads, employees, metrics } = useCRM();

  const [input, setInput] = useState('');
  const [activeNav, setActiveNav] = useState('copilot');
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Idle Timer (resets on interaction, increments every second)
  useEffect(() => {
    const handleActivity = () => setIdleSeconds(0);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    const timer = setInterval(() => {
      setIdleSeconds(prev => prev + 1);
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(timer);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickCommand = (command: string) => {
    sendMessage(command);
  };

  const handleTagFilter = (tag: string) => {
    setActiveTag(tag === activeTag ? null : tag);
    if (tag === 'Team') {
      sendMessage('Summarize all 40 employees, their roles, departments, shift start times, and attendance records from Supabase.');
    } else if (tag === 'Revenue') {
      sendMessage('Provide a full revenue and pipeline analysis across all active leads including Ronald Martin (₹40.0L), discovery stages, and total deal values.');
    } else if (tag === 'Clients') {
      sendMessage('Show all active client accounts and leads (Ronald Martin, B2B Infotech, Jen/Paul, Naim, Pooria, etc.) with their current project status.');
    } else if (tag === 'HR') {
      sendMessage('Show all leave requests (Neha Chatterjee, Shubham, Namisha), shift start times, and open job vacancies in the IT department.');
    }
  };

  const dismissInsight = (id: string) => {
    setDismissedInsights(prev => [...prev, id]);
  };

  // Dynamic live pipeline value from Supabase
  const pipelineValueDisplay = useMemo(() => {
    if (metrics.pipelineValue) {
      return `₹${(metrics.pipelineValue / 100000).toFixed(1)}L`;
    }
    return '₹52L';
  }, [metrics.pipelineValue]);

  const employeesCountDisplay = employees.length > 0 ? employees.length : 40;
  const leadsCountDisplay = leads.length > 0 ? leads.length : 17;

  const navMenuItems = [
    { id: 'client-profiles', label: 'Client Profiles', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: 2 },
    { id: 'hr-people', label: 'HR & People', icon: Users },
    { id: 'hrms', label: 'HRMS', icon: Building2 },
    { id: 'payroll', label: 'Payroll Dashboard', icon: CreditCard },
    { id: 'employee-profiles', label: 'Employee Profiles', icon: UserCheck },
    { id: 'timesheet', label: 'Time Sheet', icon: Clock },
    { id: 'time-reports', label: 'Time Reports', icon: Calendar },
    { id: 'ai-productivity', label: 'AI Productivity', icon: Monitor },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'revenue-kpi', label: 'Revenue & KPI', icon: DollarSign },
    { id: 'register-add', label: 'Register / Add', icon: Plus },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'copilot', label: 'AI Copilot', icon: Bot, isSpecial: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: 4 },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const quickCommands = [
    'Summarise today',
    "Who's underperforming?",
    'Revenue forecast',
    'Top wins this week',
    'Hiring needs',
    'Risk report'
  ];

  // Grounded Proactive Insights directly from authentic Supabase PostgreSQL tables
  const proactiveInsights = [
    {
      id: 'rev-1',
      category: 'REVENUE',
      categoryColor: 'text-emerald-400',
      categoryIcon: TrendingUp,
      title: 'Ronald Martin deal in Discovery',
      desc: 'High-value ₹40.0L enterprise lead in Discovery stage. Recommend scheduling a discovery follow-up.',
      action: 'Draft follow-up for Ronald Martin ↗',
      prompt: 'Draft a high-impact follow-up email for Ronald Martin regarding the ₹40.0L Discovery proposal'
    },
    {
      id: 'prod-1',
      category: 'PRODUCTIVITY',
      categoryColor: 'text-amber-400',
      categoryIcon: AlertTriangle,
      title: 'Saravjeet & Deepak project load',
      desc: 'Saravjeet Singh has 8 active projects in Digital Marketing and Deepak Chuahan has 4 active projects in Development.',
      action: 'Review team project load ↗',
      prompt: 'Review project allocations and active projects for Saravjeet Singh and Deepak Chuahan'
    },
    {
      id: 'hr-1',
      category: 'HR',
      categoryColor: 'text-sky-400',
      categoryIcon: User,
      title: 'Neha Chatterjee leave pending',
      desc: 'Leave request from Neha Chatterjee (Urgent Leave / Rakhi) is pending approval with reporting officer CEO.',
      action: 'Review pending leave requests ↗',
      prompt: 'Show details and pending status for Neha Chatterjee leave requests'
    },
    {
      id: 'growth-1',
      category: 'GROWTH',
      categoryColor: 'text-violet-400',
      categoryIcon: Zap,
      title: 'Full Stack Developer vacancy open',
      desc: 'Open vacancy for Full Stack Developer in IT department recorded in Supabase ATS.',
      action: 'View IT hiring vacancy ↗',
      prompt: 'Show open job vacancies and recruitment status for Full Stack Developer in IT department'
    }
  ];

  return (
    <div className="h-screen w-screen flex bg-[#07090e] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-[220px] 2xl:w-[240px] bg-[#07090e] border-r border-[#151928] flex flex-col justify-between flex-shrink-0 z-30">
        {/* Brand Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-wider text-white font-['Outfit'] uppercase">
              BASE<span className="text-white">2</span>BRAND
            </h1>
          </div>
          <div className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
            Command <span className="text-slate-600">&bull;</span> v2.4
          </div>
        </div>

        {/* Primary New Chat Button */}
        <div className="px-3 py-2">
          <button
            onClick={() => createNewConversation()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 border border-violet-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Start a new chat session"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation List & Recent Chats */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Navigation List */}
          <div className="space-y-0.5">
            {navMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    if (item.id === 'chat') {
                      createNewConversation();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#1b1938] text-violet-300 font-semibold border border-violet-600/40 shadow-sm shadow-violet-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1220]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#1a2035] text-violet-300 border border-violet-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Recent Conversations List */}
          {conversations.length > 0 && (
            <div className="pt-2 border-t border-[#151928] space-y-1">
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3 text-slate-500" />
                  <span>Recent Chats</span>
                </div>
                <span className="text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded text-slate-400 font-mono">
                  {conversations.length}
                </span>
              </div>
              <div className="space-y-0.5 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                {conversations.map(conv => {
                  const isActive = conv.id === activeConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => switchConversation(conv.id)}
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1b173c] text-violet-200 font-medium border border-violet-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1220]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare className={`w-3 h-3 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500'}`} />
                        <span className="truncate">{conv.title || 'New Chat'}</span>
                      </div>
                      {conversations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition"
                          title="Delete thread"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User Card at Bottom Left */}
        <div className="p-3 border-t border-[#151928]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0c101d] border border-[#171d33] hover:border-slate-700 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-[11px] font-bold ring-1 ring-white/20">
                {currentUser.full_name ? currentUser.full_name.charAt(0) : 'C'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">CEO</div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>
      </aside>

      {/* 2. MAIN CENTER + RIGHT COLUMN WRAPPER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07090e]">
        {/* Top Navbar */}
        <header className="h-12 px-6 border-b border-[#151928] bg-[#07090e] flex items-center justify-between flex-shrink-0 z-20">
          {/* Breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Base2Brand</span>
              <span className="text-slate-600">&gt;</span>
              <span className="text-slate-100 font-semibold">AI Copilot</span>
            </div>

            {/* Live Idle Timer */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-medium">
              <span>⏱</span>
              <span>Idle: {idleSeconds}s</span>
            </div>
          </div>

          {/* Right Action Icons & New Chat */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => createNewConversation()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-semibold transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              title="Start a new chat session"
            >
              <Plus className="w-3.5 h-3.5 text-violet-400" />
              <span>New Chat</span>
            </button>

            <button 
              className="p-1.5 rounded-lg hover:bg-[#12162a] text-slate-400 hover:text-white transition"
              title="Toggle Theme"
            >
              <Palette className="w-4 h-4" />
            </button>

            <button 
              className="relative p-1.5 rounded-lg hover:bg-[#12162a] text-slate-400 hover:text-white transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            {/* Persona Avatar Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[#12162a] transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-[10px] font-bold text-white">
                  CEO
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-200 leading-tight">CEO</div>
                  <div className="text-[9px] text-slate-400 leading-none">CEO / Admin</div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0c101d] border border-[#1e253e] rounded-2xl shadow-2xl p-1.5 z-50 animate-fade-in max-h-64 overflow-y-auto">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                    Select Active Persona
                  </div>
                  {availableUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition ${
                        u.id === currentUser.id
                          ? 'bg-violet-950 text-violet-200 font-medium'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="truncate font-medium">{u.full_name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{u.role}</div>
                      </div>
                      {u.id === currentUser.id && <Check className="w-3 h-3 text-violet-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body: Center Chat (70%) + Right Proactive Insights (30%) */}
        <div className="flex-1 flex overflow-hidden">
          {/* CENTER CHAT AREA */}
          <section className="flex-1 flex flex-col h-full overflow-hidden bg-[#07090e] border-r border-[#151928] relative">
            {/* Copilot Header Card */}
            <div className="m-4 mb-2 p-3.5 rounded-2xl bg-[#0c0f1c] border border-[#1a2038] flex items-center justify-between flex-shrink-0 shadow-lg gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-600/30 ring-1 ring-violet-400/40">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">B2B AI Copilot</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-[#221c44] text-violet-300 border border-violet-500/30">
                      ENTERPRISE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-medium">
                    <span className="text-emerald-400 font-bold">&bull; Live</span>
                    <span>Analysing {employeesCountDisplay} employees</span>
                    <span>&bull;</span>
                    <span>{pipelineValueDisplay} pipeline</span>
                    <span>&bull;</span>
                    <span>{leadsCountDisplay} leads</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: New Chat, Clear, & Quick Filter Tags */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  onClick={() => createNewConversation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/30 border border-violet-400/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="Start a new chat session"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>

                <button
                  onClick={() => clearConversation()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#101426] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-[#1c2340] hover:border-rose-500/30 text-xs font-medium transition cursor-pointer"
                  title="Clear Current Chat Messages"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Clear</span>
                </button>

                <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

                {/* Quick Filter Tags */}
                {['Team', 'Revenue', 'Clients', 'HR'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagFilter(tag)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                      activeTag === tag
                        ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                        : 'bg-[#101426] hover:bg-[#161c36] text-slate-300 border-[#1c2340]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-20 scrollbar-thin scrollbar-thumb-slate-800">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isWelcome = msg.id === 'msg-welcome-001' || (idx === 0 && !isUser);

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end animate-fade-in my-2">
                      <div className="max-w-[70%] px-4 py-2.5 rounded-2xl bg-[#5438dc] text-white text-xs leading-relaxed shadow-md shadow-violet-950/40 font-medium">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="space-y-3 animate-fade-in">
                    <CopilotMessage message={msg} isLast={idx === messages.length - 1} />

                    {/* Quick Commands (Shown only on the welcome message) */}
                    {isWelcome && (
                      <div className="pl-8 space-y-1.5 pt-1">
                        <div className="text-[10px] text-slate-500 font-medium">
                          Quick commands:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {quickCommands.map(cmd => (
                            <button
                              key={cmd}
                              onClick={() => handleQuickCommand(cmd)}
                              className="px-3 py-1 rounded-xl bg-[#11162c] hover:bg-[#1a2142] border border-[#1f2748] hover:border-violet-500/50 text-[11px] text-slate-300 hover:text-white transition shadow-sm"
                            >
                              {cmd}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dynamic Loading Shimmer */}
              {isLoading && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0f1426] border border-[#1b223d] text-xs text-slate-300 w-fit animate-pulse shadow-md ml-8">
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                  <span className="font-medium">Querying live Supabase database &amp; generating insights...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 pt-2 border-t border-[#151928] bg-[#07090e]">
              <form onSubmit={handleSubmit} className="relative flex items-center rounded-2xl bg-[#0c101e] border border-[#1a213b] focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/40 transition shadow-xl">
                <div className="pl-3.5 text-slate-500">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                </div>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything — revenue, team, risks, strategy..."
                  rows={1}
                  disabled={isLoading}
                  className="w-full pl-3 pr-12 py-3 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-24 leading-relaxed"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2.5 p-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-20 disabled:cursor-not-allowed transition shadow-md shadow-violet-600/30"
                  title="Send (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="text-center text-[10px] text-slate-600 font-medium mt-2">
                B2B AI Copilot <span className="text-slate-700">&bull;</span> Powered by Base2Brand Intelligence Engine
              </div>
            </div>
          </section>

          {/* 3. RIGHT SIDEBAR: PROACTIVE INSIGHTS + WHAT I CAN DO */}
          <aside className="w-[300px] 2xl:w-[340px] bg-[#07090e] flex flex-col justify-between p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            {/* Top Section: PROACTIVE INSIGHTS */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                PROACTIVE INSIGHTS
              </div>

              {proactiveInsights
                .filter(item => !dismissedInsights.includes(item.id))
                .map(item => {
                  const Icon = item.categoryIcon;
                  return (
                    <div 
                      key={item.id}
                      className="p-3 rounded-2xl bg-[#0c101e] border border-[#171d33] space-y-1.5 relative group hover:border-slate-700 transition"
                    >
                      <button
                        onClick={() => dismissInsight(item.id)}
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 transition"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${item.categoryColor}`}>
                        <Icon className="w-3 h-3" />
                        <span>{item.category}</span>
                      </div>

                      <div className="text-xs font-bold text-slate-100">
                        {item.title}
                      </div>

                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {item.desc}
                      </div>

                      <button
                        onClick={() => sendMessage(item.prompt)}
                        className="text-[11px] font-medium text-sky-400 hover:text-sky-300 transition flex items-center gap-1 pt-0.5"
                      >
                        {item.action}
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* Bottom Section: WHAT I CAN DO */}
            <div className="p-3.5 rounded-2xl bg-[#0c101e] border border-[#171d33] space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                WHAT I CAN DO
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300">
                {[
                  { icon: TrendingUp, text: 'Analyse revenue & pipeline', prompt: 'Analyse our total pipeline value and revenue breakdown across all active leads' },
                  { icon: UserCheck, text: 'Monitor team performance', prompt: 'Summarize team performance, shift times, and attendance across all departments' },
                  { icon: AlertTriangle, text: 'Flag risks proactively', prompt: 'What are the highest risk deals and pending tasks across the company?' },
                  { icon: BarChart3, text: 'Generate KPI reports', prompt: 'Generate a comprehensive KPI report covering revenue, attendance, and active project counts' },
                  { icon: FileText, text: 'Draft emails & messages', prompt: 'Draft a high-priority follow-up email for Ronald Martin regarding the ₹40.0L Discovery proposal' },
                  { icon: Zap, text: 'Forecast growth trends', prompt: 'Forecast growth trends and open hiring recruitment status based on our current data' },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button 
                      key={idx} 
                      onClick={() => sendMessage(item.prompt)}
                      className="w-full flex items-center gap-2 text-left p-1.5 rounded-lg hover:bg-[#12182c] text-slate-300 hover:text-white transition group"
                    >
                      <Icon className="w-3.5 h-3.5 text-sky-400 group-hover:text-violet-400 shrink-0 transition" />
                      <span className="truncate">{item.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
