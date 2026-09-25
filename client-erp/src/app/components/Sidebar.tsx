import { useState } from "react";
import {
  LayoutDashboard, BarChart3, FolderOpen, Package,
  Activity, FileText, Video, Users, HeadphonesIcon, CreditCard,
  BookOpen, Bot, Bell, Settings, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";

const LOGO_SVG = `<svg width="120" height="18" viewBox="0 0 1152 172" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M511.27 89.6601C511.84 87.1001 512.04 84.7901 511.5 82.4701C510.29 77.2801 505.95 73.8701 499.66 72.9701C492.79 71.9901 486.31 73.4501 479.96 75.8601C472.78 78.5901 466.25 82.4901 460.14 87.1101C459.78 87.3801 459.41 87.6601 459.04 87.9201C458.96 87.9801 458.83 87.9701 458.69 88.0001C458.25 87.5201 458.46 86.9301 458.46 86.3901C458.44 76.4901 458.46 66.5901 458.42 56.6901C458.42 55.4601 458.78 54.7601 459.86 54.1201C469.27 48.6201 479.12 44.2501 490 42.7801C501.31 41.2601 512.39 42.2101 522.9 47.0501C528.81 49.7701 533.66 53.8101 537.42 59.1501C538 59.9801 538.04 60.5701 537.45 61.4101C530.14 71.8101 521.45 80.9401 511.94 89.3201C511.82 89.4301 511.65 89.4701 511.26 89.6701" fill="#F47B52"/><path d="M543.99 86.8701C542.99 93.9301 539.02 104.68 535.29 110.76C528.37 122.02 519.54 131.66 509.81 140.53C509.39 140.91 508.98 141.3 508.5 141.75C509.08 142.28 509.73 142.07 510.3 142.07C521.29 142.08 532.28 142.11 543.26 142.04C544.87 142.04 545.26 142.53 545.24 144.06C545.18 152.71 545.18 161.36 545.24 170.01C545.24 171.02 544.43 171.84 543.42 171.84C515.41 171.8 487.39 171.8 459.38 171.84C457.78 171.84 457.52 171.26 457.53 169.86C457.59 162.46 457.6 155.06 457.53 147.66C457.52 146.44 458.15 145.3 459.18 144.66C479.01 132.26 497.13 117.77 513.36 100.9C529.13 84.5101 541.61 65.8601 551.96 45.7001C552.29 45.0701 554.23 41.2901 553.41 43.6101C553.41 43.6101 546.74 67.3301 543.98 86.8601" fill="#F47B52"/><path d="M88.83 144.37C88.83 160.51 75.49 169.98 50.41 169.98H0V76.6101H47.75C72.29 76.6101 84.3 86.6101 84.3 101.02C84.3 109.95 79.77 117.16 71.76 121.29C82.3 125.03 88.83 133.03 88.83 144.37ZM26.15 95.6901V113.69H44.28C53.09 113.69 57.62 110.62 57.62 104.62C57.62 98.6201 53.09 95.6901 44.28 95.6901H26.15ZM62.16 141.44C62.16 135.04 57.35 131.97 48.28 131.97H26.15V150.91H48.28C57.35 150.91 62.16 147.84 62.16 141.44Z" fill="white"/><path d="M182.13 151.84H142.64L135.31 169.98H108.36L149.58 76.6101H175.59L216.93 169.98H189.46L182.13 151.84ZM174.39 132.37L162.39 102.49L150.39 132.37H174.4H174.39Z" fill="white"/><path d="M243.54 161.57L252.21 142.1C260.47 147.57 272.22 151.3 283.02 151.3C293.82 151.3 298.22 148.24 298.22 143.7C298.22 128.89 245.14 139.7 245.14 105.02C245.14 88.3401 258.75 74.7401 286.49 74.7401C298.62 74.7401 311.16 77.5401 320.36 82.8801L312.22 102.49C303.28 97.6901 294.48 95.2801 286.34 95.2801C275.27 95.2801 271.27 99.0201 271.27 103.69C271.27 117.96 324.22 107.29 324.22 141.7C324.22 157.97 310.63 171.85 282.88 171.85C267.54 171.85 252.34 167.71 243.53 161.58" fill="white"/><path d="M428.34 149.57V169.98H353.37V76.6101H426.6V97.0201H379.52V112.76H420.99V132.5H379.52V149.57H428.34Z" fill="white"/><path d="M667.16 144.37C667.16 160.51 653.81 169.98 628.74 169.98H578.33V76.6101H626.08C650.62 76.6101 662.63 86.6101 662.63 101.02C662.63 109.95 658.09 117.16 650.09 121.29C660.63 125.03 667.16 133.03 667.16 144.37ZM604.47 95.6901V113.69H622.6C631.41 113.69 635.94 110.62 635.94 104.62C635.94 98.6201 631.41 95.6901 622.6 95.6901H604.47ZM640.49 141.44C640.49 135.04 635.68 131.97 626.61 131.97H604.48V150.91H626.61C635.68 150.91 640.49 147.84 640.49 141.44Z" fill="white"/><path d="M734.37 145.17H719.97V169.98H693.56V76.6101H736.24C761.72 76.6101 777.73 89.8101 777.73 111.16C777.73 124.9 771.06 135.04 759.46 140.64L779.6 169.99H751.32L734.38 145.18L734.37 145.17ZM734.63 97.4201H719.96V124.76H734.63C745.58 124.76 751.04 119.69 751.04 111.16C751.04 102.63 745.57 97.4201 734.63 97.4201Z" fill="white"/><path d="M880.49 151.84H841.01L833.67 169.98H806.73L847.95 76.6101H873.96L915.31 169.98H887.83L880.5 151.84H880.49ZM872.75 132.37L860.75 102.49L848.74 132.37H872.75Z" fill="white"/><path d="M1028.6 76.6101V169.98H1006.86L965.64 120.23V169.98H939.77V76.6101H961.51L1002.72 126.36V76.6101H1028.6Z" fill="white"/><path d="M1055.59 76.6101H1099.74C1130.69 76.6101 1151.89 94.6201 1151.89 123.29C1151.89 151.96 1130.69 169.98 1099.74 169.98H1055.59V76.6101ZM1098.67 148.9C1114.55 148.9 1125.21 139.43 1125.21 123.29C1125.21 107.15 1114.55 97.6801 1098.67 97.6801H1082V148.9H1098.67Z" fill="white"/></svg>`;

const navItems = [
  { id: "command", label: "Command Center", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "deliverables", label: "Deliverables", icon: Package },
  { id: "activity", label: "Activity Feed", icon: Activity },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "team", label: "Team", icon: Users },
  { id: "support", label: "Support Center", icon: HeadphonesIcon },
  { id: "invoices", label: "Invoices", icon: CreditCard },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "ai", label: "AI Project Manager", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

export const PAGE_IDS = navItems.map(item => item.id);

export type SidebarBadges = { approvals: number; actionItems: number; notifications: number };

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  organizationName?: string;
  organizationPlan?: string;
  badges?: SidebarBadges;
  /** Module ids to hide — driven by Client Portal Control settings. Never applied for admin accounts. */
  hiddenIds?: string[];
}

