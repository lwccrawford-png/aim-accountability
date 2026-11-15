// Shared by the edge function (Deno) and the app (copy-prompt fallback).
// No imports, so both runtimes can load it as-is.

export type AssistKind = "start" | "blocker";

export interface StartInput {
  commitment: string;
  category?: string;
  lmtlss?: boolean;
}

export interface BlockerInput {
  commitment: string;
  blocker: string;
  view?: "perceived" | "real";
  lmtlss?: boolean;
}

export interface Suggestion {
  title: string;
  why: string;
}

// Words that mean a man may be in danger. The helper won't coach through this;
// it shows the 988 line instead. Kept broad on purpose.
const CRISIS =
  /\b(kill(ing)? myself|suicid\w*|end (it all|my life)|take my (own )?life|want(ed)? to die|don'?t want to (live|be here)|better off dead|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself|no reason to live|overdose)\b/i;

export const looksLikeCrisis = (...texts: (string | undefined)[]) => texts.some((t) => !!t && CRISIS.test(t));

const RULES = [
  "Write for a man who wants to act but doesn't know where to start.",
  "Plain, direct words. Each title starts with a verb and is under 12 words.",
  "Every item must be doable within 7 days, by him, without spending much money.",
  "Each 'why' is one short sentence.",
  "No medical, legal or financial advice. If the goal needs a professional, one item can be to book time with one.",
  "Don't invent facts, statistics, quotes or Bible verses.",
  "Answer with JSON only."
];

const faith = (on?: boolean) =>
  on
    ? "He has turned on faith mode: you may include practices like prayer, asking a pastor or mentor, or Scripture reading, plainly and without preaching."
    : "Keep it free of religious content.";

const clip = (s: string, n = 300) => s.replace(/\s+/g, " ").trim().slice(0, n);

export function buildStartPrompt(i: StartInput) {
  const system = [
    "You help men take the first concrete step toward a goal.",
    ...RULES,
    faith(i.lmtlss),
    'Return {"steps":[{"title":"...","why":"..."}]} with exactly 4 first steps, smallest first.'
  ].join("\n");
  const user = `My goal: ${clip(i.commitment)}${i.category ? `\nArea of life: ${clip(i.category, 40)}` : ""}\nGive me 4 first steps I could take this week.`;
  return { system, user };
}

export function buildBlockerPrompt(i: BlockerInput) {
  const how =
    i.view === "perceived"
      ? "He calls it PERCEIVED: a fear, story or assumption. Suggest small, low-risk tests that would show whether it's true."
      : i.view === "real"
        ? "He calls it REAL: a hard limit like time, money, a person or a skill. Suggest ways around it, through it, or help to ask for."
        : "He hasn't decided if it's perceived or real. Suggest one test and two ways around it.";
  const system = [
    "You help a man move past one thing in the way of his goal.",
    ...RULES,
    faith(i.lmtlss),
    how,
    'Return {"steps":[{"title":"...","why":"..."}]} with exactly 3 moves.'
  ].join("\n");
  const user = `My goal: ${clip(i.commitment)}\nWhat's in the way: ${clip(i.blocker)}\nGive me 3 moves.`;
  return { system, user };
}

/** One block of text for pasting into ChatGPT, Claude or any AI. */
export function copyablePrompt(p: { system: string; user: string }) {
  return `${p.system.replace("Answer with JSON only.", "Answer as a short numbered list.").replace(/Return \{.*$/m, "")}\n\n${p.user}`;
}

/** Pull suggestions out of a model reply, tolerating stray text around the JSON. */
export function parseSuggestions(raw: string, max: number): Suggestion[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const data = JSON.parse(m[0]) as { steps?: unknown };
    if (!Array.isArray(data.steps)) return [];
    return data.steps
      .filter((s): s is Suggestion => !!s && typeof (s as Suggestion).title === "string")
      .map((s) => ({ title: clip(s.title, 120), why: clip(typeof s.why === "string" ? s.why : "", 200) }))
      .filter((s) => s.title)
      .slice(0, max);
  } catch {
    return [];
  }
}
