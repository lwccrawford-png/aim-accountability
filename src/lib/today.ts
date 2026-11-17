// The Today dashboard: what a man has on a given day, across his own goals and the
// goals he walks with a brother on. Pure logic only, so it can be tested without
// the browser.
import { addDays, compare, daysBetween, nextOccurrenceAfter, todayIn } from "./dates.ts";
import type { CalDate, Cadence, Goal, Partnership } from "@/lib/types";

export type ItemKind = "action" | "checkin" | "partner" | "task" | "milestone";

export interface DayItem {
  /** Stable across renders, so a focus pick survives a reload. */
  key: string;
  kind: ItemKind;
  /** The date it is due (or, for a finished item, the day it was done). */
  date: CalDate;
  title: string;
  /** The goal it belongs to, in the man's words. */
  context: string;
  href: string;
  goalId: string;
  /** For plan items: which one. */
  itemId?: string;
  done: boolean;
  /** Due before the day being shown, and still open. */
  late: boolean;
}

export const FOCUS_KEY = "accountability_focus_v1";

const ORDER: Record<ItemKind, number> = { action: 0, checkin: 1, partner: 2, milestone: 3, task: 4 };

/** Is `date` one of this rhythm's check-in days, from the next due date on? */
export function isCheckinDay(c: Cadence | undefined, date: CalDate): boolean {
  if (!c || compare(date, c.nextDue) < 0) return false;
  if (date === c.nextDue) return true;
  return nextOccurrenceAfter(c.anchorDate, c.frequency, addDays(date, -1)) === date;
}

const localDay = (iso: string | undefined, tz: string) => (iso ? todayIn(tz, new Date(iso)) : "");

/**
 * Everything on `date`. When `date` is today, anything still open from earlier
 * days comes along as late, and whatever was finished today shows as done.
 * Past days show only what was finished; future days show what is scheduled.
 */
export function dayItems(goals: Goal[], partnerships: Partnership[], date: CalDate, today: CalDate, tz: string): DayItem[] {
  const isToday = date === today;
  const past = compare(date, today) < 0;
  const out: DayItem[] = [];
  // Open and due on this day, or (on today) left over from before.
  const due = (d?: CalDate) => !!d && !past && (d === date || (isToday && compare(d, today) < 0));

  for (const g of goals) {
    if (g.lifecycle !== "active" && g.lifecycle !== "completed") continue;
    const live = g.lifecycle === "active";
    const base = { context: g.commitment, goalId: g.id };

    if (live && g.nextAction && due(g.nextActionDate)) {
      out.push({ ...base, key: `a:${g.id}:${g.nextAction}`, kind: "action", date: g.nextActionDate!, title: g.nextAction, href: `/goals/${g.id}`, done: false, late: compare(g.nextActionDate!, date) < 0 });
    }
    if (live && g.cadence) {
      const c = g.cadence;
      if (due(c.nextDue) || (!past && !isToday && isCheckinDay(c, date))) {
        const when = isToday && compare(c.nextDue, date) < 0 ? c.nextDue : date;
        out.push({ ...base, key: `c:${g.id}`, kind: "checkin", date: when, title: "Check in on your progress", href: `/goals/${g.id}/check-in`, done: false, late: compare(when, date) < 0 });
      }
    }
    // A plan item finished as the next step is already listed from the history below.
    const doneAsStep = new Set(
      g.timeline.filter((t) => t.kind === "update" && t.text?.startsWith("Done: ") && localDay(t.at, tz) === date).map((t) => t.text!.slice(6))
    );
    for (const list of ["milestones", "tasks"] as const) {
      const kind = list === "tasks" ? "task" : "milestone";
      for (const i of g[list]) {
        if (!i.completed && live && due(i.dueDate) && i.title !== g.nextAction) {
          out.push({ ...base, key: `i:${i.id}`, kind, itemId: i.id, date: i.dueDate!, title: i.title, href: `/goals/${g.id}`, done: false, late: compare(i.dueDate!, date) < 0 });
        } else if (i.completed && localDay(i.completedAt, tz) === date && !doneAsStep.has(i.title)) {
          out.push({ ...base, key: `i:${i.id}`, kind, itemId: i.id, date, title: i.title, href: `/goals/${g.id}`, done: true, late: false });
        }
      }
    }
    // Finished on this day: next steps and check-ins leave a mark in the history.
    for (const t of g.timeline) {
      if (localDay(t.at, tz) !== date) continue;
      if (t.kind === "update" && t.text?.startsWith("Done: ") && t.text.length > 6) {
        out.push({ ...base, key: `d:${t.id}`, kind: "action", date, title: t.text.slice(6), href: `/goals/${g.id}`, done: true, late: false });
      } else if (t.kind === "checkin" && !t.author) {
        out.push({ ...base, key: `d:${t.id}`, kind: "checkin", date, title: "Checked in on your progress", href: `/goals/${g.id}?tab=checkins`, done: true, late: false });
      }
    }
  }

  for (const p of partnerships) {
    if (p.lifecycle !== "active") continue;
    const base = { context: p.commitment, goalId: p.goalId, href: `/brother/${p.goalId}` };
    const c = p.cadence;
    if (c && (due(c.nextDue) || (!past && !isToday && isCheckinDay(c, date)))) {
      const when = isToday && compare(c.nextDue, date) < 0 ? c.nextDue : date;
      out.push({ ...base, key: `p:${p.goalId}`, kind: "partner", date: when, title: `Check in with ${p.ownerName}`, done: false, late: compare(when, date) < 0 });
    }
    if (!c && isToday) {
      out.push({ ...base, key: `p:${p.goalId}`, kind: "partner", date, title: `Set your check-in rhythm with ${p.ownerName}`, done: false, late: false });
    }
    for (const t of p.thread) {
      if (t.kind === "partner_checkin" && t.mine && localDay(t.at, tz) === date) {
        out.push({ ...base, key: `d:${t.id}`, kind: "partner", date, title: `Checked in with ${p.ownerName}`, done: true, late: false });
      }
    }
  }

  // Open first (late ones at the top), then what's done.
  return out.sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(b.late) - Number(a.late) || compare(a.date, b.date) || ORDER[a.kind] - ORDER[b.kind]
  );
}

