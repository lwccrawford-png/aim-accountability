"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Inbox } from "@/lib/notices";
import { supabase } from "@/lib/supabase";

// A small shared cache, so the bell and the notifications page agree and a
// page change doesn't refetch every time.
const EMPTY: Inbox = { unread: 0, items: [] };
const STALE_MS = 30_000;

let inbox: Inbox = EMPTY;
let loadedAt = 0;
let loadedFor = "";
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Inbox) {
  inbox = next;
  listeners.forEach((l) => l());
}

export function refreshInbox(userId: string, force = false): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (loadedFor !== userId) {
    loadedFor = userId;
    loadedAt = 0;
    set(EMPTY);
  }
  if (!force && Date.now() - loadedAt < STALE_MS) return Promise.resolve();
  loading ??= (async () => {
    try {
      const { data, error } = await supabase.rpc("load_notifications");
      if (!error && data && loadedFor === userId) {
        loadedAt = Date.now();
        set(data as Inbox);
      }
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Marks everything read on the server; the list keeps its "new" marks until the next load. */
export async function markInboxRead() {
  if (!supabase || inbox.unread === 0) return;
  const { error } = await supabase.rpc("mark_notifications_read");
  if (!error) set({ ...inbox, unread: 0 });
}

export function clearInbox() {
  loadedFor = "";
  loadedAt = 0;
  set(EMPTY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The signed-in man's notifications. Loads on mount and when the app comes back into view. */
export function useInbox(userId?: string): Inbox {
  const value = useSyncExternalStore(subscribe, () => inbox, () => EMPTY);
  useEffect(() => {
    if (!userId) return;
    void refreshInbox(userId);
    const onFocus = () => void refreshInbox(userId);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId]);
  return userId ? value : EMPTY;
}
