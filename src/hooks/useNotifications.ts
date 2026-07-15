import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppNotification } from "@/lib/database";
import { requestFirebaseToken } from "@/lib/firebase";
import { playNotificationBeep } from "@/lib/audio";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 30_000;

function notifyIncoming(
  newNotif: AppNotification,
  onNotificationClick?: (n: AppNotification) => void,
) {
  playNotificationBeep(newNotif.type);

  if (newNotif.type === "call") {
    toast.warning(newNotif.title, {
      description: newNotif.message,
      duration: 8000,
    });
  } else {
    toast.info(newNotif.title, {
      description: newNotif.message,
    });
  }

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      const notification = new Notification(newNotif.title, {
        body: newNotif.message,
        icon: "/favicon.ico",
      });
      notification.onclick = () => {
        window.focus();
        onNotificationClick?.(newNotif);
      };
    } catch (e) {
      console.error("Failed to show native notification", e);
    }
  }
}

export function useNotifications(userId?: string, onNotificationClick?: (n: AppNotification) => void) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bootstrappedRef = useRef(false);
  const onClickRef = useRef(onNotificationClick);

  useEffect(() => {
    onClickRef.current = onNotificationClick;
  }, [onNotificationClick]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      bootstrappedRef.current = false;
      return;
    }

    bootstrappedRef.current = false;

    if (typeof window !== "undefined" && "Notification" in window) {
      requestFirebaseToken(userId).catch(console.error);
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return;
      }
      if (data) {
        const rows = data as AppNotification[];
        setNotifications(rows);
        setUnreadCount(rows.filter(n => !n.is_read).length);
        bootstrappedRef.current = true;
      }
    };

    void fetchNotifications();

    const pollId = setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (!bootstrappedRef.current) return;
          const newNotif = payload.new as AppNotification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          notifyIncoming(newNotif, onClickRef.current);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications(prev => {
            const next = prev.map(n => (n.id === updated.id ? updated : n));
            setUnreadCount(next.filter(n => !n.is_read).length);
            return next;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Notifications realtime subscription error:", status, err);
        }
      });

    return () => {
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", userId)
      .eq("is_read", false);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
