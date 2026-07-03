import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Load session from storage; refresh access token if needed. */
export async function restoreSupabaseSession(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session;
  } catch (err) {
    console.warn("getSession failed, trying refresh:", err);
  }

  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn("refreshSession failed:", error.message);
      return null;
    }
    return session?.user ? session : null;
  } catch (err) {
    console.warn("refreshSession error:", err);
    return null;
  }
}

/** Keep session alive when tab wakes up after sleep/background. */
export async function refreshSupabaseSessionIfNeeded(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;
      if (!expiresSoon) return session;
    }
  } catch {
    /* fall through to refresh */
  }

  return restoreSupabaseSession();
}
