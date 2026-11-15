"use client";

import { useSyncExternalStore } from "react";
import { compare, nextOccurrenceAfter, addDays, todayIn } from "@/lib/dates";
import { uid } from "@/lib/templates";
import type {
  AppState,
  Cadence,
  Frequency,
  Goal,
  Health,
  Lifecycle,
  PlanItem,
  Settings,
  TimelineEntry
} from "@/lib/types";

// Storage layer for step 1 (on this device only). Every write goes through the
// actions below, so step 2 can swap this file for Supabase calls.

const KEY = "accountability_v2";
export const V1_ACTIVE = "accountability_goals_v1";
export const V1_ARCHIVE = "accountability_goals_archive_v1";

const guessTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
};

const fresh = (): AppState => ({
  version: 2,
  goals: [],
  settings: { lmtlssMode: false, timeZone: guessTz() },
  submissionIds: []
});

let state: AppState | null = null;
const listeners = new Set<() => void>();

function read(): AppState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? { ...fresh(), ...(JSON.parse(raw) as AppState) } : fresh();
  } catch {
    state = fresh();
  }
  return state;
}

function commit(next: AppState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Returns null during server render and the first client pass. */
export function useApp(): AppState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const today = () => todayIn(read().settings.timeZone);
const now = () => new Date().toISOString();
const entry = (e: Omit<TimelineEntry, "id" | "at">): TimelineEntry => ({ id: uid(), at: now(), ...e });

function updateGoal(id: string, fn: (g: Goal) => Goal) {
  const s = read();
  commit({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...fn(g), updatedAt: now() } : g)) });
}

export const getGoal = (id: string) => read().goals.find((g) => g.id === id);

// ---------- settings ----------

export function updateSettings(patch: Partial<Settings>) {
  const s = read();
  commit({ ...s, settings: { ...s.settings, ...patch } });
}

// ---------- goals ----------

export type GoalInput = Pick<
  Goal,
  | "id"
  | "commitment"
  | "nextAction"
  | "nextActionDate"
  | "guided"
  | "category"
  | "tags"
  | "roomIds"
  | "template"
  | "milestoneCount"
  | "tasks"
  | "milestones"
> & { description?: string };

export const isReady = (g: Pick<Goal, "commitment" | "nextAction" | "nextActionDate">) =>
  Boolean(g.commitment?.trim() && g.nextAction?.trim() && g.nextActionDate);

/**
 * Create or update a goal. The id is made by the form before the first save,
 * so pressing save twice updates the same record instead of making two.
 */
export function saveGoal(input: GoalInput, activate: boolean, cadence?: { frequency: Frequency; firstDue: string }) {
  const s = read();
  const existing = s.goals.find((g) => g.id === input.id);
  const t = now();
  let goal: Goal = existing
    ? { ...existing, ...input, updatedAt: t }
    : {
        ...input,
        health: "on_track",
        lifecycle: "draft",
        timeline: [entry({ kind: "created" })],
        createdAt: t,
        updatedAt: t
      };

  if (existing && existing.lifecycle !== "draft") {
    const changed = existing.commitment !== input.commitment || existing.guided?.targetDate !== input.guided?.targetDate;
    if (changed) goal.timeline = [...goal.timeline, entry({ kind: "revision", text: input.commitment })];
  }

  if (cadence) goal.cadence = makeCadence(cadence.frequency, cadence.firstDue);

  if (activate && goal.lifecycle === "draft" && isReady(goal)) {
    goal = { ...goal, lifecycle: "active", activatedAt: t, timeline: [...goal.timeline, entry({ kind: "activated" })] };
  }

  commit({ ...s, goals: existing ? s.goals.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...s.goals] });
  return goal;
}

function makeCadence(frequency: Frequency, firstDue: string): Cadence {
  return { frequency, anchorDate: firstDue, nextDue: firstDue };
}

/** Changing a cadence only moves future occurrences. */
export function setCadence(id: string, frequency: Frequency, firstDue: string) {
  updateGoal(id, (g) => ({ ...g, cadence: makeCadence(frequency, firstDue) }));
}

