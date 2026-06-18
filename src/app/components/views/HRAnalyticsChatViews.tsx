import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Users, Calendar, Award, MoreHorizontal,
  Hash, Phone, Search, Send, Megaphone, X,
  MessageCircle, UserPlus, Paperclip, FileText, Loader2,
  CheckCheck, AlertCircle, Download, ExternalLink,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { Avatar, Badge } from "../ui";
import { DataLoading, DataError } from "../ui/DataStatus";
import { deptData, productivityData } from "../../data";
import { useEmployees, useEmployeeProfiles } from "@/hooks/useSupabaseData";
import { useChatChannelReads, useChatChannels, useChatMessages, useChatUnreadCounts } from "@/hooks/useChat";
import {
  findProfileForUser,
  getMessageDeliveryStatus,
  isMissingChatTables,
  markChatChannelRead,
  namesMatch,
  sendChatMessage,
  createGroupChannel,
  findOrCreateDmChannel,
  initialsFromName,
  type ChatChannel,
  type ChatChannelType,
  type ChatMessage,
  type EmployeeProfile,
  type MessageDeliveryStatus,
} from "@/lib/database";
import {
  fileDownloadUrl,
  fileNameFromUrl,
  fileOpenUrl,
  isCloudinaryConfigured,
  isFileUrl,
  isHttpUrl,
  isImageUrl,
  normalizeCloudinaryDeliveryUrl,
  uploadChatAttachment,
} from "@/lib/cloudinary";

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const URL_IN_TEXT_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/gi;

function linkClass(isOwn: boolean) {
  return isOwn
    ? "text-sky-300 underline underline-offset-2 hover:text-white break-all"
    : "text-indigo-400 underline underline-offset-2 hover:text-indigo-300 break-all";
}

