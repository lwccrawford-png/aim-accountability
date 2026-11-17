import { test } from "node:test";
import assert from "node:assert/strict";
import { checkinStreak, dayItems, focusItem, isCheckinDay, parseFocus, weekDays, weekMarks } from "../src/lib/today.ts";
import type { Goal, Partnership } from "../src/lib/types.ts";

const TZ = "America/Chicago";
const TODAY = "2026-11-17"; // a Tuesday

const goal = (over: Partial<Goal>): Goal => ({
  id: "g1",
  commitment: "Run a 5K",
  guided: {},
  tags: [],
  roomIds: [],
  template: "custom",
  health: "on_track",
  lifecycle: "active",
  tasks: [],
  milestones: [],
  timeline: [],
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...over
});

const partnership = (over: Partial<Partnership>): Partnership => ({
  goalId: "p1",
  ownerName: "Dre",
  since: "2026-11-01T00:00:00Z",
  scope: { checkins: true, details: false },
  commitment: "Home for dinner",
  health: "on_track",
  lifecycle: "active",
  items: [],
  thread: [],
  ...over
});

test("today shows what is due today and what is left over, late first", () => {
  const g = goal({
    nextAction: "Buy shoes",
    nextActionDate: TODAY,
    cadence: { frequency: "weekly", anchorDate: "2026-11-15", nextDue: "2026-11-15" },
    tasks: [{ id: "t1", title: "Map a route", dueDate: "2026-11-20", completed: false, order: 0 }]
  });
  const items = dayItems([g], [], TODAY, TODAY, TZ);
  assert.deepEqual(items.map((i) => [i.kind, i.late]), [["checkin", true], ["action", false]]);
  assert.equal(items[0].date, "2026-11-15");
});

test("a future day shows what is scheduled, including the rhythm's later check-ins", () => {
  const g = goal({
    cadence: { frequency: "daily", anchorDate: "2026-11-10", nextDue: TODAY },
    tasks: [{ id: "t1", title: "Map a route", dueDate: "2026-11-20", completed: false, order: 0 }]
  });
  const fri = dayItems([g], [], "2026-11-20", TODAY, TZ);
  assert.deepEqual(fri.map((i) => i.kind), ["checkin", "task"]);
  assert.ok(fri.every((i) => !i.late && !i.done));
  const weekly = { frequency: "weekly" as const, anchorDate: "2026-11-03", nextDue: TODAY };
  assert.equal(isCheckinDay(weekly, "2026-11-24"), true);
  assert.equal(isCheckinDay(weekly, "2026-11-23"), false);
  assert.equal(isCheckinDay(weekly, "2026-11-10"), false); // before the next due date
});

test("what he finished today shows as done", () => {
  const g = goal({
    tasks: [{ id: "t1", title: "Map a route", completed: true, completedAt: "2026-11-17T15:00:00Z", order: 0 }],
    timeline: [
      { id: "e1", kind: "update", at: "2026-11-17T16:00:00Z", text: "Done: Buy shoes" },
      { id: "e2", kind: "checkin", at: "2026-11-17T17:00:00Z" },
      { id: "e3", kind: "update", at: "2026-11-17T17:00:00Z", text: "Feeling good" }
    ]
  });
  const items = dayItems([g], [], TODAY, TODAY, TZ);
  assert.equal(items.length, 3);
  assert.ok(items.every((i) => i.done));
  assert.deepEqual(items.map((i) => i.title).sort(), ["Buy shoes", "Checked in on your progress", "Map a route"]);
});

test("late evening counts for the local day, not the UTC day", () => {
  // 03:30 UTC on the 18th is 9:30 PM on the 17th in Chicago.
  const g = goal({ timeline: [{ id: "e1", kind: "checkin", at: "2026-11-18T03:30:00Z" }] });
  assert.equal(dayItems([g], [], TODAY, TODAY, TZ).length, 1);
  assert.equal(dayItems([g], [], "2026-11-18", "2026-11-18", TZ).length, 0);
});