/** The seven days, Sunday to Saturday, of the week `offset` weeks from today's. */
export function weekDays(today: CalDate, offset = 0): CalDate[] {
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = addDays(today, -dow + 7 * offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface DayMark {
  date: CalDate;
  open: number;
  done: number;
  late: number;
  /** He checked in on one of his own goals that day. */
  checkedIn: boolean;
}

export function weekMarks(goals: Goal[], partnerships: Partnership[], days: CalDate[], today: CalDate, tz: string): DayMark[] {
  return days.map((date) => {
    const items = dayItems(goals, partnerships, date, today, tz);
    return {
      date,
      open: items.filter((i) => !i.done).length,
      done: items.filter((i) => i.done).length,
      late: items.filter((i) => i.late).length,
      checkedIn: items.some((i) => i.done && i.kind === "checkin")
    };
  });
}

/** Days in a row with a check-in on any of his goals, ending today (or yesterday, if today's is still ahead). */
export function checkinStreak(goals: Goal[], today: CalDate, tz: string): number {
  const days = new Set<string>();
  for (const g of goals) for (const t of g.timeline) if (t.kind === "checkin" && !t.author) days.add(localDay(t.at, tz));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface Focus {
  date: CalDate;
  key: string;
}

/** The focus item for today, if the pick is from today and still open. */
export function focusItem(focus: Focus | null, items: DayItem[], today: CalDate): DayItem | undefined {
  if (!focus || focus.date !== today) return undefined;
  return items.find((i) => i.key === focus.key && !i.done);
}

export function parseFocus(raw: string | null): Focus | null {
  try {
    const f = raw ? (JSON.parse(raw) as Focus) : null;
    return f && typeof f.date === "string" && typeof f.key === "string" ? f : null;
  } catch {
    return null;
  }
}

export const dayName = (d: CalDate, style: "short" | "long" = "short") => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: style });
};

export const daysAway = (from: CalDate, to: CalDate) => daysBetween(from, to);
