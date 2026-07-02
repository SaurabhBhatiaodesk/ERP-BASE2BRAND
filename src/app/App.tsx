import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { resolveLoginUser, saveAppSession, clearAppSession, isAdminRole, isShiftTrackerRole } from "@/lib/auth";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import logo from "@/imports/image.png";
import {
  LayoutDashboard, Users, Briefcase, BarChart3, MessageSquare,
  CheckSquare, Bell, Search, ChevronDown, Zap, Brain,
  AlertTriangle, ArrowUpRight, Clock, Star, GitBranch,
  DollarSign, UserCheck, Plus, X, Send, Activity,
  Globe, Hash, ChevronRight, Building2, Award, Layers,
  Timer, Monitor, ChevronLeft, Settings, TrendingUp, LogOut, User, Calendar
} from "lucide-react";

// Imported views
import { CEODashboard } from "./components/views/DashboardView";
import { CRMView, TasksView } from "./components/views/CRMTasksViews";
import { HRView, AnalyticsView, ChatView, TimesheetViewRoot, EmployeeMonthlyTimesheetView } from "./components/views/HRAnalyticsChatViews";
import { ShiftView } from "./components/views/ShiftView";
import { TeamLeaderDashboard, EmployeeDashboard, DevDashboard, DesignDashboard, MarketingDashboard, RevenueKPIView, HRMSView, LeavesView } from "./components/views/RoleDashboards";
import { AuthScreen, roleColorMap, roleLabelMap } from "./components/AuthScreen";
import { EmployeeProfilePage, ClientDetailPage, ProductivityTimelineView, RegistrationFormsView } from "./components/views/ProfileViews";
import { RecruitmentView } from "./components/views/RecruitmentView";
import { TimesheetView } from "./components/views/TimesheetView";
import { ProjectsView } from "./components/views/ProjectsView";
import { ProjectWorkspaceView } from "./components/views/ProjectWorkspaceView";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { Toaster } from "./components/ui/sonner";
import { findProfileForUser, isPersonalTaskRole } from "@/lib/database";
import { useEmployeeProfiles } from "@/hooks/useSupabaseData";
import { Avatar } from "./components/ui";
import { useChatUnreadCounts } from "@/hooks/useChat";
import { SettingsPage, NotificationsCenterView, BroadcastView, ProjectDetailPage, InvoiceView } from "./components/views/SettingsViews";
import { AICopilotView } from "./components/views/AICopilotView";
import { useElectronIdleTracker, IDLE_THRESHOLD_SECS } from "@/hooks/useElectronIdleTracker";
import { useEmployeeScreenshotCapture } from "@/hooks/useEmployeeScreenshotCapture";
import { useNotifications } from "@/hooks/useNotifications";
import { playBeep } from "@/lib/audio";
import { FloatingQuickActions } from "./components/FloatingQuickActions";

type RoleId = "ceo" | "teamlead" | "employee" | "developer" | "designer" | "marketing" | "hr";

type NavItem = {
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  badge?: number;
};