test("the partner sees his check-in with a brother", () => {
  const p = partnership({ cadence: { frequency: "weekly", anchorDate: TODAY, nextDue: TODAY } });
  const [item] = dayItems([], [p], TODAY, TODAY, TZ);
  assert.equal(item.title, "Check in with Dre");
  assert.equal(item.href, "/brother/p1");
  const done = partnership({
    cadence: { frequency: "weekly", anchorDate: TODAY, nextDue: "2026-11-24" },
    thread: [{ id: "x", kind: "partner_checkin", at: "2026-11-17T18:00:00Z", mine: true }]
  });
  assert.deepEqual(dayItems([], [done], TODAY, TODAY, TZ).map((i) => [i.title, i.done]), [["Checked in with Dre", true]]);
  // No rhythm yet: today nudges him to set one.
  assert.equal(dayItems([], [partnership({})], TODAY, TODAY, TZ)[0].title, "Set your check-in rhythm with Dre");
});

test("a plan item that is also the next step is listed once", () => {
  const g = goal({
    nextAction: "Map a route",
    nextActionDate: TODAY,
    tasks: [{ id: "t1", title: "Map a route", dueDate: TODAY, completed: false, order: 0 }]
  });
  assert.equal(dayItems([g], [], TODAY, TODAY, TZ).length, 1);
});

test("archived goals and drafts stay off the dashboard", () => {
  const base = { nextAction: "Buy shoes", nextActionDate: TODAY };
  assert.equal(dayItems([goal({ ...base, lifecycle: "archived" }), goal({ ...base, lifecycle: "draft" })], [], TODAY, TODAY, TZ).length, 0);
});

test("the week runs Sunday to Saturday and moves by whole weeks", () => {
  assert.deepEqual(weekDays(TODAY), ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.equal(weekDays(TODAY, 1)[0], "2026-11-22");
  assert.equal(weekDays(TODAY, -1)[6], "2026-11-14");
});

test("week marks count open and done per day", () => {
  const g = goal({
    nextAction: "Buy shoes",
    nextActionDate: "2026-11-19",
    timeline: [{ id: "e1", kind: "checkin", at: "2026-11-16T18:00:00Z" }]
  });
  const marks = weekMarks([g], [], weekDays(TODAY), TODAY, TZ);
  assert.deepEqual(marks.map((m) => m.open), [0, 0, 0, 0, 1, 0, 0]);
  assert.equal(marks[1].checkedIn, true);
  assert.equal(marks[1].done, 1);
});

test("the streak counts back from today, or from yesterday when today's check-in is still ahead", () => {
  const at = (d: string) => ({ id: d, kind: "checkin" as const, at: `${d}T18:00:00Z` });
  assert.equal(checkinStreak([goal({ timeline: [at("2026-11-15"), at("2026-11-16")] })], TODAY, TZ), 2);
  assert.equal(checkinStreak([goal({ timeline: [at("2026-11-15"), at("2026-11-16"), at("2026-11-17")] })], TODAY, TZ), 3);
  assert.equal(checkinStreak([goal({ timeline: [at("2026-11-14")] })], TODAY, TZ), 0);
});

test("focus holds for today only and lets go once the item is done", () => {
  const g = goal({ nextAction: "Buy shoes", nextActionDate: TODAY });
  const items = dayItems([g], [], TODAY, TODAY, TZ);
  assert.equal(focusItem({ date: TODAY, key: "a:g1:Buy shoes" }, items, TODAY)?.title, "Buy shoes");
  assert.equal(focusItem({ date: "2026-11-16", key: "a:g1:Buy shoes" }, items, TODAY), undefined);
  assert.equal(focusItem({ date: TODAY, key: "a:gone" }, items, TODAY), undefined);
  assert.equal(parseFocus("not json"), null);
  assert.deepEqual(parseFocus('{"date":"2026-11-17","key":"a:g1"}'), { date: TODAY, key: "a:g1" });
});

test("a plan item finished as the next step shows once, as done", () => {
  const g = goal({
    tasks: [{ id: "t1", title: "Map a route", dueDate: TODAY, completed: true, completedAt: "2026-11-17T16:00:00Z", order: 0 }],
    timeline: [{ id: "e1", kind: "update", at: "2026-11-17T16:00:00Z", text: "Done: Map a route" }]
  });
  assert.deepEqual(dayItems([g], [], TODAY, TODAY, TZ).map((i) => [i.title, i.done]), [["Map a route", true]]);
});