function LinkifyText({ text, isOwn }: { text: string; isOwn: boolean }) {
  const parts = text.split(URL_IN_TEXT_RE);
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          const href = isFileUrl(part) ? fileOpenUrl(part) : part;
          return (
            <a
              key={`${i}-${part.slice(0, 24)}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass(isOwn)}
              onClick={e => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function ChatFileAttachment({
  message,
  isOwn,
  timeClass,
}: {
  message: ChatMessage;
  isOwn: boolean;
  timeClass: string;
}) {
  const url = normalizeCloudinaryDeliveryUrl(message.mediaUrl);
  const name = message.fileName || fileNameFromUrl(url) || message.content || "Document";
  const openUrl = fileOpenUrl(url);
  const downloadHref = fileDownloadUrl(url, name);

  return (
    <div className="space-y-2 min-w-[200px] max-w-[280px]">
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-colors ${
          isOwn
            ? "bg-white/10 border-white/15 hover:bg-white/15"
            : "bg-[#0d1326] border-indigo-500/20 hover:bg-[#0d1326]/90"
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isOwn ? "bg-white/15" : "bg-indigo-600/20"}`}>
          <FileText size={20} className={isOwn ? "text-white" : "text-indigo-400"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate font-['Plus_Jakarta_Sans'] ${isOwn ? "text-white" : "text-[#e2e8f7]"}`}>
            {name}
          </p>
          {message.fileSize > 0 && (
            <p className={`text-[10px] font-['Geist_Mono'] ${timeClass}`}>
              {formatFileSize(message.fileSize)}
            </p>
          )}
        </div>
      </a>
      <div className="flex flex-wrap gap-3 px-1">
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-xs font-semibold font-['Plus_Jakarta_Sans'] ${linkClass(isOwn)}`}
        >
          <ExternalLink size={12} /> Open
        </a>
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          download={name}
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-xs font-semibold font-['Plus_Jakarta_Sans'] ${linkClass(isOwn)}`}
        >
          <Download size={12} /> Download
        </a>
      </div>
    </div>
  );
}

function resolveOutgoingMessage(text: string) {
  const trimmed = text.trim();
  if (!isHttpUrl(trimmed)) {
    return { content: text, messageType: "text" as const };
  }
  if (isImageUrl(trimmed)) {
    return {
      content: trimmed,
      messageType: "image" as const,
      mediaUrl: trimmed,
      fileName: fileNameFromUrl(trimmed),
    };
  }
  if (isFileUrl(trimmed) || trimmed.includes("cloudinary.com")) {
    return {
      content: trimmed,
      messageType: "file" as const,
      mediaUrl: trimmed,
      fileName: fileNameFromUrl(trimmed),
    };
  }
  return { content: text, messageType: "text" as const };
}

export function HRView({
  onNavigate,
}: {
  onNavigate?: (view: string, tab?: "employee" | "client" | "project" | "assign") => void;
}) {
  const { data: employees, loading, error } = useEmployees();

  if (loading) return <DataLoading label="Loading employees..." />;
  if (error) return <DataError message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">HR & People Ops</h1>
          <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">{employees.length} employees · live from Supabase</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.("register", "employee")}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs transition-colors"
        >
          <Plus size={13} /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Employees", value: employees.length, icon: Users, color: "from-indigo-600 to-violet-600" },
          { label: "On Leave", value: employees.filter(e => e.status === "leave").length, icon: Calendar, color: "from-amber-600 to-orange-600" },
          { label: "Avg Score", value: Math.round(employees.reduce((s, e) => s + e.score, 0) / Math.max(employees.length, 1)), icon: Award, color: "from-emerald-600 to-teal-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">{stat.value}</p>
            <p className="text-xs text-[#6b7fa8] font-['Geist_Mono'] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[rgba(99,102,241,0.1)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Employee Directory</h2>
          <button className="p-1.5 hover:bg-white/[0.04] rounded-lg text-[#6b7fa8]"><MoreHorizontal size={14} /></button>
        </div>
        <div className="divide-y divide-[rgba(99,102,241,0.08)]">
          {employees.map(emp => (
            <div key={emp.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
              <Avatar initials={emp.avatar} src={emp.profileImageUrl || undefined} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">{emp.name}</p>
                <p className="text-xs text-[#6b7fa8] font-['Geist_Mono']">{emp.role} · {emp.dept}</p>
              </div>
              <div className="hidden sm:flex items-center gap-3 w-48">
                <div className="flex-1 h-1.5 bg-[#131a35] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${emp.score}%`, background: `linear-gradient(90deg, #6366f1, #8b5cf6)` }}
                  />
                </div>
                <span className={`text-sm font-bold font-['Geist_Mono'] w-8 text-right ${emp.score >= 90 ? "text-emerald-400" : emp.score >= 80 ? "text-indigo-400" : "text-amber-400"}`}>{emp.score}</span>
                <Badge label={emp.status} variant={emp.status as "active" | "idle"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">Analytics</h1>
        <p className="text-[#6b7fa8] text-sm font-['Geist_Mono'] mt-0.5">Team performance & productivity insights</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Department Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis dataKey="dept" tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }} />
              <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 font-['Plus_Jakarta_Sans']">Productivity Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis dataKey="week" tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7fa8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d1326", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChatSetupBanner() {
  return (
    <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <p className="text-sm font-semibold text-amber-200 font-['Plus_Jakarta_Sans'] mb-1">
        Chat tables not set up yet
      </p>
      <p className="text-xs text-amber-200/80 font-['Geist_Mono']">
        Run <code className="text-amber-100">supabase/chat_full_setup.sql</code> in Supabase SQL Editor, then reload.
      </p>
    </div>
  );
}

type ChatTab = "dm" | "group";

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function channelIcon(type: ChatChannelType) {
  if (type === "dm") return MessageCircle;
  if (type === "group") return Users;
  return Hash;
}

function profilePhoto(
  profiles: EmployeeProfile[],
  senderId: string,
  senderName: string
) {
  const byId = profiles.find(p => p.id === senderId);
  if (byId?.profileImageUrl) return byId.profileImageUrl;
  const byName = profiles.find(p => namesMatch(p.name, senderName));
  return byName?.profileImageUrl || "";
}

function buildOptimisticMessage(
  channelId: string,
  user: { id: string; name: string },
  partial: Pick<ChatMessage, "content" | "messageType" | "mediaUrl" | "mediaType" | "fileName" | "fileSize">
): ChatMessage {
  return {
    id: `pending-${crypto.randomUUID()}`,
    channelId,
    senderId: user.id,
    senderName: user.name,
    content: partial.content,
    isBroadcast: false,
    messageType: partial.messageType ?? "text",
    mediaUrl: partial.mediaUrl ?? "",
    mediaType: partial.mediaType ?? "",
    fileName: partial.fileName ?? "",
    fileSize: partial.fileSize ?? 0,
    createdAt: new Date().toISOString(),
    clientStatus: "sending",
  };
}

