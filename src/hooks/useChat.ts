import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CACHE_KEYS, invalidateDataCachePrefix } from "@/lib/dataCache";
import { supabase } from "@/lib/supabase";
import {
  fetchChatChannelReadStates,
  fetchChatChannelsForUser,
  fetchChatMessages,
  fetchChatMessageReactions,
  fetchChatUnreadCounts,
  mapChatMessage,
  subscribeChatReadReceipts,
  type ChatChannel,
  type ChatMessage,
  type DbChatMessage,
} from "@/lib/database";

type RefreshOptions = { silent?: boolean };

function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => void;
};

function useQuery<T>(loader: () => Promise<T>, fallback: T, deps: unknown[] = []): LoadState<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const silentNext = useRef(false);
  const refresh = useCallback((options?: RefreshOptions) => {
    silentNext.current = options?.silent ?? false;
    setTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const silent = silentNext.current;
    silentNext.current = false;
    if (!silent) setLoading(true);
    setError(null);

    loader()
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || "Failed to load chat data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refresh };
}

function useChatRealtimeRefresh(
  channelKey: string,
  userId: string,
  refresh: (options?: RefreshOptions) => void,
  tables: { event: string; table: string }[]
) {
  const instanceId = useId();

  useEffect(() => {
    if (!userId) return;

    const room = supabase.channel(`${channelKey}:${userId}:${instanceId}`);

    for (const { event, table } of tables) {
      room.on(
        "postgres_changes",
        { event: event as "INSERT" | "UPDATE" | "DELETE" | "*", schema: "public", table },
        () => refresh({ silent: true })
      );
    }

    room.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Chat realtime error (${channelKey}):`, status, err);
      }
    });

    return () => {
      supabase.removeChannel(room);
    };
  }, [channelKey, userId, instanceId, refresh, tables]);
}

export function useChatChannels(userId: string) {
  const loader = useCallback(
    () => (userId ? fetchChatChannelsForUser(userId) : Promise.resolve([] as ChatChannel[])),
    [userId]
  );
  const { data, loading, error, refresh } = useQuery(loader, [] as ChatChannel[], [userId]);

  const realtimeTables = useRef([
    { event: "*", table: "chat_channels" },
    { event: "*", table: "chat_channel_members" },
  ]).current;

  useChatRealtimeRefresh("chat-channels", userId, refresh, realtimeTables);

  return { data, loading, error, refresh };
}

export function useChatUnreadCounts(userId: string) {
  const loader = useCallback(
    () => (userId ? fetchChatUnreadCounts(userId) : Promise.resolve({} as Record<string, number>)),
    [userId]
  );
  const { data, loading, error, refresh } = useQuery(
    loader,
    {} as Record<string, number>,
    [userId]
  );

  const realtimeTables = useRef([
    { event: "INSERT", table: "chat_messages" },
    { event: "*", table: "chat_channel_reads" },
  ]).current;

  useChatRealtimeRefresh("chat-unread", userId, () => {
    invalidateDataCachePrefix(`${CACHE_KEYS.chatUnread}:`);
    refresh({ silent: true });
  }, realtimeTables);

  return { data, loading, error, refresh };
}

const CHAT_POLL_INTERVAL_MS = 5_000;

function mergeChatMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!prev.length) return sortChatMessages(incoming);
  const byId = new Map(prev.map(m => [m.id, m]));
  let changed = prev.length !== incoming.length;
  for (const message of incoming) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
      changed = true;
    }
  }
  return changed ? sortChatMessages(Array.from(byId.values())) : prev;
}

export function useChatMessages(channelId: string | null) {
  const [data, setData] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(channelId));
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(channelId);
  const instanceId = useId();

  const load = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const messages = await fetchChatMessages(id);
      if (channelIdRef.current !== id) return;
      setData(prev => (silent ? mergeChatMessages(prev, messages) : sortChatMessages(messages)));
    } catch (err) {
      if (channelIdRef.current === id) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    } finally {
      if (channelIdRef.current === id && !silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (channelId) load(channelId, true);
  }, [channelId, load]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setData(prev =>
      prev.some(m => m.id === message.id) ? prev : sortChatMessages([...prev, message])
    );
  }, []);

  const replaceMessage = useCallback((tempId: string, message: ChatMessage) => {
    setData(prev => {
      const idx = prev.findIndex(m => m.id === tempId);
      if (idx === -1) return prev.some(m => m.id === message.id) ? prev : [...prev, message];
      
      // Check if realtime already added the final message
      const existingIdx = prev.findIndex(m => m.id === message.id);
      if (existingIdx !== -1 && existingIdx !== idx) {
        // Realtime won the race, remove the optimistic temp message
        return prev.filter(m => m.id !== tempId);
      }

      const next = [...prev];
      next[idx] = message;
      return sortChatMessages(next);
    });
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setData(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  useEffect(() => {
    channelIdRef.current = channelId;
    if (!channelId) {
      setData([]);
      setLoading(false);
      return;
    }

    load(channelId);

    const pollId = setInterval(() => {
      if (channelIdRef.current === channelId) void load(channelId, true);
    }, CHAT_POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible" && channelIdRef.current === channelId) {
        void load(channelId, true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const room = supabase
      .channel(`chat-messages:${channelId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        payload => {
          const row = payload.new as DbChatMessage;
          if (row.channel_id !== channelIdRef.current) return;
          const message = mapChatMessage(row);
          setData(prev =>
            prev.some(m => m.id === message.id) ? prev : sortChatMessages([...prev, message])
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_reactions",
        },
        payload => {
          const messageId =
            (payload.new as { message_id?: string } | null)?.message_id ||
            (payload.old as { message_id?: string } | null)?.message_id;
          if (!messageId) return;
          void fetchChatMessageReactions(messageId)
            .then(reactions => {
              if (channelIdRef.current !== channelId) return;
              setData(prev =>
                prev.map(m => (m.id === messageId ? { ...m, reactions } : m))
              );
            })
            .catch(() => {});
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Chat messages realtime subscription error:", status, err);
        }
      });

    return () => {
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(room);
    };
  }, [channelId, instanceId, load]);

  return { data, loading, error, refresh, appendMessage, replaceMessage, patchMessage };
}

export function useChatChannelReads(channelId: string | null) {
  const [data, setData] = useState<Record<string, string>>({});

  const load = useCallback(async (id: string) => {
    try {
      setData(await fetchChatChannelReadStates(id));
    } catch {
      setData({});
    }
  }, []);

  const applyRead = useCallback((userId: string, lastReadAt: string) => {
    setData(prev => {
      const prevAt = prev[userId];
      if (prevAt && new Date(prevAt).getTime() >= new Date(lastReadAt).getTime()) return prev;
      return { ...prev, [userId]: lastReadAt };
    });
  }, []);

  useEffect(() => {
    if (!channelId) {
      setData({});
      return;
    }

    load(channelId);

    const unsubscribe = subscribeChatReadReceipts(channelId, applyRead);
    return unsubscribe;
  }, [channelId, load, applyRead]);

  const refresh = useCallback(() => {
    if (channelId) load(channelId);
  }, [channelId, load]);

  return { data, refresh };
}
