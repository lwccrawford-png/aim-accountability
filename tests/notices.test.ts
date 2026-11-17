import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, badge, noticeLine, type Notice } from "../src/lib/notices.ts";

const n = (over: Partial<Notice>): Notice => ({ id: "n1", kind: "partner_checkin", side: "owner", goalId: "g1", actor: "Dre", at: "2026-11-17T12:00:00Z", read: false, ...over });

test("the goal setter is sent to his own goal", () => {
  assert.deepEqual(noticeLine(n({})), { title: "Dre checked in with you", href: "/goals/g1?tab=brother" });
  assert.equal(noticeLine(n({ kind: "blocker_read" })).href, "/goals/g1?tab=blockers");
  assert.equal(noticeLine(n({ kind: "question" })).href, "/goals/g1?tab=brother");
});

test("the partner is sent to his brother's goal, or home once he's been removed", () => {
  assert.deepEqual(noticeLine(n({ kind: "checkin", side: "partner", actor: "Marcus" })), { title: "Marcus checked in on his goal", href: "/brother/g1" });
  assert.equal(noticeLine(n({ kind: "reply", side: "partner" })).href, "/brother/g1");
  assert.equal(noticeLine(n({ kind: "removed", side: "partner" })).href, "/");
});

test("a missing name still reads as a sentence", () => {
  assert.equal(noticeLine(n({ actor: undefined })).title, "Your brother checked in with you");
});

test("time reads the way a man would say it", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  assert.equal(ago("2026-11-17T11:59:40Z", now), "Just now");
  assert.equal(ago("2026-11-17T11:48:00Z", now), "12 min ago");
  assert.equal(ago("2026-11-17T09:00:00Z", now), "3 hr ago");
  assert.equal(ago("2026-11-16T10:00:00Z", now), "Yesterday");
  assert.match(ago("2026-11-03T10:00:00Z", now), /Nov 3/);
});

test("the badge tops out at 9+", () => {
  assert.equal(badge(3), "3");
  assert.equal(badge(14), "9+");
});
