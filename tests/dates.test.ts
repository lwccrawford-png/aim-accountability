// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonthsAnchored, nextOccurrenceAfter, todayIn } from "../src/lib/dates.ts";
import { sprintTasks, thirtyDayMilestones } from "../src/lib/templates.ts";

test("month-end clamps but keeps the anchor day", () => {
  assert.equal(addMonthsAnchored("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsAnchored("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonthsAnchored("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsAnchored("2026-11-30", 3), "2027-02-28");
});

test("daily steps cross daylight saving without skipping a day", () => {
  assert.equal(addDays("2026-03-07", 1), "2026-03-08");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDays("2026-10-31", 2), "2026-11-02");
});

test("overdue jumps once to the next future date", () => {
  assert.equal(nextOccurrenceAfter("2026-11-01", "weekly", "2026-11-15"), "2026-11-22");
  assert.equal(nextOccurrenceAfter("2026-11-01", "biweekly", "2026-11-15"), "2026-11-29");
  assert.equal(nextOccurrenceAfter("2026-11-01", "daily", "2026-11-15"), "2026-11-16");
  assert.equal(nextOccurrenceAfter("2026-01-31", "monthly", "2026-03-05"), "2026-03-31");
  assert.equal(nextOccurrenceAfter("2026-12-01", "weekly", "2026-11-15"), "2026-12-01");
});

test("today follows the chosen zone near midnight", () => {
  const t = new Date("2026-11-16T04:30:00Z"); // 10:30pm Chicago, 4:30am London
  assert.equal(todayIn("America/Chicago", t), "2026-11-15");
  assert.equal(todayIn("Europe/London", t), "2026-11-16");
});

test("templates: 7 sprint days, milestones end on day 30", () => {
  const s = sprintTasks("2026-11-15");
  assert.equal(s.length, 7);
  assert.equal(s[0].dueDate, "2026-11-15");
  assert.equal(s[6].dueDate, "2026-11-21");
  for (const n of [4, 6] as const) {
    const m = thirtyDayMilestones("2026-11-15", n);
    assert.equal(m.length, n);
    assert.equal(m[n - 1].dueDate, "2026-12-14"); // day 30
  }
});
