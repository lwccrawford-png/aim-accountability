"use client";

// The Brotherhood feed. Every call goes to the server, which checks that the
// man is signed in with LMTLSS mode on before showing or saving anything.

import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/templates";

/** Hand-off from a goal to the composer, kept in this tab only (never in the URL). */
export const SHARE_DRAFT = "accountability_share_draft";
export interface ShareDraft {
  kind: PostKind;
  headline: string;
  body: string;
}

export function startShare(d: ShareDraft) {
  try {
    window.sessionStorage.setItem(SHARE_DRAFT, JSON.stringify(d));
  } catch {
    /* composer just opens empty */
  }
}

export type PostKind = "win" | "step_of_faith" | "milestone" | "completed";
export type Reaction = "amen" | "proud" | "keep_going";

export interface FeedComment {
  id: string;
  body: string;
  author: string;
  mine: boolean;
  reported?: boolean;
  status: "visible" | "hidden";
  createdAt: string;
  editedAt?: string;
}

export interface Post {
  id: string;
  kind: PostKind;
  headline?: string;
  body: string;
  author: string;
  mine: boolean;
  status: "visible" | "hidden";
  createdAt: string;
  editedAt?: string;
  reactions?: Partial<Record<Reaction, number>>;
  myReactions?: Reaction[];
  reported?: boolean;
  comments: FeedComment[];
}

export interface ReportItem {
  type: "post" | "comment";
  id: string;
  count: number;
  firstAt: string;
  reasons?: string[];
  body?: string;
  headline?: string;
  status?: string;
  author?: string;
}

export const KIND_LABEL: Record<PostKind, string> = {
  win: "Win",
  step_of_faith: "Step of Faith",
  milestone: "Milestone",
  completed: "Finished"
};

export const REACTIONS: { id: Reaction; label: string; glyph: string }[] = [
  { id: "amen", label: "Amen", glyph: "✝" },
  { id: "proud", label: "Proud of you", glyph: "▲" },
  { id: "keep_going", label: "Keep going", glyph: "→" }
];

function friendly(msg: string) {
  if (/LMTLSS mode/.test(msg)) return "Turn on LMTLSS mode in Settings to join the Brotherhood.";
  if (/set your name/.test(msg)) return "Set your name first so brothers know who's sharing.";
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error("Accounts aren't switched on.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export const loadFeed = (before?: string) => rpc<Post[]>("load_feed", { p_before: before ?? null, p_limit: 20 });
export const createPost = (kind: PostKind, body: string, headline?: string, id = uid()) =>
  rpc("create_post", { p_id: id, p_kind: kind, p_body: body, p_headline: headline ?? null });
export const editPost = (id: string, body: string, headline?: string) => rpc("edit_post", { p_id: id, p_body: body, p_headline: headline ?? null });
export const removePost = (id: string) => rpc("remove_post", { p_id: id });
export const react = (post: string, kind: Reaction, on: boolean) => rpc("react", { p_post: post, p_kind: kind, p_on: on });
export const addComment = (post: string, body: string) => rpc("add_comment", { p_id: uid(), p_post: post, p_body: body });
export const editComment = (id: string, body: string) => rpc("edit_comment", { p_id: id, p_body: body });
export const removeComment = (id: string) => rpc("remove_comment", { p_id: id });
export const report = (type: "post" | "comment", id: string, reason?: string) => rpc("report_content", { p_type: type, p_id: id, p_reason: reason ?? null });
export const listReports = () => rpc<ReportItem[]>("list_reports");
export const moderate = (type: "post" | "comment", id: string, action: "hide" | "keep") => rpc("moderate", { p_type: type, p_id: id, p_action: action });
