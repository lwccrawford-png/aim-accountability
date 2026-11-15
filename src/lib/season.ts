// Plan a New Season: the bulk workspace. Pure logic only, so it can be tested
// without the browser. The page keeps a workspace on this device and writes
// goals through saveGoal, one row at a time.
import { compare } from "./dates.ts";
import type { CalDate, Frequency, Goal } from "@/lib/types";
import type { GoalInput } from "@/lib/store";

export const SEASON_KEY = "accountability_season_v1";

export interface SeasonRow {
  /** Becomes the goal id. Made once when the row is added and reused on every save or retry. */
  id: string;
  commitment: string;
  nextAction: string;
  nextActionDate: CalDate | "";
  category?: string;
  roomIds: string[];
  /** Picked for activation on the Launch tab. */
  selected: boolean;
  /** Set when "Save drafts" last wrote this row to the goal list. */
  savedAt?: string;
  /** Why the last activation of this row didn't go through. */
  error?: string;
}

export type Decision = "carried" | "revised";

export interface Workspace {
  version: 1;
  rows: SeasonRow[];
  /** Existing goals the man chose to carry forward or revised this season. */
  decisions: Record<string, Decision>;
  /** Optional finish date for every new goal that doesn't have one. */
  endsOn?: CalDate;
  frequency: Frequency;
}

export const freshWorkspace = (): Workspace => ({ version: 1, rows: [], decisions: {}, frequency: "weekly" });

export const newRow = (id: string): SeasonRow => ({
  id,
  commitment: "",
  nextAction: "",
  nextActionDate: "",
  roomIds: [],
  selected: true
});

export function parseWorkspace(raw: string | null | undefined): Workspace {
  if (!raw) return freshWorkspace();
  try {
    const w = JSON.parse(raw) as Partial<Workspace>;
    if (w?.version !== 1 || !Array.isArray(w.rows)) return freshWorkspace();
    return {
      version: 1,
      rows: w.rows
        .filter((r): r is SeasonRow => !!r && typeof r.id === "string")
        .map((r) => ({ ...newRow(r.id), ...r, roomIds: Array.isArray(r.roomIds) ? r.roomIds : [] })),
      decisions: w.decisions && typeof w.decisions === "object" ? w.decisions : {},
      endsOn: w.endsOn || undefined,
      frequency: w.frequency ?? "weekly"
    };
  } catch {
    return freshWorkspace();
  }
}

export const isBlank = (r: SeasonRow) => !r.commitment.trim() && !r.nextAction.trim();

export type Field = "commitment" | "nextAction" | "nextActionDate";

/** What's stopping this row from going live, by field. Empty means ready. */
export function rowProblems(r: SeasonRow, today: CalDate): Partial<Record<Field, string>> {
  const p: Partial<Record<Field, string>> = {};
  if (!r.commitment.trim()) p.commitment = "Name the commitment.";
  if (!r.nextAction.trim()) p.nextAction = "Add a first step.";
  if (!r.nextActionDate) p.nextActionDate = "Pick a date.";
  else if (compare(r.nextActionDate, today) < 0) p.nextActionDate = "Pick today or later.";
  return p;
}

export const rowReady = (r: SeasonRow, today: CalDate) => Object.keys(rowProblems(r, today)).length === 0;

const MISSING_WORD: Record<Field, string> = { commitment: "commitment", nextAction: "first step", nextActionDate: "date" };
export const missingWords = (r: SeasonRow, today: CalDate) =>
  (Object.keys(rowProblems(r, today)) as Field[]).map((f) => MISSING_WORD[f]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Same commitment as an earlier row or a live goal. A heads-up, not a block:
 * two goals can share words and still be different.
 */
export function duplicateOf(r: SeasonRow, rows: SeasonRow[], goals: Goal[]): string | undefined {
  const key = norm(r.commitment);
  if (!key) return undefined;
  const earlier = rows.slice(0, rows.findIndex((x) => x.id === r.id));
  if (earlier.some((x) => norm(x.commitment) === key)) return "You've already written this one above.";
  if (goals.some((g) => g.id !== r.id && g.lifecycle === "active" && norm(g.commitment) === key))
    return "This matches a goal you already have going.";
  return undefined;
}

export function goalToInput(g: Goal): GoalInput {
  return {
    id: g.id,
    commitment: g.commitment,
    description: g.description,
    nextAction: g.nextAction,
    nextActionDate: g.nextActionDate,
    guided: g.guided ?? {},
    category: g.category,
    tags: g.tags ?? [],
    roomIds: g.roomIds ?? [],
    template: g.template,
    milestoneCount: g.milestoneCount,
    tasks: g.tasks ?? [],
    milestones: g.milestones ?? []
  };
}

/**
 * Turn a row into what saveGoal takes. A row that was saved as a draft keeps
 * whatever else the draft already had (guided fields, plan items).
 */
export function rowToInput(r: SeasonRow, base?: Goal, endsOn?: CalDate): GoalInput {
  const from = base ? goalToInput(base) : undefined;
  const guided = { ...(from?.guided ?? {}) };
  if (endsOn && !guided.targetDate) guided.targetDate = endsOn;
  const otherTags = (from?.tags ?? []).filter((t) => t !== "lmtlss_room");
  return {
    template: "custom",
    tasks: [],
    milestones: [],
    ...from,
    id: r.id,
    commitment: r.commitment.trim(),
    nextAction: r.nextAction.trim() || undefined,
    nextActionDate: r.nextActionDate || undefined,
    category: r.category,
    roomIds: r.roomIds,
    tags: r.roomIds.length ? [...otherTags, "lmtlss_room"] : otherTags,
    guided
  };
}

export function rowFromGoal(g: Goal): SeasonRow {
  return {
    ...newRow(g.id),
    commitment: g.commitment ?? "",
    nextAction: g.nextAction ?? "",
    nextActionDate: g.nextActionDate ?? "",
    category: g.category,
    roomIds: g.roomIds ?? [],
    savedAt: g.updatedAt
  };
}

/**
 * Line the workspace up with the goal list: a draft saved on another device
 * shows up as a row, and a row that has already gone live (here or elsewhere)
 * drops out so it can't be activated twice.
 */
export function reconcile(rows: SeasonRow[], goals: Goal[]): SeasonRow[] {
  const byId = new Map(goals.map((g) => [g.id, g]));
  const kept = rows.filter((r) => {
    const g = byId.get(r.id);
    return !g || g.lifecycle === "draft";
  });
  const have = new Set(kept.map((r) => r.id));
  const drafts = goals.filter((g) => g.lifecycle === "draft" && !have.has(g.id)).map(rowFromGoal);
  return [...kept, ...drafts];
}
