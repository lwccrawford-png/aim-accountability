"use client";

import { useState } from "react";
import { BlockerIdeas } from "@/components/help-me-start";
import { setBlockerView } from "@/lib/partners";
import { addBlocker, removeBlocker, updateBlocker } from "@/lib/store";
import type { Blocker, BlockerStatus, BlockerView, Goal } from "@/lib/types";

export const VIEW_COPY: Record<BlockerView, { label: string; short: string; prompt: string; placeholder: string }> = {
  perceived: {
    label: "Perceived",
    short: "A fear, a story, an assumption. It feels solid but hasn't been tested.",
    prompt: "What's the smallest test that would prove it wrong?",
    placeholder: "Ask one man this week and see what he says"
  },
  real: {
    label: "Real",
    short: "Time, money, a person, a skill. It's there whether you feel it or not.",
    prompt: "What's one way around it, through it, or with help?",
    placeholder: "Trade Saturday mornings with my wife for two weeks"
  }
};

const STATUS: { id: BlockerStatus; label: string }[] = [
  { id: "named", label: "Named" },
  { id: "tested", label: "Tested" },
  { id: "cleared", label: "Cleared" }
];

export function ViewPicker({ value, onChange, size = "md" }: { value?: BlockerView; onChange: (v: BlockerView) => void; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label="Perceived or real" className="grid grid-cols-2 gap-2">
      {(Object.keys(VIEW_COPY) as BlockerView[]).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-xl border px-3 text-left transition ${size === "sm" ? "min-h-[44px] py-2" : "min-h-[64px] py-3"} ${
            value === v ? (v === "perceived" ? "border-gold bg-gold/15" : "border-bone bg-bone/10") : "border-ink-600 hover:border-bone-mute"
          }`}
        >
          <span className={`block font-display text-base font-bold uppercase tracking-wide ${value === v && v === "perceived" ? "text-gold-soft" : ""}`}>
            <span aria-hidden className="mr-1">{v === "perceived" ? "◌" : "■"}</span>
            {VIEW_COPY[v].label}
          </span>
          {size === "md" && <span className="mt-0.5 block text-xs leading-snug text-bone-mute">{VIEW_COPY[v].short}</span>}
        </button>
      ))}
    </div>
  );
}

/** Owner's Blockers tab. */
export function Blockers({ goal, editable, lmtlss = false }: { goal: Goal; today: string; editable: boolean; lmtlss?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [showCleared, setShowCleared] = useState(false);
  const all = goal.blockers ?? [];
  const open = all.filter((b) => b.status !== "cleared");
  const cleared = all.filter((b) => b.status === "cleared");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-700 px-5 py-4">
        <p className="text-sm text-bone-dim">
          Name what&apos;s in the way, then call it. <span className="text-gold-soft">Perceived</span> blockers shrink when you test them.{" "}
          <span className="text-bone">Real</span> ones need a way around.
          {goal.sharing?.partner ? ` ${goal.sharing.partner.name} can add his read.` : " A brother can add his read."}
        </p>
      </div>

      {editable && (adding ? <NewBlocker goalId={goal.id} onDone={() => setAdding(false)} /> : (
        <button className="btn-gold w-full" onClick={() => setAdding(true)}>
          Name a Blocker
        </button>
      ))}

      {open.length === 0 && !adding && <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">Nothing named yet. When something gets in the way at check-in, it lands here too.</p>}

      <ul className="space-y-3">
        {open.map((b) => (
          <BlockerCard key={b.id} goal={goal} b={b} editable={editable} lmtlss={lmtlss} />
        ))}
      </ul>

      {cleared.length > 0 && (
        <div>
          <button className="text-sm text-bone-mute hover:text-bone" onClick={() => setShowCleared((s) => !s)} aria-expanded={showCleared}>
            {showCleared ? "Hide" : "Show"} {cleared.length} cleared
          </button>
          {showCleared && (
            <ul className="mt-3 space-y-2">
              {cleared.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl border border-ink-700 px-4 py-3 text-sm">
                  <span aria-hidden className="text-gold">✓</span>
                  <span className="flex-1 text-bone-dim line-through decoration-bone-mute/50">{b.text}</span>
                  {editable && (
                    <button className="text-xs text-bone-mute hover:text-bone" onClick={() => updateBlocker(goal.id, b.id, { status: "named" })}>
                      Reopen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NewBlocker({ goalId, onDone }: { goalId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [view, setView] = useState<BlockerView>();
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        addBlocker(goalId, text, view);
        onDone();
      }}
    >
      <div>
        <label htmlFor="blk" className="label">
          What&apos;s in the way?
        </label>
        <input id="blk" className="field" placeholder="I don't think anyone would come" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </div>
      <div>
        <p className="label">How do you see it?</p>
        <ViewPicker value={view} onChange={setView} />
        <p className="mt-2 text-xs text-bone-mute">Not sure? Leave it. Your brother can weigh in first.</p>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1" disabled={!text.trim()}>
          Name It
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function BlockerCard({ goal, b, editable, lmtlss }: { goal: Goal; b: Blocker; editable: boolean; lmtlss: boolean }) {
  const goalId = goal.id;
  const [move, setMove] = useState(b.nextMove ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const view = b.ownerView;
  const differ = b.ownerView && b.partnerView && b.ownerView !== b.partnerView;
  return (
    <li className="card space-y-4 p-5">
      <p className="text-lg font-semibold leading-snug">{b.text}</p>

      <div>
        <p className="label">Your call</p>
        {editable ? <ViewPicker size="sm" value={view} onChange={(v) => updateBlocker(goalId, b.id, { ownerView: v })} /> : <p>{view ? VIEW_COPY[view].label : "Not called"}</p>}
      </div>

      {b.partnerView ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${differ ? "border-gold/50 bg-gold/[0.06]" : "border-ink-600"}`}>
          <p>
            <span className="font-semibold">{b.partnerName ?? "Your brother"}</span> reads it as{" "}
            <span className="font-semibold">{VIEW_COPY[b.partnerView].label.toLowerCase()}</span>
            {differ && <span className="text-gold-soft"> (you see it differently)</span>}.
          </p>
          {b.partnerNote && <p className="mt-1 text-bone-dim">“{b.partnerNote}”</p>}
          {differ && editable && (
            <button className="mt-2 text-xs font-semibold uppercase tracking-wider text-gold hover:underline" onClick={() => updateBlocker(goalId, b.id, { ownerView: b.partnerView })}>
              Go with his read
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-bone-mute">Waiting on your brother&apos;s read.</p>
      )}

      {view && (
        <div>
          <label htmlFor={`mv-${b.id}`} className="label">
            {VIEW_COPY[view].prompt}
          </label>
          <div className="flex gap-2">
            <input
              id={`mv-${b.id}`}
              className="field py-3"
              placeholder={VIEW_COPY[view].placeholder}
              value={move}
              disabled={!editable}
              onChange={(e) => setMove(e.target.value)}
              onBlur={() => move !== (b.nextMove ?? "") && updateBlocker(goalId, b.id, { nextMove: move.trim() || undefined })}
            />
          </div>
          {editable && (
            <div className="mt-2">
              <BlockerIdeas
                commitment={goal.commitment}
                blocker={b.text}
                view={view}
                lmtlss={lmtlss}
                onPick={(m) => {
                  setMove(m);
                  updateBlocker(goalId, b.id, { nextMove: m });
                }}
              />
            </div>
          )}
        </div>
      )}

      {editable && (
        <div className="flex items-center gap-1" role="group" aria-label="Progress">
          {STATUS.map((s, i) => {
            const on = STATUS.findIndex((x) => x.id === b.status) >= i;
            return (
              <button
                key={s.id}
                onClick={() => updateBlocker(goalId, b.id, { status: s.id })}
                aria-pressed={b.status === s.id}
                className={`min-h-[40px] flex-1 rounded-lg border text-xs font-bold uppercase tracking-[0.12em] transition ${
                  on ? "border-gold/60 bg-gold/15 text-gold-soft" : "border-ink-600 text-bone-mute hover:text-bone"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {editable &&
        (confirmRemove ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-bone-mute">Remove this blocker?</span>
            <span className="flex gap-3">
              <button className="text-bad" onClick={() => removeBlocker(goalId, b.id)}>
                Remove
              </button>
              <button className="text-bone-mute" onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </span>
          </div>
        ) : (
          <button className="text-xs text-bone-mute hover:text-bone" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        ))}
    </li>
  );
}

/** The brother's side: his read on each open blocker. */
export function PartnerBlockers({ blockers, ownerName }: { blockers: Blocker[]; ownerName: string }) {
  const open = blockers.filter((b) => b.status !== "cleared");
  if (open.length === 0) return <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">{ownerName} hasn&apos;t named anything in the way yet.</p>;
  return (
    <ul className="space-y-3">
      {open.map((b) => (
        <PartnerBlocker key={b.id} b={b} ownerName={ownerName} />
      ))}
    </ul>
  );
}

function PartnerBlocker({ b, ownerName }: { b: Blocker; ownerName: string }) {
  const [view, setView] = useState<BlockerView | undefined>(b.partnerView);
  const [note, setNote] = useState(b.partnerNote ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const dirty = view !== b.partnerView || note !== (b.partnerNote ?? "");
  return (
    <li className="card space-y-4 p-5">
      <p className="text-lg font-semibold leading-snug">{b.text}</p>
      <p className="text-sm text-bone-mute">
        {ownerName} calls it {b.ownerView ? <span className="text-bone">{VIEW_COPY[b.ownerView].label.toLowerCase()}</span> : "nothing yet"}.
        {b.nextMove && <> His move: <span className="text-bone">{b.nextMove}</span></>}
      </p>
      <div>
        <p className="label">Your read</p>
        <ViewPicker value={view} onChange={(v) => { setView(v); setSaved(false); }} />
      </div>
      <input className="field" aria-label="Why you see it that way" placeholder="Why you see it that way (optional)" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <button
        className="btn-gold w-full"
        disabled={!view || busy || (!dirty && !!b.partnerView)}
        onClick={async () => {
          if (!view) return;
          setBusy(true);
          setErr("");
          try {
            await setBlockerView(b.id, view, note);
            setSaved(true);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {saved && !dirty ? "Sent" : "Send My Read"}
      </button>
    </li>
  );
}