const roleNavMap: Record<RoleId, NavItem[]> = {
  ceo: [
    { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
    { id: "shifts", label: "Shift Tracker", icon: Timer, badge: 1 },
    { id: "crm", label: "CRM", icon: Briefcase, badge: 6 },
    { id: "clientdetail", label: "Client Profiles", icon: Building2 },
    { id: "tasks", label: "Tasks", icon: CheckSquare, badge: 2 },
    { id: "hr", label: "HR & People", icon: Users },
    { id: "hrms", label: "HRMS", icon: Award },
    { id: "profiles", label: "Employee Profiles", icon: UserCheck },
    { id: "timesheet", label: "Time Sheet", icon: Clock },
    { id: "timereports", label: "Time Reports", icon: Calendar },
    { id: "productivity", label: "AI Productivity", icon: Monitor },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "revenue", label: "Revenue & KPI", icon: DollarSign },
    { id: "register", label: "Register / Add", icon: Plus },
    { id: "broadcast", label: "Broadcast", icon: Send },
    { id: "projects", label: "Projects", icon: Layers },
    { id: "invoices", label: "Invoices", icon: DollarSign },
    { id: "copilot", label: "AI Copilot", icon: Brain },
    { id: "notifications", label: "Notifications", icon: Bell, badge: 4 },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: 4 },
    { id: "settings", label: "Settings", icon: Settings },
  ],
  teamlead: [
    { id: "employee", label: "Dashboard", icon: LayoutDashboard },
    { id: "leaves", label: "Apply Leave", icon: CheckSquare },
    { id: "projects", label: "Projects", icon: Layers },
    { id: "tasks", label: "Tasks", icon: CheckSquare, badge: 2 },
    { id: "shifts", label: "Shift Tracker", icon: Timer },
    { id: "register", label: "Register / Add", icon: Plus },
    { id: "timesheet", label: "Time Sheet", icon: Clock },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: 4 },
  ],
  employee: [
    { id: "employee", label: "Dashboard", icon: LayoutDashboard },
    { id: "leaves", label: "Apply Leave", icon: CheckSquare },
    { id: "projects", label: "Projects & Work", icon: Layers },
    { id: "timesheet", label: "Time Reports", icon: Clock },
    { id: "chat", label: "Chat", icon: MessageSquare, badge: 2 },
  ],
  developer: [
    { id: "employee", label: "Dashboard", icon: LayoutDashboard },
    { id: "leaves", label: "Apply Leave", icon: CheckSquare },
    { id: "projects", label: "Projects & Work", icon: Layers },
    { id: "timesheet", label: "Time Reports", icon: Clock },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ],
  designer: [
    { id: "employee", label: "Dashboard", icon: LayoutDashboard },
    { id: "leaves", label: "Apply Leave", icon: CheckSquare },
    { id: "designer", label: "Design Hub", icon: Star },
    { id: "projects", label: "Projects & Work", icon: Layers },
    { id: "timesheet", label: "Time Reports", icon: Clock },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ],
  marketing: [
    { id: "employee", label: "Dashboard", icon: LayoutDashboard },
    { id: "leaves", label: "Apply Leave", icon: CheckSquare },
    { id: "marketing", label: "Marketing Hub", icon: TrendingUp },
    { id: "crm", label: "CRM", icon: Briefcase, badge: 3 },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ],
  hr: [
    { id: "employee", label: "My Dashboard", icon: LayoutDashboard },
    { id: "hr", label: "HR Overview", icon: Users },
    { id: "recruitment", label: "Recruitment", icon: Briefcase },
    { id: "timesheet", label: "Time Sheet", icon: Clock },
    { id: "hrms", label: "HRMS", icon: Award },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ],
};

const bottomNav: NavItem[] = [];

const viewTitles: Record<string, string> = {
  dashboard: "Command Center", shifts: "Shift Tracker", crm: "CRM",
  tasks: "Tasks", hr: "HR & People", analytics: "Analytics",
  chat: "Chat", teamlead: "My Team", employee: "My Dashboard",
  developer: "Dev Hub", designer: "Design Hub", marketing: "Marketing Hub",
  revenue: "Revenue & KPI", hrms: "HRMS",
  profiles: "Employee Profiles", clientdetail: "Client Profiles",
  timesheet: "Time Sheet", timereports: "Time Reports", productivity: "AI Productivity", register: "Register & Add",
  projects: "Projects & Work", leaves: "Apply Leave",
  settings: "Settings", notifications: "Notifications",
  broadcast: "Broadcast", projectworkspace: "Project", projectdetail: "Project Details", invoices: "Invoices & Billing",
  copilot: "AI Copilot",
};

type ChatMessage = { role: "ai" | "user"; text: string };

const aiMessages: ChatMessage[] = [
  { role: "ai", text: "Good afternoon! Here's your daily intelligence briefing for Base2Brand." },
  { role: "ai", text: "📊 Today's highlights: Revenue is up 22% MoM. 4 employees showing overload risk. TechCorp deal has been idle 3 days — recommend a follow-up call." },
  { role: "ai", text: "⚠️ Rahul Gupta has started work late for 4 consecutive days. Recommend a 1:1 check-in." },
  { role: "ai", text: "🌟 Kavya Nair is your top performer this month — 97% productivity, closed ₹8.2L. Consider a recognition shoutout." },
];

