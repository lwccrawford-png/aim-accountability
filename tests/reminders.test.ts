import assert from "node:assert/strict";
import { test } from "node:test";
import { compose, lines, whenLabel, type Digest } from "../supabase/functions/send-reminders/compose.ts";

const base: Digest = { memberId: "m1", email: "a@example.com", name: "Marcus", localDate: "2026-11-16", unsubToken: "tok-1" };

test("when label: today, one day, several days", () => {
  assert.deepEqual(whenLabel("2026-11-16", "2026-11-16"), { when: "Today", late: false });
  assert.deepEqual(whenLabel("2026-11-15", "2026-11-16"), { when: "1 day late", late: true });
  assert.deepEqual(whenLabel("2026-10-30", "2026-11-16"), { when: "17 days late", late: true });
});

test("nothing due means no email", () => {
  assert.equal(compose(base, "https://app.test"), null);
  assert.equal(compose({ ...base, own: [], partner: [] }, "https://app.test"), null);
});

test("the goal setter gets his check-in and his next step", () => {
  const d: Digest = {
    ...base,
    own: [{ goalId: "g1", commitment: "Run a 5K", checkinDue: "2026-11-16", nextAction: "Buy shoes", nextActionDate: "2026-11-13" }]
  };
  const l = lines(d, "https://app.test/");
  assert.equal(l.length, 2);
  assert.equal(l[0].href, "https://app.test/goals/g1/check-in");
  assert.equal(l[0].when, "Today");
  assert.equal(l[1].title, "Next step: Buy shoes");
  assert.equal(l[1].when, "3 days late");
  const e = compose(d, "https://app.test/")!;
  assert.equal(e.subject, "2 things need you today");
  assert.equal(e.count, 2);
  assert.match(e.text, /Marcus,/);
});

test("the partner gets his check-in and a heads-up when his brother goes quiet", () => {
  const d: Digest = {
    ...base,
    partner: [{ goalId: "g2", ownerName: "Dre", commitment: "Read daily", checkinDue: "2026-11-16", ownerLateSince: "2026-11-14" }]
  };
  const l = lines(d, "https://app.test");
  assert.equal(l[0].title, "Check in with Dre");
  assert.equal(l[0].href, "https://app.test/brother/g2");
  assert.equal(l[1].title, "Dre hasn't checked in since Nov 14");
});

test("one item puts the item in the subject", () => {
  const e = compose({ ...base, partner: [{ goalId: "g2", ownerName: "Dre", commitment: "Read daily", checkinDue: "2026-11-16" }] }, "https://app.test")!;
  assert.equal(e.subject, "Check in with Dre");
});

test("goal text is escaped in the html and every email carries the off link", () => {
  const e = compose({ ...base, own: [{ goalId: "g1", commitment: "<script>x</script> & more", checkinDue: "2026-11-16" }] }, "https://app.test")!;
  assert.ok(!e.html.includes("<script>x"));
  assert.ok(e.html.includes("&lt;script&gt;x&lt;/script&gt; &amp; more"));
  assert.ok(e.html.includes("https://app.test/reminders/off?u=tok-1"));
  assert.ok(e.text.includes("https://app.test/reminders/off?u=tok-1"));
});

test("a next step without a date is left out", () => {
  const l = lines({ ...base, own: [{ goalId: "g1", commitment: "Run", nextAction: "Stretch" }] }, "https://app.test");
  assert.equal(l.length, 0);
});
