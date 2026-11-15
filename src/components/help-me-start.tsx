"use client";

import { useState } from "react";
import { suggestBlockerMoves, suggestFirstSteps, type AssistResult } from "@/lib/ai";

export function CrisisCard() {
  return (
    <div role="alert" className="rounded-2xl border border-bone/40 bg-bone/[0.06] p-5">
      <p className="font-display text-lg font-bold uppercase">You matter more than any goal.</p>
      <p className="mt-2 text-sm text-bone-dim">
        If you&apos;re thinking about ending your life or hurting yourself, call or text <a className="font-semibold text-gold underline" href="tel:988">988</a>{" "}
        (Suicide &amp; Crisis Lifeline, US) now. If you&apos;re in danger, call <a className="font-semibold text-gold underline" href="tel:911">911</a>.
      </p>
      <p className="mt-2 text-sm text-bone-dim">Then tell one man you trust today. You don&apos;t carry this alone.</p>
    </div>
  );
}

function Suggestions({
  result,
  onPick,
  pickLabel
}: {
  result: AssistResult;
  onPick: (s: string) => void;
  pickLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  if (result.kind === "crisis") return <CrisisCard />;
  if (result.kind === "ok")
    return (
      <ul className="space-y-2">
        {result.steps.map((s) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => onPick(s.title)}
              className="w-full rounded-xl border border-ink-600 px-4 py-3 text-left transition hover:border-gold/60 active:scale-[.99]"
            >
              <span className="block font-medium">{s.title}</span>
              {s.why && <span className="mt-0.5 block text-xs text-bone-mute">{s.why}</span>}
              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{pickLabel}</span>
            </button>
          </li>
        ))}
        <li className="pt-1 text-xs text-bone-mute">Ideas from an AI. Edit anything, or write your own.</li>
      </ul>
    );
  // No live AI: hand him a prompt for whatever AI he already uses.
  return (
    <div className="space-y-3 rounded-xl border border-ink-600 p-4">
      <p className="text-sm text-bone-dim">
        {result.kind === "limit"
          ? "You've used today's ideas. Copy this into ChatGPT, Claude or any AI for more."
          : "Copy this into ChatGPT, Claude or any AI you use, then bring back the step you like."}
      </p>
      <textarea readOnly rows={4} aria-label="Prompt" className="field resize-none text-xs" value={result.prompt} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(result.prompt);
            setCopied(true);
          } catch {
            /* the box is selectable */
          }
        }}
      >
        {copied ? "Copied" : "Copy Prompt"}
      </button>
    </div>
  );
}

/** "I don't know where to start": suggests first steps for a commitment. */
export function HelpMeStart({ commitment, lmtlss, onPick, category }: { commitment: string; lmtlss: boolean; onPick: (step: string) => void; category?: string }) {
  const [result, setResult] = useState<AssistResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (!result)
    return (
      <button
        type="button"
        disabled={!commitment.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setResult(await suggestFirstSteps({ commitment, lmtlss, category }));
          setBusy(false);
        }}
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gold/40 px-4 text-sm font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-40"
      >
        <span aria-hidden>✦</span> {busy ? "Thinking…" : "Not sure? Help Me Start"}
      </button>
    );
  return (
    <div className="mt-4 space-y-2">
      <Suggestions
        result={result}
        pickLabel="Use this step"
        onPick={(s) => {
          onPick(s);
          setResult(null);
        }}
      />
      <button type="button" className="text-sm text-bone-mute hover:text-bone" onClick={() => setResult(null)}>
        Close
      </button>
    </div>
  );
}

/** Ideas for getting past one blocker. */
export function BlockerIdeas({
  commitment,
  blocker,
  view,
  lmtlss,
  onPick
}: {
  commitment: string;
  blocker: string;
  view?: "perceived" | "real";
  lmtlss: boolean;
  onPick: (move: string) => void;
}) {
  const [result, setResult] = useState<AssistResult | null>(null);
  const [busy, setBusy] = useState(false);
  if (!result)
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setResult(await suggestBlockerMoves({ commitment, blocker, view, lmtlss }));
          setBusy(false);
        }}
        className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-gold hover:underline disabled:opacity-40"
      >
        <span aria-hidden>✦</span> {busy ? "Thinking…" : "Ideas for this"}
      </button>
    );
  return (
    <div className="space-y-2">
      <Suggestions
        result={result}
        pickLabel="Make this my move"
        onPick={(s) => {
          onPick(s);
          setResult(null);
        }}
      />
      <button type="button" className="text-sm text-bone-mute hover:text-bone" onClick={() => setResult(null)}>
        Close
      </button>
    </div>
  );
}
