import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateOf, missingWords, newRow, parseWorkspace, reconcile, rowProblems, rowReady, rowToInput } from "../src/lib/season.ts";
import type { Goal } from "../src/lib/types.ts";

const TODAY = "2026-11-15";

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

test("a row is ready only with a commitment, a first step and a date from today on", () => {
  const r = { ...newRow("a"), commitment: "Read Proverbs daily", nextAction: "Buy a reading plan" };
  assert.deepEqual(missingWords(r, TODAY), ["date"]);
  assert.equal(rowProblems({ ...r, nextActionDate: "2026-11-14" }, TODAY).nextActionDate, "Pick today or later.");
  assert.equal(rowReady({ ...r, nextActionDate: TODAY }, TODAY), true);
  assert.deepEqual(missingWords(newRow("b"), TODAY), ["commitment", "first step", "date"]);
});

test("rooms set the LMTLSS Room tag, and an empty room list clears it", () => {
  const r = { ...newRow("a"), commitment: " Lead family devotions ", nextAction: "Pick a night", nextActionDate: TODAY, roomIds: ["sonship"] };
  const input = rowToInput(r, undefined, "2027-02-28");
  assert.equal(input.id, "a");
  assert.equal(input.commitment, "Lead family devotions");
  assert.deepEqual(input.tags, ["lmtlss_room"]);
  assert.equal(input.guided.targetDate, "2027-02-28");
  const cleared = rowToInput({ ...r, roomIds: [] }, goal({ id: "a", lifecycle: "draft", tags: ["lmtlss_room"], roomIds: ["sonship"] }));
  assert.deepEqual(cleared.tags, []);
});

test("a saved draft keeps its own finish date and plan items", () => {
  const base = goal({ id: "a", lifecycle: "draft", guided: { targetDate: "2026-12-31", why: "my kids" }, tasks: [{ id: "t", title: "x", completed: false, order: 0 }] });
  const input = rowToInput({ ...newRow("a"), commitment: "New words" }, base, "2027-02-28");
  assert.equal(input.guided.targetDate, "2026-12-31");
  assert.equal(input.guided.why, "my kids");
  assert.equal(input.tasks.length, 1);
  assert.equal(input.commitment, "New words");
});

test("duplicates are flagged against earlier rows and live goals", () => {
  const rows = [
    { ...newRow("a"), commitment: "Run a 5K!" },
    { ...newRow("b"), commitment: "run a 5k" }
  ];
  assert.equal(duplicateOf(rows[0], rows, [goal({ lifecycle: "archived" })]), undefined);
  assert.match(duplicateOf(rows[0], rows, [goal({})]) ?? "", /already have going/);
  assert.match(duplicateOf(rows[1], rows, []) ?? "", /above/);
});

test("rows that went live drop out, and drafts from other devices come in", () => {
  const rows = [newRow("a"), newRow("b"), newRow("c")];
  const goals = [goal({ id: "a", lifecycle: "active" }), goal({ id: "b", lifecycle: "draft" }), goal({ id: "d", lifecycle: "draft", commitment: "From the laptop" })];
  const out = reconcile(rows, goals);
  assert.deepEqual(out.map((r) => r.id), ["b", "c", "d"]);
  assert.equal(out[2].commitment, "From the laptop");
});

test("a damaged workspace starts fresh instead of crashing", () => {
  assert.deepEqual(parseWorkspace("{nope").rows, []);
  assert.deepEqual(parseWorkspace(JSON.stringify({ version: 2, rows: [] })).rows, []);
  const w = parseWorkspace(JSON.stringify({ version: 1, rows: [{ id: "a", commitment: "x" }, null] }));
  assert.equal(w.rows.length, 1);
  assert.deepEqual(w.rows[0].roomIds, []);
  assert.equal(w.frequency, "weekly");
});