export function Sidebar({
  active, onNavigate,
  userName = "—", userRole = "", userInitials = "?", onSignOut,
  organizationName, organizationPlan, badges, hiddenIds,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hidden = new Set(hiddenIds ?? []);
  const visibleNavItems = navItems.filter(item => !hidden.has(item.id));

  const badgeByNavId: Record<string, number | undefined> = {
    deliverables: badges?.approvals,
    command: badges?.actionItems,
    notifications: badges?.notifications,
  };

  const orgInitials = organizationName
    ? organizationName.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  return (
    <aside
      className="relative flex flex-col h-full transition-all duration-300 select-none"
      style={{
        width: collapsed ? 60 : 240,
        background: "linear-gradient(180deg, #07091A 0%, #0B0E28 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-4 py-5 overflow-hidden"
        style={{ minHeight: 64, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {collapsed ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7B5CF5, #4C6EF5)" }}
          >
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>B</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2"
            dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
          />
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-5 -right-3 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors"
        style={{
          background: "#1A1F48",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#8891B8",
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Client info */}
      {!collapsed && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #F47B52, #E05C35)", fontSize: 11, color: "#fff", fontWeight: 600 }}
            >
              {orgInitials}
            </div>
            <div className="overflow-hidden">
              <p style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {organizationName ?? "All Clients"}
              </p>
              <p style={{ color: "#8891B8", fontSize: 10, whiteSpace: "nowrap" }}>
                {organizationPlan ?? (organizationName ? "Client" : "Admin view")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150"
              style={{
                padding: collapsed ? "9px 10px" : "8px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive
                  ? "linear-gradient(90deg, rgba(123,92,245,0.2), rgba(76,110,245,0.1))"
                  : "transparent",
                color: isActive ? "#C4B5FD" : "#8891B8",
                borderLeft: isActive ? "2px solid #7B5CF5" : "2px solid transparent",
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  {!!badgeByNavId[item.id] && (
                    <span
                      className="rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(123,92,245,0.3)",
                        color: "#C4B5FD",
                        fontSize: 10,
                        fontWeight: 600,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                      }}
                    >
                      {badgeByNavId[item.id]}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom user area */}
      {!collapsed && (
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #4C6EF5, #7B5CF5)", fontSize: 11, color: "#fff", fontWeight: 600 }}
            >
              {userInitials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p style={{ color: "#E2E4F0", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userName}
              </p>
              <p style={{ color: "#8891B8", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {userRole || "Client"}
              </p>
            </div>
            <button onClick={onSignOut} title="Sign out" style={{ color: "#8891B8", cursor: "pointer" }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
