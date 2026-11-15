"use client";

// Partner actions. These need an account and a connection: every one goes
// straight to the server, which checks the partnership, then the app refreshes.

import { compare, nextOccurrenceAfter, todayIn } from "@/lib/dates";
import { getGoal, postUpdate, refresh, saveGoal, type GoalInput } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/templates";
import type { Frequency, Partnership, ShareScope, Suggested } from "@/lib/types";

const PENDING_INVITE = "accountability_pending_invite";

function client() {
  if (!supabase) throw new Error("Accounts aren't switched on.");
  return supabase;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

function friendlyError(msg: string) {
  if (/different email/.test(msg)) return "This invite was sent to a different email. Sign in with the address it was sent to.";
  if (/expired/.test(msg)) return "This invite has expired. Ask him to send a new one.";
  if (/revoked/.test(msg)) return "This invite was taken back.";
  if (/accepted/.test(msg)) return "This invite was already accepted.";
  if (/declined/.test(msg)) return "This invite was declined.";
  if (/yourself/.test(msg)) return "Invite another man, not yourself.";
  if (/sign in/.test(msg)) return "Sign in first.";
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

// ---------- owner ----------

export async function createInvite(goalId: string, email: string, scope: ShareScope) {
  const r = await rpc<{ id: string; token: string; expiresAt: string }>("create_invite", {
    p_goal: goalId,
    p_email: email,
    p_scope: scope
  });
  await refresh();
  return { ...r, link: `${window.location.origin}/invite#${r.token}` };
}

export async function revokeInvite(inviteId: string) {
  await rpc("revoke_invite", { p_invite: inviteId });
  await refresh();
}

export async function endPartnership(goalId: string) {
  await rpc("end_partnership", { p_goal: goalId });
  await refresh();
}

export async function postShared(goalId: string, kind: "question" | "reply" | "suggestion", text: string, suggested?: Suggested) {
  await rpc("post_shared", { p_goal: goalId, p_id: uid(), p_kind: kind, p_text: text, p_suggested: suggested ?? null });
  await refresh();
}

/** Owner accepts a suggestion: its fields go into the goal, then it's marked accepted. */
export async function applySuggestion(goalId: string, entryId: string, s: Suggested, from?: string) {
  const g = getGoal(goalId);
  if (!g) return;
  const input: GoalInput = {
    id: g.id,
    commitment: s.commitment?.trim() || g.commitment,
    nextAction: s.nextAction?.trim() || g.nextAction,
    nextActionDate: s.nextActionDate || g.nextActionDate,
    guided: s.outcome ? { ...g.guided, outcome: s.outcome } : g.guided,
    category: g.category,
    tags: g.tags,
    roomIds: g.roomIds,
    template: g.template,
    milestoneCount: g.milestoneCount,
    tasks: g.tasks,
    milestones: g.milestones,
    description: g.description
  };
  saveGoal(input, false);
  const changed = [s.commitment && "commitment", s.nextAction && "next step", s.outcome && "what done looks like"].filter(Boolean).join(", ");
  postUpdate(goalId, `Used ${from ?? "my brother"}'s suggestion (${changed})`);
  await rpc("resolve_suggestion", { p_entry: entryId, p_resolution: "accepted" });
  await refresh();
}

export async function dismissSuggestion(entryId: string) {
  await rpc("resolve_suggestion", { p_entry: entryId, p_resolution: "dismissed" });
  await refresh();
}

// ---------- recipient ----------

export function rememberInvite(token: string) {
  try {
    window.localStorage.setItem(PENDING_INVITE, token);
  } catch {
    /* ignore */
  }
}

export function recallInvite(): string | null {
  try {
    return window.localStorage.getItem(PENDING_INVITE);
  } catch {
    return null;
  }
}

export function forgetInvite() {
  try {
    window.localStorage.removeItem(PENDING_INVITE);
  } catch {
    /* ignore */
  }
}

export interface InvitePreview {
  status: "pending" | "accepted" | "declined" | "revoked" | "expired" | "not_found";
  from?: string;
  forEmail?: string;
  expiresAt?: string;
}

export const previewInvite = (token: string) => rpc<InvitePreview>("invite_preview", { p_token: token });

export async function respondInvite(token: string, accept: boolean) {
  const r = await rpc<{ status: string; goalId?: string }>("respond_invite", { p_token: token, p_accept: accept });
  forgetInvite();
  await refresh();
  return r;
}

// ---------- partner ----------

export async function setPartnerCadence(goalId: string, frequency: Frequency, firstDue: string, timeZone: string) {
  const { data: u } = await client().auth.getUser();
  const { error } = await client()
    .from("cadences")
    .upsert(
      { goal_id: goalId, actor_id: u.user?.id, role: "partner", frequency, anchor_date: firstDue, next_due: firstDue, time_zone: timeZone, updated_at: new Date().toISOString() },
      { onConflict: "goal_id,actor_id,role" }
    );
  if (error) throw new Error(friendlyError(error.message));
  await refresh();
}

/**
 * The partner's check-in. If it's due, it clears that date and the server moves
 * his schedule to the next future date, once, however many times this is sent.
 */
export async function partnerCheckin(p: Partnership, submissionId: string, saw: string, ask: string, timeZone: string) {
  const today = todayIn(timeZone);
  const due = p.cadence && compare(p.cadence.nextDue, today) <= 0;
  await rpc("post_shared", {
    p_goal: p.goalId,
    p_id: submissionId,
    p_kind: "partner_checkin",
    p_responses: { did: saw, blocker: "", next: ask },
    p_occurrence: due ? p.cadence!.nextDue : null,
    p_next_due: due ? nextOccurrenceAfter(p.cadence!.anchorDate, p.cadence!.frequency, today) : null
  });
  await refresh();
}
