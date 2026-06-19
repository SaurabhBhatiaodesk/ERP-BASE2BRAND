import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppNotification } from "@/lib/database";
import { requestFirebaseToken } from "@/lib/firebase";

export function useNotifications(userId?: string, onNotificationClick?: (n: AppNotification) => void) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Request browser notification permissions and get FCM token
    if (typeof window !== "undefined" && "Notification" in window) {
      // NOTE: You must replace 'YOUR_VAPID_KEY_HERE' with the actual Web Push Certificate key from Firebase Console
      requestFirebaseToken(userId, "BFsN6ecy2D12X0vjN6zIt8BtV50Q4uGhmk9Dd3mZElGvXzRqxP5ROx1ZK5adB_YYbTU57H_h7CijF4QXF9hxKyk");
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as AppNotification[]);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

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
          const newNotif = payload.new as AppNotification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Trigger native browser notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const notification = new Notification(newNotif.title, {
                body: newNotif.message,
                icon: "/favicon.ico", // Or appropriate icon
              });
              notification.onclick = () => {
                window.focus();
                if (onNotificationClick) {
                  onNotificationClick(newNotif);
                }
              };
            } catch (e) {
              console.error("Failed to show native notification", e);
            }
          }
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
          setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
          
          // Re-calculate unread
          setNotifications(prev => {
             setUnreadCount(prev.filter(n => !n.is_read).length);
             return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
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
    markAllAsRead
  };
}