export function setHealth(id: string, health: Health) {
  updateGoal(id, (g) =>
    g.health === health ? g : { ...g, health, timeline: [...g.timeline, entry({ kind: "status", health })] }
  );
}

export function postUpdate(id: string, text: string, health?: Health) {
  updateGoal(id, (g) => ({
    ...g,
    health: health ?? g.health,
    timeline: [...g.timeline, entry({ kind: "update", text, health })]
  }));
}

export function setNextAction(id: string, nextAction: string, nextActionDate: string) {
  updateGoal(id, (g) => ({ ...g, nextAction, nextActionDate }));
}

/** Marks the next action done, and offers the next open task as the new one. */
export function completeNextAction(id: string) {
  updateGoal(id, (g) => {
    const done = g.nextAction ?? "";
    const next = [...g.tasks, ...g.milestones]
      .filter((i) => !i.completed && i.title !== done)
      .sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"))[0];
    return {
      ...g,
      timeline: [...g.timeline, entry({ kind: "update", text: `Done: ${done}` })],
      nextAction: next?.title,
      nextActionDate: next?.dueDate
    };
  });
}

export function submitCheckin(
  id: string,
  submissionId: string,
  responses: { did: string; blocker: string; next: string },
  health: Health,
  nextAction?: { text: string; date: string }
) {
  const s = read();
  if (s.submissionIds.includes(submissionId)) return; // already applied
  const t = today();
  const goals = s.goals.map((g) => {
    if (g.id !== id) return g;
    let cadence = g.cadence;
    let occurrence: string | undefined;
    if (cadence && compare(cadence.nextDue, t) <= 0) {
      // Due or overdue: clear it once, then jump to the next future date.
      occurrence = cadence.nextDue;
      cadence = { ...cadence, nextDue: nextOccurrenceAfter(cadence.anchorDate, cadence.frequency, t) };
    }
    return {
      ...g,
      cadence,
      health,
      nextAction: nextAction?.text || g.nextAction,
      nextActionDate: nextAction?.text ? nextAction.date : g.nextActionDate,
      updatedAt: now(),
      timeline: [...g.timeline, entry({ kind: "checkin", responses, health, occurrence })]
    };
  });
  commit({ ...s, goals, submissionIds: [...s.submissionIds.slice(-500), submissionId] });
}

export function completeGoal(id: string, note?: string) {
  updateGoal(id, (g) => ({
    ...g,
    lifecycle: "completed",
    completedAt: now(),
    timeline: [...g.timeline, entry({ kind: "completed", text: note })]
  }));
}

export function archiveGoal(id: string) {
  updateGoal(id, (g) =>
    g.lifecycle === "archived"
      ? g
      : { ...g, priorLifecycle: g.lifecycle, lifecycle: "archived", archivedAt: now(), timeline: [...g.timeline, entry({ kind: "archived" })] }
  );
}

export function restoreGoal(id: string) {
  updateGoal(id, (g) => {
    const back: Lifecycle = g.priorLifecycle ?? "active";
    const restored: Goal = { ...g, lifecycle: back, archivedAt: undefined, timeline: [...g.timeline, entry({ kind: "restored" })] };
    if (back === "active" && g.cadence) {
      const t = today();
      // Resume from today rather than showing a pile of missed dates.
      restored.cadence = { ...g.cadence, nextDue: nextOccurrenceAfter(g.cadence.anchorDate, g.cadence.frequency, addDays(t, -1)) };
    }
    return restored;
  });
}

export function reopenGoal(id: string) {
  updateGoal(id, (g) => ({ ...g, lifecycle: "active", completedAt: undefined, timeline: [...g.timeline, entry({ kind: "restored" })] }));
}

export function deleteDraft(id: string) {
  const s = read();
  commit({ ...s, goals: s.goals.filter((g) => !(g.id === id && g.lifecycle === "draft")) });
}

// ---------- plan items ----------

type ListKey = "tasks" | "milestones";

export function addItem(id: string, list: ListKey, title: string, dueDate?: string) {
  updateGoal(id, (g) => ({
    ...g,
    [list]: [...g[list], { id: uid(), title, dueDate, completed: false, order: g[list].length } satisfies PlanItem]
  }));
}

