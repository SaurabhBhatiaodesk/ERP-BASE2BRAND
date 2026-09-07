import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart, MessageCircle, Image as ImageIcon, X, Trash2, Search, Check,
  Send, Loader2, Users, Building2, CornerDownRight, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { isAdminRole } from "@/lib/auth";
import { useEmployeeProfiles } from "@/hooks/useSupabaseData";
import {
  fetchFeedPosts, createFeedPost, deleteFeedPost, toggleFeedPostLike,
  fetchFeedComments, createFeedComment, deleteFeedComment, toggleFeedCommentLike,
  initialsFromName,
  type FeedPost, type FeedComment, type EmployeeProfile,
} from "@/lib/database";
import { Avatar } from "../ui";
import { DataEmpty, DataError, DataLoading } from "../ui/DataStatus";

// ── Styles (matches MeetingView/InvoicingView/PayrollView convention) ─────
const cardCls = "bg-[#0d1326] border border-[rgba(99,102,241,0.12)] rounded-xl";
const inputCls =
  "w-full bg-[#131a35] border border-[rgba(99,102,241,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none focus:border-indigo-500/50 transition-colors font-['Plus_Jakarta_Sans']";
const labelCls = "block text-xs font-semibold text-[#6b7fa8] mb-1.5 uppercase tracking-wide font-['Geist_Mono']";
const btnPrimary =
  "flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-900/30 font-['Plus_Jakarta_Sans'] disabled:opacity-50";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function FeedView({
  userRole, userId, userName,
}: {
  userRole: string;
  userId?: string;
  userName?: string;
}) {
  const { data: profiles } = useEmployeeProfiles();
  const viewerProfile = useMemo(() => profiles.find(p => p.id === userId), [profiles, userId]);
  const viewerDept = viewerProfile?.dept ?? "";
  const admin = isAdminRole(userRole);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchFeedPosts(userId, viewerDept);
      setPosts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, [userId, viewerDept]);

  useEffect(() => { void load(); }, [load]);

  const loadComments = useCallback(async (postId: string) => {
    if (!userId) return;
    setCommentsLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const rows = await fetchFeedComments(postId, userId);
      setCommentsByPost(prev => ({ ...prev, [postId]: rows }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load comments.");
    } finally {
      setCommentsLoading(prev => ({ ...prev, [postId]: false }));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("feed-module")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_post_likes" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comments" }, () => {
        void load();
        setExpandedPostId(current => { if (current) void loadComments(current); return current; });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comment_likes" }, () => {
        setExpandedPostId(current => { if (current) void loadComments(current); return current; });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load, loadComments]);

  function toggleThread(postId: string) {
    setExpandedPostId(prev => {
      const next = prev === postId ? null : postId;
      if (next && !commentsByPost[next]) void loadComments(next);
      return next;
    });
  }

  async function handleLikePost(post: FeedPost) {
    if (!userId) return;
    // Optimistic flip so the heart responds instantly — realtime will reconcile shortly after.
    setPosts(prev => prev.map(p => p.id === post.id
      ? { ...p, likedByViewer: !p.likedByViewer, likeCount: p.likeCount + (p.likedByViewer ? -1 : 1) }
      : p));
    try {
      await toggleFeedPostLike(post.id, userId);
    } catch {
      toast.error("Failed to like post.");
      void load();
    }
  }

  async function handleDeletePost(post: FeedPost) {
    if (!(post.authorId === userId || admin)) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const ok = await deleteFeedPost(post.id);
    if (ok) { toast.success("Post deleted."); void load(); }
    else toast.error("Failed to delete post.");
  }

  if (!userId) return <DataLoading label="Loading your profile..." />;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <FeedComposer
        profiles={profiles}
        viewerProfile={viewerProfile}
        userId={userId}
        userName={userName || viewerProfile?.name || "Someone"}
        onPosted={load}
      />

      {error && <DataError message={error} />}
      {loading && posts.length === 0 ? (
        <DataLoading label="Loading feed..." />
      ) : posts.length === 0 ? (
        <DataEmpty message="No posts yet — be the first to share something." />
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <FeedPostCard
              key={post.id}
              post={post}
              profiles={profiles}
              viewerId={userId}
              admin={admin}
              expanded={expandedPostId === post.id}
              comments={commentsByPost[post.id] ?? []}
              commentsLoading={!!commentsLoading[post.id]}
              onToggleThread={() => toggleThread(post.id)}
              onLike={() => void handleLikePost(post)}
              onDelete={() => void handleDeletePost(post)}
              onMutatedComments={() => { void loadComments(post.id); void load(); }}
              userRole={userRole}
              userName={userName || viewerProfile?.name || "Someone"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────────
function FeedComposer({
  profiles, viewerProfile, userId, userName, onPosted,
}: {
  profiles: EmployeeProfile[];
  viewerProfile: EmployeeProfile | undefined;
  userId: string;
  userName: string;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [posting, setPosting] = useState(false);

  const [showTagUsers, setShowTagUsers] = useState(false);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const [showTagDepts, setShowTagDepts] = useState(false);
  const [taggedDepartments, setTaggedDepartments] = useState<string[]>([]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) { if (p.dept && p.dept !== "Executive") set.add(p.dept); }
    return [...set].sort();
  }, [profiles]);

  const filteredProfiles = useMemo(() =>
    profiles.filter(p => p.id !== userId && p.name.toLowerCase().includes(userSearch.toLowerCase())),
  [profiles, userId, userSearch]);

  function toggleTaggedUser(id: string) {
    setTaggedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleTaggedDept(dept: string) {
    setTaggedDepartments(prev => prev.includes(dept) ? prev.filter(x => x !== dept) : [...prev, dept]);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingCount(c => c + files.length);
    for (const file of files) {
      try {
        const uploaded = await uploadToCloudinary(file, "base2brand-feed");
        setAttachmentUrls(prev => [...prev, uploaded.url]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Image upload failed.");
      } finally {
        setUploadingCount(c => c - 1);
      }
    }
  }
  function removeAttachment(url: string) {
    setAttachmentUrls(prev => prev.filter(u => u !== url));
  }

  const isTargeted = taggedUserIds.length > 0 || taggedDepartments.length > 0;

  async function handlePost() {
    if (!title.trim()) { toast.error("Add a title."); return; }
    setPosting(true);
    try {
      const created = await createFeedPost({
        authorId: userId,
        authorName: userName,
        authorAvatarUrl: viewerProfile?.profileImageUrl || undefined,
        title: title.trim(),
        body: body.trim(),
        attachmentUrls,
        taggedUserIds,
        taggedDepartments,
      });
      if (!created) { toast.error("Failed to post."); return; }
      toast.success("Posted to the feed!");
      setTitle(""); setBody(""); setAttachmentUrls([]);
      setTaggedUserIds([]); setTaggedDepartments([]);
      setShowTagUsers(false); setShowTagDepts(false);
      onPosted();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={`${cardCls} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <Avatar initials={initialsFromName(userName)} src={viewerProfile?.profileImageUrl || undefined} size="md" />
        <div className="flex-1 min-w-0 space-y-2">
          <input
            className={inputCls}
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder="Write something..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>
      </div>

      {attachmentUrls.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-[52px]">
          {attachmentUrls.map(url => (
            <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[rgba(99,102,241,0.15)]">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeAttachment(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showTagUsers && (
        <div className="pl-[52px] space-y-2">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7fa8]" />
              <input
                className="w-full bg-transparent pl-8 pr-4 py-2 text-xs text-[#e2e8f7] placeholder:text-[#6b7fa8] outline-none border-b border-[rgba(99,102,241,0.12)] font-['Plus_Jakarta_Sans']"
                placeholder="Search employees to tag"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[140px] overflow-y-auto">
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#6b7fa8]">No employees found</div>
              ) : (
                filteredProfiles.map(p => {
                  const selected = taggedUserIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleTaggedUser(p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors ${selected ? "bg-indigo-600/10" : ""}`}
                    >
                      <Avatar initials={initialsFromName(p.name)} src={p.profileImageUrl || undefined} size="sm" />
                      <span className="flex-1 min-w-0 text-xs text-[#e2e8f7] font-['Plus_Jakarta_Sans'] truncate">{p.name}</span>
                      {selected && <Check size={13} className="text-indigo-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {taggedUserIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-[52px]">
          {taggedUserIds.map(id => {
            const prof = profiles.find(p => p.id === id);
            if (!prof) return null;
            return (
              <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600/15 border border-indigo-500/20 rounded-full text-xs text-indigo-300 font-['Plus_Jakarta_Sans']">
                {prof.name}
                <button onClick={() => toggleTaggedUser(id)} className="hover:text-white"><X size={10} /></button>
              </span>
            );
          })}
        </div>
      )}

      {showTagDepts && (
        <div className="pl-[52px] flex flex-wrap gap-1.5">
          {departmentOptions.map(dept => {
            const selected = taggedDepartments.includes(dept);
            return (
              <button
                key={dept}
                onClick={() => toggleTaggedDept(dept)}
                className={`px-2.5 py-1 rounded-full text-xs font-['Plus_Jakarta_Sans'] border transition-colors ${
                  selected
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                    : "bg-[#131a35] border-[rgba(99,102,241,0.15)] text-[#a8b5d1] hover:border-violet-500/30"
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>
      )}

      {isTargeted && (
        <p className="pl-[52px] text-[11px] text-amber-400/90 font-['Plus_Jakarta_Sans'] flex items-center gap-1.5">
          <Tag size={11} /> Only visible to tagged people{taggedDepartments.length > 0 ? " and department members" : ""} — not the whole company.
        </p>
      )}

      <div className="flex items-center justify-between pl-[52px] pt-1">
        <div className="flex items-center gap-1">
          <label className="p-2 rounded-lg text-[#6b7fa8] hover:text-indigo-300 hover:bg-white/[0.05] cursor-pointer transition-colors" title="Add images">
            <ImageIcon size={17} />
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => void handleFiles(e)} />
          </label>
          <button
            onClick={() => setShowTagUsers(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showTagUsers ? "text-indigo-300 bg-indigo-500/10" : "text-[#6b7fa8] hover:text-indigo-300 hover:bg-white/[0.05]"}`}
            title="Tag people"
          >
            <Users size={17} />
          </button>
          <button
            onClick={() => setShowTagDepts(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showTagDepts ? "text-violet-300 bg-violet-500/10" : "text-[#6b7fa8] hover:text-violet-300 hover:bg-white/[0.05]"}`}
            title="Tag departments"
          >
            <Building2 size={17} />
          </button>
          {uploadingCount > 0 && <Loader2 size={14} className="animate-spin text-[#6b7fa8] ml-1" />}
        </div>
        <button onClick={() => void handlePost()} disabled={posting || uploadingCount > 0} className={btnPrimary}>
          {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post
        </button>
      </div>
    </div>
  );
}

// ── Post card ───────────────────────────────────────────────────
function FeedPostCard({
  post, profiles, viewerId, admin, expanded, comments, commentsLoading,
  onToggleThread, onLike, onDelete, onMutatedComments, userRole, userName,
}: {
  post: FeedPost;
  profiles: EmployeeProfile[];
  viewerId: string;
  admin: boolean;
  expanded: boolean;
  comments: FeedComment[];
  commentsLoading: boolean;
  onToggleThread: () => void;
  onLike: () => void;
  onDelete: () => void;
  onMutatedComments: () => void;
  userRole: string;
  userName: string;
}) {
  const isTargeted = post.taggedUserIds.length > 0 || post.taggedDepartments.length > 0;
  const targetLabels = [
    ...post.taggedUserIds.map(id => profiles.find(p => p.id === id)?.name).filter(Boolean),
    ...post.taggedDepartments,
  ] as string[];
  const canDelete = post.authorId === viewerId || admin;

  return (
    <div className={`${cardCls} p-4`}>
      <div className="flex items-start gap-3">
        <Avatar initials={initialsFromName(post.authorName)} src={post.authorAvatarUrl || undefined} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans'] truncate">{post.authorName}</p>
              <p className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{timeAgo(post.createdAt)}</p>
            </div>
            {canDelete && (
              <button onClick={onDelete} className="p-1.5 rounded-lg text-[#6b7fa8] hover:text-rose-400 hover:bg-rose-500/10 shrink-0" title="Delete post">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {post.title && <h3 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans'] mt-2">{post.title}</h3>}
          {post.body && <p className="text-sm text-[#a8b5d1] font-['Plus_Jakarta_Sans'] mt-1 whitespace-pre-wrap">{post.body}</p>}

          {post.attachmentUrls.length > 0 && (
            <div className={`mt-3 grid gap-1.5 ${post.attachmentUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {post.attachmentUrls.map(url => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-[rgba(99,102,241,0.12)]">
                  <img src={url} alt="" className="w-full max-h-80 object-cover" />
                </a>
              ))}
            </div>
          )}

          {isTargeted && (
            <p className="mt-2.5 text-[11px] text-amber-400/90 font-['Plus_Jakarta_Sans'] flex items-center gap-1.5">
              <Tag size={11} /> Private to: {targetLabels.join(", ")}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[rgba(99,102,241,0.08)]">
            <button onClick={onLike} className={`flex items-center gap-1.5 text-xs font-['Plus_Jakarta_Sans'] transition-colors ${post.likedByViewer ? "text-rose-400" : "text-[#6b7fa8] hover:text-rose-400"}`}>
              <Heart size={15} fill={post.likedByViewer ? "currentColor" : "none"} /> {post.likeCount > 0 ? post.likeCount : ""} Like
            </button>
            <button onClick={onToggleThread} className={`flex items-center gap-1.5 text-xs font-['Plus_Jakarta_Sans'] transition-colors ${expanded ? "text-indigo-400" : "text-[#6b7fa8] hover:text-indigo-400"}`}>
              <MessageCircle size={15} /> {post.commentCount > 0 ? post.commentCount : ""} Comment
            </button>
          </div>

          {expanded && (
            <FeedCommentThread
              postId={post.id}
              comments={comments}
              loading={commentsLoading}
              viewerId={viewerId}
              viewerName={userName}
              userRole={userRole}
              admin={admin}
              onMutated={onMutatedComments}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Comment thread (top-level comments + one level of replies) ────
function FeedCommentThread({
  postId, comments, loading, viewerId, viewerName, admin, onMutated,
}: {
  postId: string;
  comments: FeedComment[];
  loading: boolean;
  viewerId: string;
  viewerName: string;
  userRole: string;
  admin: boolean;
  onMutated: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);

  const topLevel = comments.filter(c => !c.parentCommentId);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, FeedComment[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = map.get(c.parentCommentId) ?? [];
        list.push(c);
        map.set(c.parentCommentId, list);
      }
    }
    return map;
  }, [comments]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const ok = await createFeedComment({
        postId, parentCommentId: replyTo?.id ?? null,
        authorId: viewerId, authorName: viewerName, body: draft,
      });
      if (ok) { setDraft(""); setReplyTo(null); onMutated(); }
      else toast.error("Failed to post comment.");
    } finally {
      setSending(false);
    }
  }

  async function handleLikeComment(commentId: string) {
    try { await toggleFeedCommentLike(commentId, viewerId); onMutated(); }
    catch { toast.error("Failed to like comment."); }
  }

  async function handleDeleteComment(comment: FeedComment) {
    if (!(comment.authorId === viewerId || admin)) return;
    if (!confirm("Delete this comment?")) return;
    const ok = await deleteFeedComment(comment.id);
    if (ok) onMutated();
    else toast.error("Failed to delete comment.");
  }

  function CommentRow({ comment, isReply }: { comment: FeedComment; isReply: boolean }) {
    const canDelete = comment.authorId === viewerId || admin;
    return (
      <div className={`flex items-start gap-2.5 ${isReply ? "ml-9 mt-2" : "mt-3"}`}>
        <Avatar initials={initialsFromName(comment.authorName)} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="bg-[#131a35] rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-white font-['Plus_Jakarta_Sans']">{comment.authorName}</p>
            <p className="text-xs text-[#a8b5d1] font-['Plus_Jakarta_Sans'] whitespace-pre-wrap">{comment.body}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 pl-1">
            <span className="text-[10px] text-[#6b7fa8] font-['Geist_Mono']">{timeAgo(comment.createdAt)}</span>
            <button
              onClick={() => void handleLikeComment(comment.id)}
              className={`text-[10px] font-['Plus_Jakarta_Sans'] font-semibold flex items-center gap-1 ${comment.likedByViewer ? "text-rose-400" : "text-[#6b7fa8] hover:text-rose-400"}`}
            >
              <Heart size={10} fill={comment.likedByViewer ? "currentColor" : "none"} /> {comment.likeCount > 0 ? comment.likeCount : "Like"}
            </button>
            {!isReply && (
              <button
                onClick={() => setReplyTo({ id: comment.id, name: comment.authorName })}
                className="text-[10px] font-['Plus_Jakarta_Sans'] font-semibold text-[#6b7fa8] hover:text-indigo-400 flex items-center gap-1"
              >
                <CornerDownRight size={10} /> Reply
              </button>
            )}
            {canDelete && (
              <button onClick={() => void handleDeleteComment(comment)} className="text-[10px] text-[#6b7fa8] hover:text-rose-400">
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(99,102,241,0.08)]">
      {loading ? (
        <p className="text-xs text-[#6b7fa8] font-['Plus_Jakarta_Sans']">Loading comments...</p>
      ) : (
        <div>
          {topLevel.map(comment => (
            <div key={comment.id}>
              <CommentRow comment={comment} isReply={false} />
              {(repliesByParent.get(comment.id) ?? []).map(reply => (
                <CommentRow key={reply.id} comment={reply} isReply />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {replyTo && (
          <div className="flex items-center gap-2 text-[11px] text-indigo-300 font-['Plus_Jakarta_Sans']">
            Replying to {replyTo.name}
            <button onClick={() => setReplyTo(null)} className="text-[#6b7fa8] hover:text-white"><X size={11} /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Avatar initials={initialsFromName(viewerName)} size="sm" />
          <input
            className={`${inputCls} py-2 text-xs`}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Write a comment..."}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
          />
          <button onClick={() => void handleSend()} disabled={sending || !draft.trim()} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shrink-0 transition-colors">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