function AIAssistantPanel({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(aiMessages);
  const [typing, setTyping] = useState(false);

  const quickPrompts = [
    "Who is underperforming this week?",
    "Summarise today's productivity",
    "Which projects are at risk?",
    "Show hiring recommendations",
  ];

  function send(text: string) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const responses: Record<string, string> = {
        "Who is underperforming this week?": "📉 This week, Rahul Gupta (Marketing) scored 71% productivity — 15 points below team average. He has also had 4 late logins and 22+ minutes of idle time today. Recommend a check-in.",
        "Summarise today's productivity": "📊 Team average: 86.4%. Top: Kavya (97%), Priya (94%). Watch: Rahul (71%), Dev (79%). 4 tasks overdue. Shift heatmap shows Dev team at 140% sprint capacity.",
        "Which projects are at risk?": "🔴 ERP Platform — 2 urgent tasks overdue (API integration, payment bug). CRM Pro — TechCorp proposal idle 3 days. Marketing Q2 — report not started, due May 28.",
        "Show hiring recommendations": "👥 Based on throughput analysis: (1) Content Strategist for Marketing — team output dropped 18% QoQ. (2) Junior Developer — Dev team consistently at 120%+ sprint load.",
      };
      const reply = responses[text] || "I've analysed the data. Based on current patterns, I recommend prioritising the ERP Platform deliverables and following up on the TechCorp deal. Want a detailed report?";
      setMessages(prev => [...prev, { role: "ai", text: reply }]);
      setTyping(false);
    }, 1200);
  }

  return (
    <div className="fixed right-6 bottom-24 z-50 w-96 bg-[#0d1326] border border-[rgba(99,102,241,0.25)] rounded-2xl shadow-2xl shadow-indigo-900/30 flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(99,102,241,0.12)] bg-gradient-to-r from-indigo-600/10 to-violet-600/10 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0">
          <Brain size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">B2B AI Assistant</p>
          <p className="text-[10px] font-['Geist_Mono'] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" /> Online · Analysing live data
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors text-[#6b7fa8] hover:text-white">
          <X size={15} />
        </button>
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-3 border-b border-[rgba(99,102,241,0.08)] shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map(q => (
            <button key={q} onClick={() => send(q)}
              className="text-[10px] font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full hover:bg-indigo-500/20 transition-colors text-left">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "ai" && (
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <Brain size={11} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2.5 rounded-xl text-xs leading-relaxed font-['Plus_Jakarta_Sans'] ${m.role === "ai" ? "bg-[#131a35] text-[#e2e8f7]" : "bg-indigo-600 text-white"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full flex items-center justify-center shrink-0">
              <Brain size={11} className="text-white" />
            </div>
            <div className="bg-[#131a35] px-3 py-2.5 rounded-xl flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[rgba(99,102,241,0.1)] shrink-0">
        <div className="flex items-center gap-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-2.5 focus-within:border-indigo-500/40 transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send(input)}
            placeholder="Ask anything about your team..."
            className="flex-1 bg-transparent text-xs text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none font-['Plus_Jakarta_Sans']"
          />
          <button onClick={() => send(input)} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-white shrink-0">
            <Send size={11} />
          </button>
        </div>
        <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-2 text-center">Powered by Base2Brand AI Engine</p>
      </div>
    </div>
  );
}

const NAV_STATE_KEY = "b2b_nav_state";

type SavedNavState = {
  view: string;
  projectId: string | null;
};

const SUB_VIEWS = new Set([
  "projectworkspace",
  "projectdetail",
  "clientdetail",
  "productivity",
]);

function defaultViewForRole(role: string) {
  const defaults: Record<string, string> = {
    ceo: "dashboard",
    teamlead: "employee",
    employee: "employee",
    developer: "employee",
    designer: "employee",
    marketing: "employee",
    hr: "hr",
  };
  return defaults[role] || "dashboard";
}

function applyUserSession(role: string, name: string) {
  return {
    role: role as RoleId,
    name,
    view: defaultViewForRole(role),
  };
}

function isViewAllowedForRole(view: string, role: RoleId) {
  const nav = roleNavMap[role] ?? roleNavMap.ceo;
  if (nav.some(item => item.id === view)) return true;
  return SUB_VIEWS.has(view);
}

function loadNavState(): SavedNavState | null {
  try {
    const raw = sessionStorage.getItem(NAV_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedNavState;
    if (!parsed?.view) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveNavState(state: SavedNavState) {
  sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
}

function clearNavState() {
  sessionStorage.removeItem(NAV_STATE_KEY);
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<RoleId>("ceo");
  const [userName, setUserName] = useState("CEO Admin");
  const [userEmail, setUserEmail] = useState("");
  
  const [activeView, setActiveView] = useState("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [registerTab, setRegisterTab] = useState<"employee" | "client" | "project" | "assign">("employee");
  const [taskNav, setTaskNav] = useState<{ taskId?: string; status?: string; projectId?: string } | null>(null);
  const [chatNav, setChatNav] = useState<{ channelId?: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [timesheetNav, setTimesheetNav] = useState<{ projectId?: string; tab?: "office" | "project" } | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const navRestoredRef = useRef(false);

  const [notificationPermission, setNotificationPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationAccess = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted" && currentProfile?.id) {
         import("@/lib/firebase").then(({ requestFirebaseToken }) => {
            requestFirebaseToken(currentProfile.id, "BFsN6ecy2D12X0vjN6zIt8BtV50Q4uGhmk9Dd3mZElGvXzRqxP5ROx1ZK5adB_YYbTU57H_h7CijF4QXF9hxKyk").catch(console.error);
         });
      }
    }
  };

  const { data: profiles, refresh: refreshProfiles } = useEmployeeProfiles();
  const currentProfile = useMemo(
    () => findProfileForUser(profiles, userName, userEmail),
    [profiles, userName, userEmail]
  );
  
  const handleNotificationClick = (n: any) => {
    if (n.type === "chat_message") {
      setChatNav({ channelId: n.reference_id });
      setActiveView("chat");
    } else if (n.type === "project_assigned") {
      setActiveView("projects");
    }
  };

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(currentProfile?.id, handleNotificationClick);
  const idleSeconds = useElectronIdleTracker(userEmail, currentProfile);
  useEmployeeScreenshotCapture(
    userName,
    currentProfile,
    isLoggedIn && isPersonalTaskRole(userRole),
  );

  const { data: chatUnread } = useChatUnreadCounts(currentProfile?.id ?? "");
  const chatUnreadTotal = useMemo(
    () => Object.values(chatUnread).reduce((sum, n) => sum + n, 0),
    [chatUnread]
  );

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    let cancelled = false;

    async function checkAndBeep() {
      if (idleSeconds > IDLE_THRESHOLD_SECS && userRole !== "ceo" && userRole !== "hr" && currentProfile) {
        const { fetchActiveClockSession } = await import("@/lib/database");
        const session = await fetchActiveClockSession(currentProfile.name, currentProfile.id);
        if (cancelled) return;
        
        if (session && session.status === "active") {
          playBeep();
          id = setInterval(async () => {
            const s = await fetchActiveClockSession(currentProfile.name, currentProfile.id);
            if (s && s.status === "active" && !cancelled) {
              playBeep();
            } else if (!s || s.status !== "active") {
              clearInterval(id);
            }
          }, 30000);
        }
      }
    }

    checkAndBeep();
    checkAndBeep();
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [idleSeconds > IDLE_THRESHOLD_SECS, userRole, currentProfile]);

  // Global Realtime Listener for Desktop Notifications
  useEffect(() => {
    if (!currentProfile?.id || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const channel = supabase
      .channel("desktop-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentProfile.id}`
        },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif) {
            new Notification(newNotif.title || "Base2Brand ERP", {
              body: newNotif.message || "You have a new notification",
              icon: "/assets/icon.png", // Attempt to load app icon if available
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProfile?.id]);

  const navItems = useMemo(() => {
    const base = roleNavMap[userRole] ?? roleNavMap.ceo;
    return base.map(item =>
      item.id === "chat"
        ? { ...item, badge: chatUnreadTotal > 0 ? chatUnreadTotal : undefined }
        : item
    );
  }, [userRole, chatUnreadTotal]);

  useEffect(() => {
    let cancelled = false;

    async function syncAuthUser(user: import("@supabase/supabase-js").User) {
      const { role, name } = await resolveLoginUser(user, { syncMetadata: false });
      if (cancelled) return null;
      saveAppSession(role, name);
      const sessionData = applyUserSession(role, name);
      setUserRole(sessionData.role);
      setUserName(sessionData.name);
      setUserEmail(user.email || "");
      setIsLoggedIn(true);
      return sessionData.role;
    }

    function restoreNavOnce(role: RoleId) {
      if (navRestoredRef.current) return;
      navRestoredRef.current = true;
      const saved = loadNavState();
      const roleHubView: Partial<Record<RoleId, string>> = {
        developer: "developer",
        designer: "designer",
        marketing: "marketing",
      };
      let view = saved?.view;
      if (view && view === roleHubView[role]) {
        view = "employee";
      }
      if (view && isViewAllowedForRole(view, role)) {
        setActiveView(view);
        setSelectedProjectId(saved?.projectId ?? null);
      } else {
        setActiveView(defaultViewForRole(role));
        setSelectedProjectId(null);
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session?.user) {
          const role = await syncAuthUser(session.user);
          if (role) restoreNavOnce(role);
        }
      } catch (err) {
        console.error("Failed to sync auth session:", err);
        // Session exists but sync failed (likely network issue), let them retry or handle gracefully
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncAuthUser(session.user);
        // Token refresh on tab focus must not reset the current page.
      } else if (event === "SIGNED_OUT") {
        clearAppSession();
        clearNavState();
        navRestoredRef.current = false;
        setIsLoggedIn(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    saveNavState({ view: activeView, projectId: selectedProjectId });
  }, [activeView, selectedProjectId, isLoggedIn]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) {
        setShowSidebarMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setShowHeaderMenu(false);
    setShowSidebarMenu(false);
    await supabase.auth.signOut();
    clearAppSession();
    clearNavState();
    navRestoredRef.current = false;
    setIsLoggedIn(false);
  }

  function handleLogin(role: string, name: string) {
    saveAppSession(role, name);
    const sessionData = applyUserSession(role, name);
    setUserRole(sessionData.role);
    setUserName(sessionData.name);
    setActiveView(sessionData.view);
    setSelectedProjectId(null);
    saveNavState({ view: sessionData.view, projectId: null });
    navRestoredRef.current = true;
    setIsLoggedIn(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#06091a] flex items-center justify-center">
        <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Connecting to Supabase...</p>
      </div>
    );
  }

  if (!isLoggedIn) return <AuthScreen onLogin={handleLogin} />;

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <CEODashboard />;
      case "shifts":
        if (!isShiftTrackerRole(userRole)) {
          return (
            <div className="p-8 text-center text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
              Shift Tracker is only available for CEO and Team Lead roles.
            </div>
          );
        }
        return <ShiftView userRole={userRole} userName={userName} />;
      case "crm": return <CRMView />;
      case "tasks":
        if (isPersonalTaskRole(userRole)) {
          const hubProjectId = taskNav?.projectId || selectedProjectId;
          if (hubProjectId) {
            return (
              <ProjectWorkspaceView
                projectId={hubProjectId}
                userRole={userRole}
                userName={userName}
                initialTool="tasks"
                onBack={() => {
                  setTaskNav(null);
                  setActiveView("projects");
                }}
                onOpenFullTimesheet={() => {
                  setTimesheetNav({ projectId: hubProjectId, tab: "project" });
                  setActiveView("timesheet");
                }}
              />
            );
          }
          return (
            <ProjectsView
              userRole={userRole}
              userName={userName}
              userEmail={userEmail}
              onOpenProject={projectId => {
                setSelectedProjectId(projectId);
                setTaskNav(null);
                setActiveView("projectworkspace");
              }}
              onNavigate={(view, tab) => {
                if (tab) setRegisterTab(tab as any);
                setActiveView(view);
              }}
            />
          );
        }
        return (
          <TasksView
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
            initialTaskId={taskNav?.taskId}
            initialStatus={taskNav?.status as "todo" | "in-progress" | "ready-for-testing" | "review" | "done" | undefined}
            initialProjectId={taskNav?.projectId}
            onNavConsumed={() => setTaskNav(null)}
          />
        );
      case "hr": return (
        <HRView
          onNavigate={(view, tabOrOptions) => {
            if (typeof tabOrOptions === "string") setRegisterTab(tabOrOptions as any);
            else if (typeof tabOrOptions === "object") setTaskNav(tabOrOptions);
            setActiveView(view);
          }}
        />
      );
      case "timesheet": 
        return (
          <TimesheetView 
            userRole={userRole}
            userName={userName}
          />
        );
      case "timereports":
        return (
          <TimesheetViewRoot
            onNavigate={(view, options) => {
              if (options) setTaskNav(options);
              setActiveView(view);
            }}
          />
        );
      case "employee-timesheet": return (
        <EmployeeMonthlyTimesheetView 
          employeeName={taskNav?.employeeName}
          onBack={() => setActiveView("timesheet")}
        />
      );
      case "analytics": return <AnalyticsView />;
      case "chat": return (
        <ChatView 
          userName={userName} 
          userEmail={userEmail} 
          userRole={userRole} 
          initialChannelId={chatNav?.channelId}
          onNavConsumed={() => setChatNav(null)}
        />
      );
      case "teamlead": return <TeamLeaderDashboard />;
      case "employee": return (
        <EmployeeDashboard
          userName={userName}
          userEmail={userEmail}
          onNavigate={(view, options) => {
            if (options?.projectId) {
              setSelectedProjectId(options.projectId);
              setActiveView("projectworkspace");
              return;
            }
            setActiveView(view);
          }}
        />
      );
      case "leaves": return <LeavesView userName={userName} userEmail={userEmail} />;
      case "developer": return (
        <DevDashboard
          userName={userName}
          userEmail={userEmail}
          onNavigate={(view, options) => {
            if (options?.projectId) {
              setSelectedProjectId(options.projectId);
              setTaskNav(options);
              setActiveView("projectworkspace");
              return;
            }
            if (options) setTaskNav(options);
            else setTaskNav(null);
            if (view === "tasks" && isPersonalTaskRole(userRole)) {
              setActiveView("projects");
              return;
            }
            setActiveView(view);
          }}
        />
      );
      case "designer": return <DesignDashboard />;
      case "marketing": return <MarketingDashboard />;
      case "recruitment": return <RecruitmentView />;
      case "revenue": return <RevenueKPIView />;
      case "hrms": return <HRMSView />;
      case "profiles": return (
        <EmployeeProfilePage
          userName={userName}
          userRole={userRole}
          initialProfileId={taskNav?.profileId}
          onProfileUpdated={refreshProfiles}
          onBack={() => setActiveView(isAdminRole(userRole) ? "hr" : "employee")}
          onNavigate={(view, tab) => {
            if (tab) setRegisterTab(tab);
            setActiveView(view);
          }}
        />
      );
      case "clientdetail": return (
        <ClientDetailPage
          onBack={() => setActiveView("crm")}
          onNavigate={(view, tab) => {
            if (tab) setRegisterTab(tab);
            setActiveView(view);
          }}
        />
      );

      case "productivity": return <ProductivityTimelineView />;
      case "register": return <RegistrationFormsView initialTab={registerTab} />;
      case "settings": return <SettingsPage />;
      case "notifications": return (
        <NotificationsCenterView 
          notifications={notifications}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          onNotificationClick={(n) => {
            if (n.type === "chat_message") setActiveView("chat");
            else if (n.type === "project_assigned") setActiveView("projects");
          }}
        />
      );
      case "broadcast": return <BroadcastView />;
      case "projects": return (
        <ProjectsView
          userRole={userRole}
          userName={userName}
          userEmail={userEmail}
          onOpenProject={projectId => {
            setSelectedProjectId(projectId);
            setActiveView("projectworkspace");
          }}
          onNavigate={(view, tab) => {
            if (tab) setRegisterTab(tab as any);
            setActiveView(view);
          }}
        />
      );
      case "projectworkspace": return selectedProjectId ? (
        <ProjectWorkspaceView
          projectId={selectedProjectId}
          userRole={userRole}
          userName={userName}
          onBack={() => {
            setSelectedProjectId(null);
            setActiveView("projects");
          }}
          onOpenFullTimesheet={() => {
            setTimesheetNav({ projectId: selectedProjectId, tab: "project" });
            setActiveView("timesheet");
          }}
        />
      ) : (
        <ProjectsView
          userRole={userRole}
          userName={userName}
          userEmail={userEmail}
          onOpenProject={projectId => {
            setSelectedProjectId(projectId);
            setActiveView("projectworkspace");
          }}
          onNavigate={(view, tab) => {
            if (tab) setRegisterTab(tab as any);
            setActiveView(view);
          }}
        />
      );
      case "projectdetail": return (
        <ProjectDetailPage
          onBack={() => setActiveView("projects")}
          onNavigate={(view, tab) => {
            if (tab) setRegisterTab(tab);
            setActiveView(view);
          }}
        />
      );
      case "invoices": return <InvoiceView />;
      case "copilot": return <AICopilotView />;
      default: return <CEODashboard />;
    }
  };

  const roleColor = roleColorMap[userRole] ?? "from-indigo-600 to-violet-600";
  const roleLabel = roleLabelMap[userRole] ?? userRole;
  const initials = (currentProfile?.name || userName).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const profilePhoto = currentProfile?.profileImageUrl || "";
  const avatarColor = `bg-gradient-to-br ${roleColor}`;

  return (
    <div className="flex h-screen bg-[#06091a] overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      {idleSeconds > IDLE_THRESHOLD_SECS && userRole !== "ceo" && userRole !== "hr" && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-4 bg-[#1e0f15] border border-red-500/40 text-red-200 px-5 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(239,68,68,0.4)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-sm font-['Plus_Jakarta_Sans']">You are Not at Desk!</div>
            <div className="text-[11px] text-red-300/80 font-['Geist_Mono'] mt-0.5">Please resume activity to clock back in.</div>
          </div>
        </div>
      )}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-[220px] bg-[#080c1f] border-r border-[rgba(99,102,241,0.1)] flex flex-col shrink-0 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[rgba(99,102,241,0.08)]">
          <ImageWithFallback src={logo} alt="Base2Brand Infotech" className="h-8 w-auto object-contain" />
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-1.5">Command · v2.4</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-widest px-3 py-2 mt-1">Navigation</p>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${activeView === item.id
                ? "bg-indigo-600/15 text-white border border-indigo-500/20"
                : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"}`}>
              <item.icon size={15} className={activeView === item.id ? "text-indigo-400" : ""} />
              <span className="font-['Plus_Jakarta_Sans'] text-[13px]">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-['Geist_Mono'] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-[rgba(99,102,241,0.08)] space-y-0.5">
          {bottomNav.map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03] transition-colors">
              <item.icon size={15} />
              <span className="font-['Plus_Jakarta_Sans'] text-[13px]">{item.label}</span>
            </button>
          ))}
          <div className="relative mt-2" ref={sidebarMenuRef}>
            <button
              onClick={() => setShowSidebarMenu(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[#131a35] rounded-lg hover:bg-[#1a2440] transition-colors cursor-pointer group"
            >
              <Avatar initials={initials} src={profilePhoto || undefined} size="sm" color={avatarColor} />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold text-white truncate font-['Plus_Jakarta_Sans']">{userName}</p>
                <p className="text-[10px] font-['Geist_Mono'] text-emerald-400">● Online</p>
              </div>
              <ChevronDown size={12} className={`text-[#6b7fa8] shrink-0 transition-transform ${showSidebarMenu ? "rotate-180" : ""}`} />
            </button>
            {showSidebarMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-[rgba(99,102,241,0.1)]">
                  <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{userName}</p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{roleLabel}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} />
                  <span className="font-['Plus_Jakarta_Sans']">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="relative z-50 h-14 bg-[#080c1f]/80 backdrop-blur-sm border-b border-[rgba(99,102,241,0.1)] flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)} className="lg:hidden p-2 hover:bg-white/[0.04] rounded-lg text-[#6b7fa8] hover:text-white transition-colors">
              {sidebarOpen ? <X size={18} /> : <Hash size={18} />}
            </button>
            <div className="flex items-center gap-2 text-[#6b7fa8] text-sm">
              <span className="font-['Plus_Jakarta_Sans'] hidden sm:block">Base2Brand</span>
              <ChevronRight size={13} className="hidden sm:block" />
              <span className="text-white font-['Plus_Jakarta_Sans']">{viewTitles[activeView] ?? activeView}</span>
            </div>
            {/* DEBUG IDLE TRACKER WIDGET */}
            <div className={`ml-4 px-2.5 py-1 rounded-md text-xs font-['Geist_Mono'] flex items-center gap-2 ${idleSeconds > 5 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
               <Clock size={12} />
               <span>Idle: {idleSeconds}s</span>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3">

            <ThemeSwitcher />

            <div className="relative">
              <button onClick={() => { if (activeView === "notifications") setShowNotifications(!showNotifications); else { setActiveView("notifications"); setShowNotifications(false); } }}
                className="relative p-2 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0d1326]" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 w-72 lg:w-80 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                  <div className="p-4 border-b border-[rgba(99,102,241,0.1)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded-full font-['Geist_Mono']">{unreadCount} new</span>
                      )}
                    </div>
                    <button onClick={() => setShowNotifications(false)}><X size={14} className="text-[#6b7fa8]" /></button>
                  </div>
                  <div className="divide-y divide-[rgba(99,102,241,0.06)] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const Icon = n.type === "project_assigned" ? Layers : (n.type === "chat_message" ? MessageSquare : Bell);
                        return (
                          <div 
                            key={n.id} 
                            onClick={() => { 
                              if (!n.is_read) markAsRead(n.id); 
                              handleNotificationClick(n);
                              setShowNotifications(false);
                            }}
                            className={`flex items-start gap-3 p-4 transition-colors cursor-pointer ${n.is_read ? "opacity-60 hover:bg-white/[0.02]" : "bg-white/[0.02] hover:bg-white/[0.04]"}`}
                          >
                            <div className={`mt-0.5 relative ${n.is_read ? 'text-[#6b7fa8]' : 'text-indigo-400'}`}>
                              <Icon size={14} />
                              {!n.is_read && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${n.is_read ? 'text-[#a8b5d1]' : 'text-[#e2e8f7] font-medium'} leading-snug`}>{n.message}</p>
                              <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] mt-1">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative border-l border-[rgba(99,102,241,0.1)] pl-2 lg:pl-3" ref={headerMenuRef}>
              <button
                onClick={() => setShowHeaderMenu(v => !v)}
                className="flex items-center gap-2 hover:bg-white/[0.04] rounded-lg px-1.5 py-1 transition-colors"
              >
                <Avatar initials={initials} src={profilePhoto || undefined} size="sm" color={avatarColor} />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{userName}</p>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{roleLabel}</p>
                </div>
                <ChevronDown size={12} className={`hidden lg:block text-[#6b7fa8] transition-transform ${showHeaderMenu ? "rotate-180" : ""}`} />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 top-10 w-48 bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[rgba(99,102,241,0.1)]">
                    <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{userName}</p>
                    <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{roleLabel}</p>
                  </div>
                  <button
                    onClick={() => { setActiveView("profiles"); setShowHeaderMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#a8b5d1] hover:bg-white/[0.04] transition-colors"
                  >
                    <User size={14} />
                    <span className="font-['Plus_Jakarta_Sans']">Edit Profile</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowHeaderMenu(false);
                      if (Notification.permission === "granted") {
                        alert("App is allowed to send notifications! Sending a test notification now. If you don't see it, please ensure 'Base2Brand ERP' is turned ON in your Windows Notification Settings.");
                      } else if (Notification.permission === "denied") {
                        alert("Notifications are blocked! Please allow them in your browser/app settings.");
                      } else {
                        await requestNotificationAccess();
                      }
                      if (Notification.permission === "granted") {
                         new Notification("Notifications Enabled", { body: "You are all set to receive alerts!" });
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#a8b5d1] hover:bg-white/[0.04] transition-colors"
                  >
                    <Bell size={14} />
                    <span className="font-['Plus_Jakarta_Sans']">Enable Notifications</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={14} />
                    <span className="font-['Plus_Jakarta_Sans']">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
          {notificationPermission === "default" && (
            <div className="mb-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-indigo-200">
                <Bell className="w-5 h-5 text-indigo-400" />
                <div className="text-sm font-['Plus_Jakarta_Sans']">
                  <p className="font-semibold text-white">Enable Notifications</p>
                  <p className="text-xs text-[#a8b5d1] mt-0.5">Allow notifications to receive important alerts and messages from your team.</p>
                </div>
              </div>
              <button 
                onClick={requestNotificationAccess}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors font-['Plus_Jakarta_Sans'] whitespace-nowrap ml-4"
              >
                Allow
              </button>
            </div>
          )}
          {renderView()}
        </main>
      </div>

      {/* Floating Quick Actions */}
      <FloatingQuickActions roleLabel={roleLabel} />
      
      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors theme="dark" />

      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.4); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
