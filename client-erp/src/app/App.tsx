import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ChevronDown, Globe2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentPerson, signOut, fetchAllOrganizations, fetchSidebarBadges, type CurrentPersonContext, type Organization, type SidebarBadgeCounts } from "@/lib/database";
import { AuthScreen } from "./components/AuthScreen";
import { Sidebar } from "./components/Sidebar";
import { CommandCenter } from "./components/CommandCenter";
import { Portfolio } from "./components/Portfolio";
import { Projects } from "./components/Projects";
import { Deliverables } from "./components/Deliverables";
import { AIProjectManager } from "./components/AIProjectManager";
import { Billing } from "./components/Billing";
import { Team } from "./components/Team";
import { SupportCenter } from "./components/SupportCenter";
import { Documents } from "./components/Documents";
import { Meetings } from "./components/Meetings";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { Notifications } from "./components/Notifications";
import { Settings } from "./components/Settings";
import { ActivityFeed } from "./components/ActivityFeed";

function buildPageMap(
  organizationId: string | null,
  context: CurrentPersonContext,
  onSelectOrganization: (organizationId: string) => void,
): Record<string, React.ReactNode> {
  const orgId = organizationId ?? undefined;
  const personName = context.person.fullName;
  return {
    command: <CommandCenter organizationId={orgId} personName={personName} onSelectOrganization={onSelectOrganization} />,
    portfolio: <Portfolio organizationId={orgId} />,
    projects: <Projects organizationId={orgId} />,
    deliverables: <Deliverables organizationId={orgId} />,
    activity: <ActivityFeed organizationId={orgId} />,
    documents: <Documents organizationId={orgId} />,
    meetings: <Meetings organizationId={orgId} />,
    team: <Team organizationId={orgId} />,
    support: <SupportCenter organizationId={orgId} personName={personName} />,
    invoices: <Billing organizationId={orgId} />,
    knowledge: <KnowledgeBase organizationId={orgId} />,
    ai: <AIProjectManager organizationId={orgId} personName={personName} />,
    notifications: <Notifications personId={context.person.id} />,
    settings: <Settings context={context} />,
  };
}

/** Admin-only — lets the admin pick "All Clients" or one specific client organization to view as. */
function ClientSwitcher({
  organizations, value, onChange,
}: {
  organizations: Organization[];
  value: string | null;
  onChange: (organizationId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <Globe2 size={14} color="#8891B8" />
      <span style={{ color: "#8891B8", fontSize: 12 }}>Viewing:</span>
      <div className="relative flex-1" style={{ maxWidth: 260 }}>
        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value || null)}
          className="w-full appearance-none rounded-lg pl-3 pr-8 py-1.5"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#E2E4F0",
            fontSize: 12,
          }}
        >
          <option value="" style={{ background: "#0D1030" }}>All Clients</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id} style={{ background: "#0D1030" }}>{org.name}</option>
          ))}
        </select>
        <ChevronDown size={13} color="#8891B8" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="size-full flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #07091A 0%, #0B0D24 50%, #070B1C 100%)", minHeight: "100vh" }}
    >
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}
        >
          <span style={{ color: "#fff", fontSize: 22 }}>✦</span>
        </div>
        <p style={{ color: "#E2E4F0", fontSize: 16, fontWeight: 600 }}>{title}</p>
        <p style={{ color: "#8891B8", fontSize: 13, maxWidth: 340 }}>{body}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("command");
  // undefined = still checking for an existing session; null = signed out.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [context, setContext] = useState<CurrentPersonContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(false);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  // Fixed to the person's own org for a normal client; null ("All Clients") to start for an admin.
  const [viewingOrganizationId, setViewingOrganizationId] = useState<string | null>(null);
  const [badges, setBadges] = useState<SidebarBadgeCounts>({ approvals: 0, actionItems: 0, notifications: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextError(false);
    getCurrentPerson()
      .then(result => {
        if (cancelled) return;
        setContext(result);
        if (!result) {
          setContextError(true);
          return;
        }
        if (result.person.kind === "admin") {
          // Admin: start on "All Clients"; fetch the switcher's options.
          setViewingOrganizationId(null);
          void fetchAllOrganizations().then(orgs => { if (!cancelled) setAllOrganizations(orgs); });
        } else {
          // Normal client: fixed to their own org, no switcher.
          setViewingOrganizationId(result.organization?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setContextError(true);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!viewingOrganizationId || !context) {
      setBadges({ approvals: 0, actionItems: 0, notifications: 0 });
      return;
    }
    let cancelled = false;
    // Re-fetched on every page change too — cheap head-count queries, and it keeps
    // the badges honest right after the user approves something or reads a notification.
    fetchSidebarBadges(viewingOrganizationId, context.person.id)
      .then(result => { if (!cancelled) setBadges(result); })
      .catch(() => { if (!cancelled) setBadges({ approvals: 0, actionItems: 0, notifications: 0 }); });
    return () => { cancelled = true; };
  }, [viewingOrganizationId, context, activePage]);

  if (session === undefined) {
    return <FullScreenMessage title="Loading..." body="" />;
  }

  if (!session) {
    return <AuthScreen onSignedIn={() => { /* session listener above picks it up */ }} />;
  }

  if (contextLoading) {
    return <FullScreenMessage title="Loading your dashboard..." body="" />;
  }

  if (contextError || !context) {
    return (
      <FullScreenMessage
        title="Account not set up yet"
        body="Your login worked, but it isn't linked to a client organization yet. Contact your Base2Brand project manager to finish setting up your account."
      />
    );
  }

  const isAdmin = context.person.kind === "admin";
  const viewingOrganization = isAdmin
    ? allOrganizations.find(o => o.id === viewingOrganizationId) ?? null
    : context.organization;
  const pageMap = buildPageMap(viewingOrganizationId, context, setViewingOrganizationId);
  const page = pageMap[activePage] || <CommandCenter organizationId={viewingOrganizationId ?? undefined} personName={context.person.fullName} onSelectOrganization={setViewingOrganizationId} />;
  const isFullHeight = activePage === "ai" || activePage === "projects";

  return (
    <div
      className="size-full flex"
      style={{
        background: "linear-gradient(135deg, #07091A 0%, #0B0D24 50%, #070B1C 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Background glow effects */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: -200,
          left: "20%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,92,245,0.06) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          bottom: -100,
          right: "15%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(76,110,245,0.05) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex w-full h-full">
        <Sidebar
          active={activePage}
          onNavigate={setActivePage}
          userName={context.person.fullName}
          userRole={context.person.role || "Client"}
          userInitials={context.person.initials || context.person.fullName.slice(0, 2).toUpperCase()}
          onSignOut={() => void signOut()}
          organizationName={viewingOrganization?.name}
          organizationPlan={viewingOrganization?.planName ?? undefined}
          badges={badges}
        />

        <main
          className="flex-1 overflow-hidden relative"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {isAdmin && (
            <ClientSwitcher
              organizations={allOrganizations}
              value={viewingOrganizationId}
              onChange={setViewingOrganizationId}
            />
          )}
          {isFullHeight ? (
            <div className="flex-1 overflow-hidden">
              {page}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {page}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
