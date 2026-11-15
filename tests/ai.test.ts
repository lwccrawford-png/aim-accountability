import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBlockerPrompt, copyablePrompt, looksLikeCrisis, parseSuggestions } from "../supabase/functions/ai-assist/prompts.ts";

test("crisis language is caught, ordinary goals are not", () => {
  for (const t of ["I want to end it all", "thinking about suicide", "I don't want to live anymore", "been hurting myself"]) assert.ok(looksLikeCrisis(t), t);
  for (const t of ["Run a 5K", "Kill my debt by June", "Stop cutting corners at work", "Pay off the truck"]) assert.ok(!looksLikeCrisis(t), t);
});

test("model replies parse even with stray text, and are capped", () => {
  const raw = 'Sure! {"steps":[{"title":"Ask Ray","why":"He said maybe."},{"title":"Pick a night","why":""},{"title":"Book the room","why":"x"},{"title":"Extra","why":"y"}]} hope that helps';
  const s = parseSuggestions(raw, 3);
  assert.equal(s.length, 3);
  assert.equal(s[0].title, "Ask Ray");
  assert.deepEqual(parseSuggestions("no json here", 3), []);
  assert.deepEqual(parseSuggestions('{"steps":"nope"}', 3), []);
});

test("perceived blockers ask for tests; copy prompt drops the JSON instruction", () => {
  const p = buildBlockerPrompt({ commitment: "Host a men's group", blocker: "Nobody will come", view: "perceived" });
  assert.match(p.system, /PERCEIVED/);
  const c = copyablePrompt(p);
  assert.doesNotMatch(c, /JSON/);
  assert.match(c, /Nobody will come/);
});