export function editItem(id: string, list: ListKey, itemId: string, patch: Partial<PlanItem>) {
  updateGoal(id, (g) => ({
    ...g,
    [list]: g[list].map((i) =>
      i.id === itemId
        ? { ...i, ...patch, completedAt: patch.completed === undefined ? i.completedAt : patch.completed ? now() : undefined }
        : i
    )
  }));
}

export function removeItem(id: string, list: ListKey, itemId: string) {
  updateGoal(id, (g) => ({ ...g, [list]: g[list].filter((i) => i.id !== itemId) }));
}

// ---------- prototype import ----------

interface V1Goal {
  id: string;
  title: string;
  description?: string;
  structure?: "7-Day Sprint" | "30-Day Goal" | "Custom";
  milestoneCount?: 4 | 6;
  status?: "On Track" | "At Risk" | "Off Track";
  tasks?: { id: string; title: string; completed: boolean; dueDate?: string }[];
  milestones?: { id: string; title: string; completed: boolean; dueDate?: string }[];
  updates?: { id: string; status: string; note: string; createdAt: string }[];
  createdAt?: string;
  archivedAt?: string;
}

const HEALTH: Record<string, Health> = { "On Track": "on_track", "At Risk": "at_risk", "Off Track": "off_track" };
const TEMPLATE = { "7-Day Sprint": "sprint7", "30-Day Goal": "goal30", Custom: "custom" } as const;

function parseV1(raw: string | null): V1Goal[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((g) => g && typeof g.id === "string" && typeof g.title === "string") : [];
  } catch {
    return [];
  }
}

export function readPrototype(source?: { active?: string | null; archive?: string | null }) {
  const a = source ? source.active ?? null : window.localStorage.getItem(V1_ACTIVE);
  const b = source ? source.archive ?? null : window.localStorage.getItem(V1_ARCHIVE);
  const active = parseV1(a);
  const archived = parseV1(b).map((g) => ({ ...g, archivedAt: g.archivedAt ?? new Date().toISOString() }));
  const known = new Set(read().goals.map((g) => g.sourceId).filter(Boolean));
  const all = [...active, ...archived];
  return { all, fresh: all.filter((g) => !known.has(g.id)) };
}

/** Imports prototype goals privately. Safe to run twice: matched by source id. */
export function importPrototype(goals: V1Goal[]) {
  const s = read();
  const known = new Set(s.goals.map((g) => g.sourceId).filter(Boolean));
  const t = now();
  const items = (list: V1Goal["tasks"]) =>
    (list ?? []).map((i, order) => ({ id: uid(), title: i.title, dueDate: i.dueDate, completed: !!i.completed, order }));
  const added: Goal[] = goals
    .filter((g) => !known.has(g.id))
    .map((g) => ({
      id: uid(),
      sourceId: g.id,
      commitment: g.title,
      description: g.description,
      guided: {},
      tags: [],
      roomIds: [],
      template: TEMPLATE[g.structure ?? "Custom"] ?? "custom",
      milestoneCount: g.milestoneCount,
      health: HEALTH[g.status ?? "On Track"] ?? "on_track",
      lifecycle: g.archivedAt ? "archived" : "active",
      priorLifecycle: g.archivedAt ? "active" : undefined,
      tasks: items(g.tasks),
      milestones: items(g.milestones),
      timeline: [
        ...(g.updates ?? []).map((u) => ({
          id: uid(),
          kind: "update" as const,
          at: u.createdAt,
          text: u.note,
          health: HEALTH[u.status]
        })),
        entry({ kind: "imported", text: "Brought over from the earlier version" })
      ],
      createdAt: g.createdAt ?? t,
      updatedAt: t,
      activatedAt: g.createdAt ?? t,
      archivedAt: g.archivedAt
    }));
  commit({ ...s, goals: [...added, ...s.goals], importedFromV1: t });
  return added.length;
}

export function exportJson(): string {
  return JSON.stringify(read(), null, 2);
}
