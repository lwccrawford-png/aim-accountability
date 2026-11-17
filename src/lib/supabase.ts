"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null when no project is configured: the app runs device-only. */
export const supabase: SupabaseClient | null =
  url && key && typeof window !== "undefined"
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
    : null;

export const accountsEnabled = Boolean(url && key);

// Dev-only handle for local testing in the browser console. Never in production builds.
if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && supabase) {
  (window as unknown as { __sb?: SupabaseClient }).__sb = supabase;
}
