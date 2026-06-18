import { recordActivityLog } from "@/lib/database";

const STORAGE_KEY = "b2b_quick_actions";

export type QuickActionRecord =
  | { id: string; type: "call"; employee: string; message: string; phone?: string; createdAt: string }
  | { id: string; type: "meeting"; title: string; date: string; time: string; invite: string; createdAt: string }
  | { id: string; type: "broadcast"; message: string; audience: string; createdAt: string };

export type QuickActionInput =
  | { type: "call"; employee: string; message: string; phone?: string }
  | { type: "meeting"; title: string; date: string; time: string; invite: string }
  | { type: "broadcast"; message: string; audience: string };

export function loadQuickActions(): QuickActionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QuickActionRecord[]) : [];
  } catch {
    return [];
  }
}

function saveQuickActionLocal(entry: QuickActionRecord) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...loadQuickActions()]));
}

export async function saveQuickAction(record: QuickActionInput): Promise<QuickActionRecord> {
  const entry = {
    ...record,
    id: `qa-${Date.now()}`,
    createdAt: new Date().toISOString(),
  } as QuickActionRecord;

  try {
    await recordActivityLog(`quick_action.${record.type}`, { ...record });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(
        "[B2B Network] activity_logs API failed — run supabase/activity_logs.sql in Supabase",
        err
      );
    }
  }

  saveQuickActionLocal(entry);
  return entry;
}
