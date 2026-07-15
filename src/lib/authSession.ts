import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function sessionStillValid(session: Session, minTtlMs = 60_000) {
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  return expiresAt === 0 || expiresAt - Date.now() > minTtlMs;
}

/** Load session from storage; refresh access token only when a session already exists. */
export async function restoreSupabaseSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.warn("getSession failed:", error.message);
    if (!session?.user) return null;
    if (sessionStillValid(session)) return session;

    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn("refreshSession failed:", refreshError.message);
      return session;
    }
    return refreshed?.user ? refreshed : session;
  } catch (err) {
    console.warn("restoreSupabaseSession error:", err);
    return null;
  }
}

/** Keep session alive when tab wakes up after sleep/background. */
export async function refreshSupabaseSessionIfNeeded(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const expiresSoon = expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000;
    if (!expiresSoon) return session;

    const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn("refreshSession failed:", error.message);
      return session;
    }
    return refreshed?.user ? refreshed : session;
  } catch (err) {
    console.warn("refreshSupabaseSessionIfNeeded error:", err);
    return null;
  }
}