function MessageStatusTicks({ status }: { status: MessageDeliveryStatus }) {
  if (status === "sending") {
    return <Loader2 size={12} className="animate-spin text-white/60 shrink-0" aria-label="Sending" />;
  }
  if (status === "failed") {
    return <AlertCircle size={12} className="text-rose-300 shrink-0" aria-label="Failed to send" />;
  }
  if (status === "read") {
    return (
      <CheckCheck
        size={13}
        className="text-[#53bdeb] shrink-0"
        strokeWidth={2.5}
        aria-label="Read"
      />
    );
  }
  return (
    <CheckCheck size={12} className="text-white/45 shrink-0" strokeWidth={2} aria-label="Delivered" />
  );
}

function MessageBubble({
  message,
  isOwn,
  showSenderName,
  photoUrl,
  deliveryStatus,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showSenderName: boolean;
  photoUrl?: string;
  deliveryStatus?: MessageDeliveryStatus;
}) {
  const bubbleBase = isOwn
    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-br-sm shadow-lg shadow-indigo-900/20"
    : "bg-[#151d38] text-[#e2e8f7] border border-[rgba(99,102,241,0.12)] rounded-2xl rounded-bl-sm";

  const timeClass = isOwn ? "text-indigo-200/70" : "text-[#6b7fa8]";

  const content = (
    <>
      {message.messageType === "image" && message.mediaUrl ? (
        <div>
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={message.mediaUrl}
              alt={message.content || "Image"}
              className="max-w-[240px] max-h-56 rounded-xl object-cover"
            />
          </a>
          {message.content && message.content !== message.fileName && (
            <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      ) : message.messageType === "file" && message.mediaUrl ? (
        <ChatFileAttachment message={message} isOwn={isOwn} timeClass={timeClass} />
      ) : (
        <LinkifyText text={message.content} isOwn={isOwn} />
      )}
      <div className={`flex items-center justify-end gap-1.5 mt-1 ${timeClass}`}>
        {message.isBroadcast && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-['Geist_Mono'] opacity-80">
            <Megaphone size={9} /> Broadcast
          </span>
        )}
        <span className="text-[10px] font-['Geist_Mono']">{formatMessageTime(message.createdAt)}</span>
        {isOwn && deliveryStatus && <MessageStatusTicks status={deliveryStatus} />}
      </div>
    </>
  );

  if (isOwn) {
    return (
      <div className="flex justify-end items-end gap-2.5 pl-12">
        <div className={`max-w-[78%] px-3.5 py-2.5 ${bubbleBase}`}>{content}</div>
        <Avatar
          initials={initialsFromName(message.senderName)}
          src={photoUrl || undefined}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2.5 pr-12">
      <Avatar
        initials={initialsFromName(message.senderName)}
        src={photoUrl || undefined}
        size="sm"
      />
      <div className="min-w-0 max-w-[78%]">
        {showSenderName && (
          <p className="text-[11px] font-semibold text-indigo-300 mb-1 font-['Plus_Jakarta_Sans'] px-1">
            {message.senderName}
          </p>
        )}
        <div className={`px-3.5 py-2.5 ${bubbleBase}`}>{content}</div>
      </div>
    </div>
  );
}

export function ChatView({
  userName = "",
  userEmail = "",
  userRole = "employee",
}: {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}) {
  const { data: profiles } = useEmployeeProfiles();
  const currentUser = useMemo(
    () => findProfileForUser(profiles, userName, userEmail) ?? profiles[0],
    [profiles, userName, userEmail]
  );

  const {
    data: channels,
    loading: channelsLoading,
    error: channelsError,
    refresh: refreshChannels,
  } = useChatChannels(currentUser?.id ?? "");

  const [activeTab, setActiveTab] = useState<ChatTab>("dm");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatChannels = useMemo(
    () => channels.filter(c => c.channelType === "dm" || c.channelType === "group"),
    [channels]
  );

  const tabChannels = useMemo(
    () => chatChannels.filter(c => c.channelType === activeTab),
    [chatChannels, activeTab]
  );

  const activeChannel = useMemo(
    () => chatChannels.find(c => c.id === activeChannelId) ?? tabChannels[0] ?? null,
    [chatChannels, activeChannelId, tabChannels]
  );

  const {
    data: messages,
    loading: messagesLoading,
    error: messagesError,
    appendMessage,
    replaceMessage,
    patchMessage,
  } = useChatMessages(activeChannel?.id ?? null);

  const { data: channelReadStates, refresh: refreshReadStates } = useChatChannelReads(activeChannel?.id ?? null);
  const { data: unreadCounts, refresh: refreshUnread } = useChatUnreadCounts(currentUser?.id ?? "");

  const tablesMissing = channelsError ? isMissingChatTables(channelsError) : false;
  const cloudinaryReady = isCloudinaryConfigured();

  const otherProfiles = useMemo(
    () => profiles.filter(p => p.id !== currentUser?.id),
    [profiles, currentUser?.id]
  );

  const memberCount = activeChannel?.memberIds.length || 0;

  const activeDmPeer = useMemo(() => {
    if (!activeChannel || activeChannel.channelType !== "dm" || !currentUser) return undefined;
    return profiles.find(
      p => activeChannel.memberIds.includes(p.id) && p.id !== currentUser.id
    );
  }, [activeChannel, currentUser, profiles]);

  useEffect(() => {
    if (tabChannels.length > 0) {
      const stillVisible = tabChannels.some(c => c.id === activeChannelId);
      if (!stillVisible) setActiveChannelId(tabChannels[0].id);
    } else {
      setActiveChannelId(null);
    }
  }, [tabChannels, activeChannelId]);

  useEffect(() => {
    if (!activeChannel?.id || !currentUser?.id) return;
    markChatChannelRead(activeChannel.id, currentUser.id)
      .then(() => {
        refreshUnread({ silent: true });
        refreshReadStates();
      })
      .catch(() => {});
  }, [activeChannel?.id, currentUser?.id, messages.length, refreshUnread, refreshReadStates]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages.length, activeChannel?.id]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      m =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.fileName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const totalUnread = useMemo(
    () => chatChannels.reduce((sum, ch) => sum + (unreadCounts[ch.id] ?? 0), 0),
    [chatChannels, unreadCounts]
  );

  const tabUnread = useMemo(() => {
    const counts: Record<ChatTab, number> = { group: 0, dm: 0 };
    for (const ch of chatChannels) {
      counts[ch.channelType as ChatTab] += unreadCounts[ch.id] ?? 0;
    }
    return counts;
  }, [chatChannels, unreadCounts]);

  async function handleSend() {
    if (!activeChannel || !currentUser || !msg.trim()) return;
    const text = msg.trim();
    const outgoing = resolveOutgoingMessage(text);
    const optimistic = buildOptimisticMessage(activeChannel.id, currentUser, {
      content: outgoing.content,
      messageType: outgoing.messageType,
      mediaUrl: outgoing.mediaUrl || "",
      mediaType: "",
      fileName: outgoing.fileName || "",
      fileSize: 0,
    });
    setSending(true);
    setSendError("");
    setMsg("");
    appendMessage(optimistic);
    try {
      const sent = await sendChatMessage({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: outgoing.content,
        messageType: outgoing.messageType,
        mediaUrl: outgoing.mediaUrl,
        fileName: outgoing.fileName,
        isBroadcast: false,
      });
      replaceMessage(optimistic.id, sent);
      refreshUnread({ silent: true });
    } catch (err) {
      patchMessage(optimistic.id, { clientStatus: "failed" });
      setMsg(text);
      setSendError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeChannel || !currentUser) return;

    const isImage = file.type.startsWith("image/");
    if (isImage && !cloudinaryReady) {
      setSendError("Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env");
      return;
    }

    setUploading(true);
    setSendError("");
    const caption = msg.trim() || file.name;
    const optimistic = buildOptimisticMessage(activeChannel.id, currentUser, {
      content: caption,
      messageType: isImage ? "image" : "file",
      mediaUrl: "",
      mediaType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
    appendMessage(optimistic);
    try {
      const uploaded = await uploadChatAttachment(file);
      const sent = await sendChatMessage({
        channelId: activeChannel.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: caption,
        messageType: isImage ? "image" : "file",
        mediaUrl: uploaded.url,
        mediaType: file.type,
        fileName: file.name,
        fileSize: uploaded.bytes || file.size,
      });
      setMsg("");
      replaceMessage(optimistic.id, sent);
      refreshUnread({ silent: true });
    } catch (err) {
      patchMessage(optimistic.id, { clientStatus: "failed" });
      setSendError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function selectChannel(channel: ChatChannel) {
    setActiveChannelId(channel.id);
    if (channel.channelType === "dm" || channel.channelType === "group") {
      setActiveTab(channel.channelType);
    }
    setSearchQuery("");
    setSearchOpen(false);
  }

  async function handleCreateGroup() {
    if (!currentUser || !groupName.trim()) return;
    setCreating(true);
    setSendError("");
    try {
      const channel = await createGroupChannel({
        name: groupName.trim(),
        createdBy: currentUser.id,
        memberIds: groupMembers,
      });
      setShowNewGroup(false);
      setGroupName("");
      setGroupMembers([]);
      setActiveTab("group");
      setActiveChannelId(channel.id);
      refreshChannels();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  async function handleStartDm(peerId: string) {
    if (!currentUser) return;
    const peer = profiles.find(p => p.id === peerId);
    if (!peer) return;
    setCreating(true);
    setSendError("");
    try {
      const channel = await findOrCreateDmChannel({
        userId: currentUser.id,
        peerId: peer.id,
        userName: currentUser.name,
        peerName: peer.name,
      });
      setShowNewDm(false);
      setActiveTab("dm");
      setActiveChannelId(channel.id);
      refreshChannels();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setCreating(false);
    }
  }

  function toggleGroupMember(userId: string) {
    setGroupMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  if (channelsLoading && chatChannels.length === 0) return <DataLoading label="Loading chat..." />;
  if (channelsError && !tablesMissing) return <DataError message={channelsError} />;

  const displayName = currentUser?.name || userName || "You";
  const displayInitials = initialsFromName(displayName);
  const statusLabel = currentUser?.status === "active" ? "Online" : currentUser?.status || "Online";
  const HeaderIcon = activeChannel ? channelIcon(activeChannel.channelType) : MessageCircle;
  const channelTitle = activeChannel?.displayName ?? "Select a chat";

  const tabs: { id: ChatTab; label: string }[] = [
    { id: "dm", label: "Direct" },
    { id: "group", label: "Groups" },
  ];

  return (
    <div className="space-y-0">
      {tablesMissing && <ChatSetupBanner />}
      {!cloudinaryReady && !tablesMissing && (
        <div className="mb-4 p-3 rounded-xl border border-sky-500/25 bg-sky-500/10">
          <p className="text-xs text-sky-200 font-['Geist_Mono']">
            Add Cloudinary env vars to send images and files in chat.
          </p>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <div className="w-56 bg-[#080c1f] border border-[rgba(99,102,241,0.1)] rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-[rgba(99,102,241,0.1)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">Messages</p>
              {totalUnread > 0 && (
                <span className="text-[10px] font-['Geist_Mono'] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-1.5 py-1.5 rounded-md text-[10px] font-['Geist_Mono'] transition-colors relative ${
                    activeTab === tab.id
                      ? "bg-indigo-600/25 text-indigo-300"
                      : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"
                  }`}
                >
                  {tab.label}
                  {tabUnread[tab.id] > 0 && (
                    <span className="absolute -top-1 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-2 py-2 border-b border-[rgba(99,102,241,0.08)]">
            {activeTab === "group" && (
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-['Geist_Mono'] text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 transition-colors"
              >
                <Plus size={12} /> New group
              </button>
            )}
            {activeTab === "dm" && (
              <button
                type="button"
                onClick={() => setShowNewDm(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-['Geist_Mono'] text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 transition-colors"
              >
                <UserPlus size={12} /> New message
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {tabChannels.map(ch => {
              const unread = unreadCounts[ch.id] ?? 0;
              const isActive = activeChannel?.id === ch.id;
              const Icon = channelIcon(ch.channelType);
              const label = ch.displayName;
              const peerProfile =
                ch.channelType === "dm"
                  ? profiles.find(
                      p =>
                        ch.memberIds.includes(p.id) &&
                        p.id !== currentUser?.id
                    )
                  : undefined;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChannel(ch)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-['Geist_Mono'] transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-[#6b7fa8] hover:text-[#a8b5d1] hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    {ch.channelType === "dm" ? (
                      <Avatar
                        initials={initialsFromName(label)}
                        src={peerProfile?.profileImageUrl || undefined}
                        size="sm"
                      />
                    ) : (
                      <Icon size={12} className="shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </span>
                  {unread > 0 && !isActive && (
                    <span className="shrink-0 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
            {tabChannels.length === 0 && !tablesMissing && (
              <p className="px-3 py-4 text-[10px] text-[#6b7fa8] font-['Geist_Mono'] text-center">
                {activeTab === "dm" && "No direct messages yet"}
                {activeTab === "group" && "No groups yet — create one"}
              </p>
            )}
          </div>

          <div className="p-3 border-t border-[rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-2 p-2 bg-[#131a35] rounded-lg">
              <Avatar
                initials={displayInitials}
                src={currentUser?.profileImageUrl || undefined}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-emerald-400 font-['Geist_Mono']">● {statusLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[rgba(99,102,241,0.1)] flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {activeChannel?.channelType === "dm" && activeDmPeer ? (
                <Avatar
                  initials={initialsFromName(activeDmPeer.name)}
                  src={activeDmPeer.profileImageUrl || undefined}
                  size="sm"
                />
              ) : (
                <HeaderIcon size={15} className="text-indigo-400 shrink-0" />
              )}
              <span className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">
                {channelTitle}
              </span>
              {activeChannel && (
                <span className="text-[10px] font-['Geist_Mono'] text-[#6b7fa8] shrink-0">
                  · {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {searchOpen ? (
                <div className="flex items-center gap-1 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg px-2 py-1">
                  <Search size={13} className="text-[#6b7fa8]" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="bg-transparent text-xs text-[#e2e8f7] outline-none w-36 font-['Plus_Jakarta_Sans']"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="text-[#6b7fa8] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white"
                  title="Search messages"
                >
                  <Search size={14} />
                </button>
              )}
              {activeChannel?.channelType === "dm" && currentUser?.phone && (
                <a
                  href={`tel:${currentUser.phone}`}
                  className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white"
                  title="Call"
                >
                  <Phone size={14} />
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-[#080c1a]/50">
            {messagesLoading && messages.length === 0 && (
              <DataLoading label="Loading messages..." />
            )}
            {messagesError && !isMissingChatTables(messagesError) && (
              <DataError message={messagesError} />
            )}
            {!messagesLoading && filteredMessages.length === 0 && (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-600/15 flex items-center justify-center">
                  <MessageCircle size={22} className="text-indigo-400" />
                </div>
                <p className="text-sm text-[#a8b5d1] font-['Plus_Jakarta_Sans']">
                  {searchQuery ? "No messages match your search." : "No messages yet. Say hello!"}
                </p>
              </div>
            )}
            {filteredMessages.map(m => {
              const isOwn = Boolean(
                currentUser &&
                  ((m.senderId && m.senderId === currentUser.id) ||
                    namesMatch(m.senderName, currentUser.name))
              );
              const deliveryStatus = isOwn
                ? getMessageDeliveryStatus(m, currentUser!.id, activeChannel, channelReadStates)
                : undefined;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={isOwn}
                  showSenderName={activeChannel?.channelType === "group" && !isOwn}
                  photoUrl={isOwn ? currentUser?.profileImageUrl : profilePhoto(profiles, m.senderId, m.senderName)}
                  deliveryStatus={deliveryStatus}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-[rgba(99,102,241,0.1)] shrink-0 space-y-2">
            {sendError && <p className="text-xs text-rose-400">{sendError}</p>}
            <div className="flex items-center gap-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-3 py-3 focus-within:border-indigo-500/40 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeChannel || tablesMissing || uploading}
                className="p-1.5 hover:bg-white/[0.04] rounded-lg transition-colors text-[#6b7fa8] hover:text-white disabled:opacity-40"
                title="Attach image or file"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeChannel || tablesMissing || uploading}
                placeholder={
                  activeChannel
                    ? `Message ${activeChannel.displayName}`
                    : "Select a chat"
                }
                className="flex-1 bg-transparent text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none font-['Plus_Jakarta_Sans'] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || uploading || !msg.trim() || !activeChannel || tablesMissing}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-white"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Create group</h3>
              <button type="button" onClick={() => setShowNewGroup(false)} className="text-[#6b7fa8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-lg text-sm text-white outline-none focus:border-indigo-500/40"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono'] mb-2">Add members</p>
              {otherProfiles.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(p.id)}
                    onChange={() => toggleGroupMember(p.id)}
                    className="rounded border-indigo-500/40"
                  />
                  <Avatar
                    initials={initialsFromName(p.name)}
                    src={p.profileImageUrl || undefined}
                    size="sm"
                  />
                  <span className="text-xs text-white">{p.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white font-['Plus_Jakarta_Sans']"
            >
              {creating ? "Creating..." : "Create group"}
            </button>
          </div>
        </div>
      )}

      {showNewDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#0d1326] border border-[rgba(99,102,241,0.2)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">New message</h3>
              <button type="button" onClick={() => setShowNewDm(false)} className="text-[#6b7fa8] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {otherProfiles.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleStartDm(p.id)}
                  disabled={creating}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.03] text-left disabled:opacity-50"
                >
                  <Avatar
                    initials={initialsFromName(p.name)}
                    src={p.profileImageUrl || undefined}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{p.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
