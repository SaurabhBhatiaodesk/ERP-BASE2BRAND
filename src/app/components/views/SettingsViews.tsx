import React, { useState } from "react";
import {
  UserCheck, Award, Bell, Monitor, Globe, AlertTriangle, Zap,
  Clock, Activity, Brain, DollarSign, Users, Send, Plus,
  ChevronLeft, X,
} from "lucide-react";
import { Avatar, Badge } from "../ui";
import { DataLoading, DataError, DataEmpty } from "../ui/DataStatus";
import { useProjects } from "@/hooks/useSupabaseData";

export function SettingsPage() {
  const [section, setSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({ email: true, push: true, taskReminders: true, weeklyReport: false, aiAlerts: true, teamUpdates: false });
  const [profile, setProfile] = useState({ name: "CEO Admin", email: "ceo@base2brand.com", phone: "+91 98765 00001", location: "Bangalore", bio: "Founder & CEO of Base2Brand Infotech." });

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500); }

  const sections = [
    { id: "profile", label: "Profile", icon: UserCheck },
    { id: "security", label: "Security", icon: Award },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Monitor },
    { id: "integrations", label: "Integrations", icon: Globe },
  ];

  const inputCls = "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
  const labelCls = "block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5";

  return (
    <div className="grid lg:grid-cols-[200px_1fr] gap-5">
      {/* Sidebar */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-3 h-fit space-y-0.5">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] transition-all text-left ${section === s.id ? "bg-indigo-600/15 border border-indigo-500/20 text-white" : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"}`}>
            <s.icon size={14} className={section === s.id ? "text-indigo-400" : ""} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {saved && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>
            <p className="text-xs text-emerald-400 font-['Plus_Jakarta_Sans']">Changes saved successfully.</p>
          </div>
        )}

        {section === "profile" && (
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Profile Information</h3>
            <div className="flex items-center gap-4 pb-4 border-b border-[rgba(99,102,241,0.08)]">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-xl font-bold text-white">CA</div>
              <div>
                <button className="text-xs text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors font-['Plus_Jakarta_Sans']">Change Photo</button>
                <p className="text-[10px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-1">JPG, PNG up to 2MB</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Full Name</label><input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} type="email" className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className={inputCls} /></div>
              <div><label className={labelCls}>Location</label><input value={profile.location} onChange={e => setProfile({...profile, location: e.target.value})} className={inputCls} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Bio</label>
                <textarea value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
            <div className="flex justify-end pt-2"><button onClick={save} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold rounded-xl font-['Plus_Jakarta_Sans'] hover:from-indigo-500 hover:to-violet-500 transition-all">Save Changes</button></div>
          </div>
        )}

        {section === "security" && (
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Security Settings</h3>
            <div className="space-y-4">
              <div><label className={labelCls}>Current Password</label><input type="password" placeholder="••••••••" className={inputCls} /></div>
              <div><label className={labelCls}>New Password</label><input type="password" placeholder="••••••••" className={inputCls} /></div>
              <div><label className={labelCls}>Confirm New Password</label><input type="password" placeholder="••••••••" className={inputCls} /></div>
            </div>
            <div className="p-4 bg-[#131a35] rounded-xl border border-[rgba(99,102,241,0.08)] space-y-3">
              <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Two-Factor Authentication</p>
              <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Add an extra layer of security using your authenticator app.</p>
              <button className="text-xs text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors font-['Plus_Jakarta_Sans']">Enable 2FA</button>
            </div>
            <div className="p-4 bg-[#131a35] rounded-xl border border-[rgba(99,102,241,0.08)]">
              <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] mb-2">Active Sessions</p>
              {[{ device: "Chrome · Bangalore", time: "Now · Current session", active: true }, { device: "Safari · iPhone 14", time: "2 days ago", active: false }].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(99,102,241,0.06)] last:border-0">
                  <div><p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{s.device}</p><p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{s.time}</p></div>
                  {!s.active && <button className="text-[10px] text-red-400 hover:text-red-300 font-['Geist_Mono'] transition-colors">Revoke</button>}
                  {s.active && <span className="text-[10px] font-['Geist_Mono'] text-emerald-400">● Active</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-end"><button onClick={save} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold rounded-xl font-['Plus_Jakarta_Sans'] hover:from-indigo-500 hover:to-violet-500 transition-all">Update Password</button></div>
          </div>
        )}

        {section === "notifications" && (
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 font-['Plus_Jakarta_Sans']">Notification Preferences</h3>
            <div className="space-y-1">
              {([
                { key: "email", label: "Email Notifications", desc: "Receive updates via email" },
                { key: "push", label: "Push Notifications", desc: "Browser & app notifications" },
                { key: "taskReminders", label: "Task Reminders", desc: "Reminders for upcoming deadlines" },
                { key: "weeklyReport", label: "Weekly Performance Report", desc: "Summary every Monday morning" },
                { key: "aiAlerts", label: "AI Productivity Alerts", desc: "Alerts for team anomalies" },
                { key: "teamUpdates", label: "Team Activity Feed", desc: "Real-time team activity" },
              ] as { key: keyof typeof notifs; label: string; desc: string }[]).map(n => (
                <div key={n.key} className="flex items-center justify-between p-3.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{n.label}</p>
                    <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">{n.desc}</p>
                  </div>
                  <button onClick={() => setNotifs(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                    className={`relative w-10 h-5 rounded-full transition-all shrink-0 ${notifs[n.key] ? "bg-indigo-600" : "bg-[#2a3557]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${notifs[n.key] ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-[rgba(99,102,241,0.08)]"><button onClick={save} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold rounded-xl font-['Plus_Jakarta_Sans'] hover:from-indigo-500 hover:to-violet-500 transition-all">Save Preferences</button></div>
          </div>
        )}

        {section === "appearance" && (
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Appearance</h3>
            <div>
              <p className="text-xs font-semibold text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "dark", label: "Dark", preview: "bg-[#06091a]", text: "text-indigo-400" },
                  { id: "light", label: "Light", preview: "bg-white border border-[rgba(0,0,0,0.1)]", text: "text-indigo-600" },
                  { id: "system", label: "System", preview: "bg-gradient-to-r from-[#06091a] to-white", text: "text-gray-400" },
                ].map(t => (
                  <button key={t.id} className={`p-3 rounded-xl border ${t.id === "dark" ? "border-indigo-500/40 bg-indigo-600/10" : "border-[rgba(99,102,241,0.12)] hover:border-indigo-500/20"} transition-all`}>
                    <div className={`h-10 rounded-lg mb-2 ${t.preview}`} />
                    <p className={`text-xs font-['Plus_Jakarta_Sans'] ${t.id === "dark" ? "text-white" : "text-[#6b7fa8]"}`}>{t.label}</p>
                    {t.id === "dark" && <p className="text-[9px] font-['Geist_Mono'] text-indigo-400 mt-0.5">Active</p>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-3">Accent Color</p>
              <div className="flex gap-3">
                {[["from-indigo-600 to-violet-600","Indigo",true],["from-blue-600 to-cyan-600","Blue",false],["from-emerald-600 to-teal-600","Green",false],["from-rose-600 to-pink-600","Rose",false]].map(([g,label,active]) => (
                  <button key={label as string} className={`flex flex-col items-center gap-1.5 ${active ? "opacity-100" : "opacity-50 hover:opacity-75"} transition-opacity`}>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} ${active ? "ring-2 ring-white/30 ring-offset-2 ring-offset-[#06091a]" : ""}`} />
                    <span className="text-[9px] font-['Geist_Mono'] text-[#6b7fa8]">{label as string}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mb-3">Sidebar Density</p>
              <div className="flex gap-2">
                {["Compact","Default","Comfortable"].map((d, i) => (
                  <button key={d} className={`px-4 py-2 rounded-lg text-xs font-['Plus_Jakarta_Sans'] border transition-all ${i === 1 ? "bg-indigo-600/15 border-indigo-500/30 text-white" : "border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>{d}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === "integrations" && (
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 font-['Plus_Jakarta_Sans']">Integrations</h3>
            <div className="space-y-3">
              {[
                { name: "Slack", desc: "Send notifications to Slack channels", connected: true, icon: "💬" },
                { name: "Google Calendar", desc: "Sync meetings and deadlines", connected: true, icon: "📅" },
                { name: "GitHub", desc: "Link commits to tasks", connected: false, icon: "🐙" },
                { name: "Jira", desc: "Two-way sync with Jira boards", connected: false, icon: "🎯" },
                { name: "Razorpay", desc: "Track payments and invoices", connected: false, icon: "💳" },
                { name: "WhatsApp Business", desc: "Send client updates via WhatsApp", connected: false, icon: "📱" },
              ].map(int => (
                <div key={int.name} className="flex items-center gap-4 p-4 bg-[#131a35] rounded-xl border border-[rgba(99,102,241,0.08)]">
                  <span className="text-xl w-8 text-center shrink-0">{int.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{int.name}</p>
                    <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">{int.desc}</p>
                  </div>
                  <button className={`text-xs px-3 py-1.5 rounded-lg border font-['Plus_Jakarta_Sans'] transition-colors ${int.connected ? "text-red-400 border-red-500/20 hover:bg-red-500/10" : "text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10"}`}>
                    {int.connected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const notificationsList = [
  { id: 1, color: "text-amber-400", bg: "bg-amber-500/10", title: "Dev team at 140% capacity", body: "Sprint #14 has 38 points assigned but team velocity is 27. 3 tasks at risk of slipping.", time: "5 min ago", read: false, category: "Alert" },
  { id: 2, color: "text-indigo-400", bg: "bg-indigo-500/10", title: "TechCorp deal idle for 3 days", body: "No activity on the ₹18.4L proposal since May 18. Recommended action: schedule a follow-up call.", time: "1 hour ago", read: false, category: "CRM" },
  { id: 3, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "Kavya Nair closed ₹8.2L deal", body: "GreenLeaf Organics final milestone payment received. Project marked complete.", time: "2 hours ago", read: false, category: "Revenue" },
  { id: 4, color: "text-red-400", bg: "bg-red-500/10", title: "Sprint #14 has 3 blockers", body: "Payment gateway, auth middleware, and DB migration are blocking 6 downstream tasks.", time: "3 hours ago", read: true, category: "Tasks" },
  { id: 5, color: "text-violet-400", bg: "bg-violet-500/10", title: "Rahul Gupta late login — 4th time", body: "Employee started work at 11:48 AM today. Consider a 1:1 check-in.", time: "5 hours ago", read: true, category: "HR" },
  { id: 6, color: "text-indigo-400", bg: "bg-indigo-500/10", title: "AI Weekly Summary Ready", body: "Your weekly performance briefing for May 18–24 is ready. Revenue up 22%, avg productivity 86.4%.", time: "Yesterday", read: true, category: "AI" },
  { id: 7, color: "text-emerald-400", bg: "bg-emerald-500/10", title: "INV-009 payment overdue", body: "FinEdge Capital invoice for ₹1.5L was due May 20. Send a reminder.", time: "Yesterday", read: true, category: "Revenue" },
  { id: 8, color: "text-blue-400", bg: "bg-blue-500/10", title: "New hire request approved", body: "DevOps Engineer role approved by CEO. Recruiter has been notified to begin sourcing.", time: "2 days ago", read: true, category: "HR" },
];

const notifIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Alert: AlertTriangle,
  CRM: Zap,
  Revenue: DollarSign,
  Tasks: Activity,
  HR: Clock,
  AI: Brain,
};

export function NotificationsCenterView() {
  const [filter, setFilter] = useState("All");
  const [notifications, setNotifications] = useState(notificationsList);
  const categories = ["All", "Alert", "CRM", "Revenue", "Tasks", "HR", "AI"];
  const unread = notifications.filter(n => !n.read).length;
  const filtered = filter === "All" ? notifications : notifications.filter(n => n.category === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans']">Notifications</h2>
          <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-0.5">{unread} unread · {notifications.length} total</p>
        </div>
        <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
          className="text-xs text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors font-['Plus_Jakarta_Sans']">
          Mark all as read
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] border transition-all ${filter === c ? "bg-indigo-600/15 border-indigo-500/30 text-white" : "border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(n => {
          const IconComp = notifIcons[n.category] ?? Bell;
          return (
            <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:border-indigo-500/20 ${n.read ? "bg-[#0d1326] border-[rgba(99,102,241,0.08)] opacity-60" : "bg-[#0d1326] border-[rgba(99,102,241,0.18)]"}`}>
              <div className={`w-9 h-9 rounded-xl ${n.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                <IconComp size={16} className={n.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xs font-semibold font-['Plus_Jakarta_Sans'] ${n.read ? "text-[#a8b5d1]" : "text-white"}`}>{n.title}</p>
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] shrink-0">{n.time}</span>
                </div>
                <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-1 leading-relaxed">{n.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] font-['Geist_Mono'] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{n.category}</span>
                  {!n.read && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pastAnnouncements = [
  { id: 1, title: "Q1 Results — Record Revenue!", body: "Team Base2Brand hit ₹96L in Q1, our best quarter ever. Special performance bonuses will be processed this Friday. Thank you for your incredible work!", author: "CEO Admin", time: "May 22, 11:00 AM", audience: "All Staff", priority: "High", read: 34 },
  { id: 2, title: "New Leave Policy Effective June 1", body: "Please review the updated leave policy in the HR portal. Key change: carry-forward limit increased from 12 to 18 days.", author: "Sneha Reddy", time: "May 19, 2:30 PM", audience: "All Staff", priority: "Normal", read: 31 },
  { id: 3, title: "Dev Team — Sprint #15 Kickoff", body: "Sprint #15 starts May 27. Please complete your task estimates in the system by EOD Friday.", author: "Priya Sharma", time: "May 18, 9:00 AM", audience: "Development", priority: "Normal", read: 11 },
];

export function BroadcastView() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("All Staff");
  const [priority, setPriority] = useState("Normal");
  const [sent, setSent] = useState(false);
  const [announcements, setAnnouncements] = useState(pastAnnouncements);

  function send() {
    if (!title.trim() || !body.trim()) return;
    setAnnouncements(prev => [{
      id: prev.length + 1, title, body, author: "CEO Admin",
      time: "Just now", audience, priority, read: 0,
    }, ...prev]);
    setTitle(""); setBody("");
    setSent(true); setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="space-y-5">
      {/* Compose */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0">
            <Send size={17} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Broadcast Announcement</h3>
            <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Send a message to the entire team or a specific department</p>
          </div>
        </div>

        {sent && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
            <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>
            <p className="text-xs text-emerald-400 font-['Plus_Jakarta_Sans']">Announcement sent to {audience}!</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Team Meeting Scheduled for Monday"
              className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']" />
          </div>
          <div>
            <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Message *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              placeholder="Write your announcement here..."
              className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans'] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Audience</label>
              <select value={audience} onChange={e => setAudience(e.target.value)}
                className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans'] cursor-pointer">
                {["All Staff","Development","Design","Marketing","HR & Ops","Sales","Leadership"].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans'] cursor-pointer">
                <option>Normal</option><option>High</option><option>Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Notification will be sent via in-app, email, and Slack.</p>
            <button onClick={send}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold rounded-xl transition-all font-['Plus_Jakarta_Sans'] shadow-lg shadow-indigo-600/20">
              Send Broadcast →
            </button>
          </div>
        </div>
      </div>

      {/* Past announcements */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Past Announcements</h3>
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="p-4 bg-[#131a35] border border-[rgba(99,102,241,0.08)] rounded-xl">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{a.title}</p>
                  <Badge variant={a.priority === "Urgent" ? "red" : a.priority === "High" ? "yellow" : "blue"}>{a.priority}</Badge>
                </div>
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] shrink-0">{a.time}</span>
              </div>
              <p className="text-[11px] text-[#6b7fa8] font-['Plus_Jakarta_Sans'] leading-relaxed mb-3">{a.body}</p>
              <div className="flex items-center gap-4 text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">
                <span>By {a.author}</span>
                <span>→ {a.audience}</span>
                <span>👁 {a.read} read</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const _projectsDataUnused = [
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

export function ProjectDetailPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (view: string, tab?: "employee" | "client" | "project" | "assign") => void;
}) {
  const { data: projectsData, loading, error } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <DataLoading label="Loading projects..." />;
  if (error) return <DataError message={error} />;
  if (projectsData.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans']">
            <ChevronLeft size={14} /> Back
          </button>
          <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Project Details</h2>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-10 text-center">
          <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mb-4">No projects yet. Create your first project.</p>
          <button
            onClick={() => onNavigate?.("register", "project")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 text-white text-sm font-semibold rounded-xl"
          >
            <Plus size={14} /> Add Project
          </button>
        </div>
      </div>
    );
  }

  const activeId = selectedId ?? projectsData[0].id;
  const project = projectsData.find(p => p.id === activeId) ?? projectsData[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6b7fa8] hover:text-white text-xs transition-colors font-['Plus_Jakarta_Sans']">
          <ChevronLeft size={14} /> Back
        </button>
        <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Project Details</h2>
        <button
          onClick={() => onNavigate?.("register", "project")}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-xs font-semibold rounded-xl transition-all"
        >
          <Plus size={13} /> Add Project
        </button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        {/* Project list */}
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-3 space-y-1 h-fit">
          {projectsData.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${activeId === p.id ? "bg-indigo-600/15 border border-indigo-500/20" : "hover:bg-white/[0.03]"}`}>
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{p.name}</p>
                <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{p.progress}% · {p.status}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => onNavigate?.("register", "project")}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 text-violet-400 hover:text-violet-300 text-xs font-['Plus_Jakarta_Sans'] transition-colors"
          >
            <Plus size={12} /> Add Project
          </button>
        </div>

        <div className="space-y-4">
          {/* Header */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-base font-bold text-white font-['Plus_Jakarta_Sans']">{project.name}</h2>
                  <Badge variant={project.priority === "Critical" ? "red" : "yellow"}>{project.priority}</Badge>
                  <Badge variant={project.status === "In Progress" ? "blue" : project.status === "Review" ? "yellow" : "green"}>{project.status}</Badge>
                </div>
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{project.client} · {project.dept} · Lead: {project.lead}</p>
                <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] mt-2 max-w-lg leading-relaxed">{project.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-indigo-400 font-['Geist_Mono']">{project.progress}%</p>
                <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">Complete</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-[#131a35] rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[{ l: "Start", v: project.start }, { l: "Deadline", v: project.end }, { l: "Budget", v: project.budget }, { l: "Spent", v: project.spent }].map(s => (
                <div key={s.l}>
                  <p className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{s.l}</p>
                  <p className="text-sm font-semibold text-[#e2e8f7] font-['Plus_Jakarta_Sans'] mt-0.5">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">Team</h3>
            <div className="flex flex-wrap gap-2">
              {project.team.map(m => (
                <div key={m} className="flex items-center gap-2 bg-[#131a35] border border-[rgba(99,102,241,0.1)] px-3 py-2 rounded-lg">
                  <Avatar initials={m.slice(0,2)} size="sm" color="bg-gradient-to-br from-indigo-600 to-violet-600" />
                  <span className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Project Timeline</h3>
            <div className="space-y-2.5">
              {project.timeline.map(t => (
                <div key={t.phase} className="flex items-center gap-3">
                  <span className="text-[11px] font-['Plus_Jakarta_Sans'] text-[#6b7fa8] w-36 shrink-0 truncate">{t.phase}</span>
                  <div className="flex-1 h-6 bg-[#131a35] rounded-lg overflow-hidden relative">
                    <div className={`absolute h-full ${t.color} rounded-lg opacity-80 flex items-center px-2`}
                      style={{ left: `${t.start}%`, width: `${t.width}%` }}>
                      <span className="text-[9px] text-white font-['Geist_Mono'] truncate">{t.width}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Tasks</h3>
            <div className="space-y-2">
              {project.tasks.map(t => (
                <div key={t.title} className="flex items-center gap-4 px-3 py-2.5 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)]">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "Done" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-indigo-500" : t.status === "In Review" ? "bg-amber-500" : "bg-[#6b7fa8]"}`} />
                  <p className="flex-1 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans']">{t.title}</p>
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{t.assignee.split(" ")[0]}</span>
                  <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8]">{t.due}</span>
                  <Badge variant={t.status === "Done" ? "green" : t.status === "In Progress" ? "blue" : t.status === "In Review" ? "yellow" : "blue"}>{t.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const invoicesData = [
  { id: "INV-012", client: "TechCorp Solutions", project: "ERP Implementation", amount: "₹4.6L", issued: "May 20", due: "Jun 5", status: "Unpaid", type: "Milestone" },
  { id: "INV-011", client: "FinEdge Capital", project: "CRM Starter", amount: "₹1.5L", issued: "May 15", due: "May 22", status: "Overdue", type: "Recurring" },
  { id: "INV-010", client: "GreenLeaf Organics", project: "Social Media Kit", amount: "₹95K", issued: "May 10", due: "May 17", status: "Paid", type: "Final" },
  { id: "INV-009", client: "TechCorp Solutions", project: "ERP Implementation", amount: "₹4.6L", issued: "Apr 20", due: "May 5", status: "Paid", type: "Milestone" },
  { id: "INV-008", client: "FinEdge Capital", project: "CRM Starter", amount: "₹1.5L", issued: "Apr 15", due: "Apr 22", status: "Paid", type: "Recurring" },
];

export function InvoiceView() {
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [newInv, setNewInv] = useState({ client: "", project: "", amount: "", due: "", type: "Milestone" });
  const [invoices, setInvoices] = useState(invoicesData);
  const [created, setCreated] = useState(false);

  const filtered = filter === "All" ? invoices : invoices.filter(i => i.status === filter);
  const totalPaid = invoices.filter(i => i.status === "Paid").length;
  const totalUnpaid = invoices.filter(i => i.status === "Unpaid").length;
  const totalOverdue = invoices.filter(i => i.status === "Overdue").length;

  function createInvoice() {
    if (!newInv.client || !newInv.amount) return;
    const id = `INV-${(invoices.length + 13).toString().padStart(3,"0")}`;
    setInvoices(prev => [{ id, client: newInv.client, project: newInv.project || "General", amount: newInv.amount, issued: "May 30", due: newInv.due || "Jun 14", status: "Unpaid", type: newInv.type }, ...prev]);
    setNewInv({ client: "", project: "", amount: "", due: "", type: "Milestone" });
    setCreated(true); setShowNew(false); setTimeout(() => setCreated(false), 3000);
  }

  const inputCls = "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";

  return (
    <div className="space-y-5">
      {created && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">✓</span>
          <p className="text-xs text-emerald-400 font-['Plus_Jakarta_Sans']">Invoice created and sent to client!</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoiced", value: "₹22.8L", color: "text-indigo-400", icon: DollarSign },
          { label: "Paid", value: `${totalPaid} invoices`, color: "text-emerald-400", icon: UserCheck },
          { label: "Unpaid", value: `${totalUnpaid} invoices`, color: "text-amber-400", icon: Clock },
          { label: "Overdue", value: `${totalOverdue} invoices`, color: "text-red-400", icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={s.color} />
              <span className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{s.label}</span></div>
            <p className={`text-lg font-bold font-['Plus_Jakarta_Sans'] ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {["All","Paid","Unpaid","Overdue"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-['Plus_Jakarta_Sans'] border transition-all ${filter === f ? "bg-indigo-600/15 border-indigo-500/30 text-white" : "border-[rgba(99,102,241,0.12)] text-[#6b7fa8] hover:text-[#a8b5d1]"}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors font-['Plus_Jakarta_Sans']">
          <Plus size={13} /> New Invoice
        </button>
      </div>

      {/* New invoice form */}
      {showNew && (
        <div className="bg-[#0d1326] border border-indigo-500/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Create Invoice</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Client *</label>
              <select value={newInv.client} onChange={e => setNewInv({...newInv, client: e.target.value})} className={inputCls}>
                <option value="">Select client</option>
                {["TechCorp Solutions","FinEdge Capital","GreenLeaf Organics"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Project</label>
              <input value={newInv.project} onChange={e => setNewInv({...newInv, project: e.target.value})} placeholder="Project name" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Amount (₹) *</label>
              <input value={newInv.amount} onChange={e => setNewInv({...newInv, amount: e.target.value})} placeholder="e.g. ₹2.5L" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Due Date</label>
              <input type="date" value={newInv.due} onChange={e => setNewInv({...newInv, due: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-['Plus_Jakarta_Sans'] text-[#6b7fa8] mb-1.5">Type</label>
              <select value={newInv.type} onChange={e => setNewInv({...newInv, type: e.target.value})} className={inputCls}>
                <option>Milestone</option><option>Recurring</option><option>Final</option><option>Advance</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-xs text-[#6b7fa8] hover:text-white transition-colors font-['Plus_Jakarta_Sans']">Cancel</button>
            <button onClick={createInvoice} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors font-['Plus_Jakarta_Sans']">Create & Send</button>
          </div>
        </div>
      )}

      {/* Invoice table */}
      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-3 px-3 py-2">
            {["Invoice","Client","Project","Amount","Due","Status"].map(h => (
              <span key={h} className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          {filtered.map(inv => (
            <div key={inv.id} className="grid grid-cols-6 gap-3 px-3 py-3 bg-[#131a35] rounded-lg border border-[rgba(99,102,241,0.08)] items-center hover:border-indigo-500/15 transition-colors">
              <span className="text-xs font-['Geist_Mono'] text-indigo-400">{inv.id}</span>
              <p className="text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{inv.client}</p>
              <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans'] truncate">{inv.project}</p>
              <p className="text-xs font-bold font-['Geist_Mono'] text-[#e2e8f7]">{inv.amount}</p>
              <p className="text-xs font-['Geist_Mono'] text-[#6b7fa8]">{inv.due}</p>
              <Badge variant={inv.status === "Paid" ? "green" : inv.status === "Overdue" ? "red" : "yellow"}>{inv.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
