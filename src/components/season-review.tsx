"use client";

import Link from "next/link";
import { useState } from "react";
import { compare, friendly } from "@/lib/dates";
import { goalToInput, newRow, rowProblems, type Decision } from "@/lib/season";
import { archiveGoal, completeGoal, reopenGoal, restoreGoal, saveGoal } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { HealthBadge } from "@/components/ui";

interface Props {
  goal: Goal;
  today: string;
  decision?: Decision;
  onDecide: (d?: Decision) => void;
}

type Mode = "idle" | "revise" | "complete";

/** One existing goal on the Look back tab: carry it forward, revise it, finish it, or set it aside. */
export function ReviewCard({ goal, today, decision, onDecide }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const overdue = !!goal.nextActionDate && compare(goal.nextActionDate, today) < 0;

  if (goal.lifecycle === "completed" || goal.lifecycle === "archived") {
    const done = goal.lifecycle === "completed";
    return (
      <div className="card flex items-center justify-between gap-3 px-4 py-4 opacity-80">
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-bold uppercase tracking-wide text-bone-dim line-through decoration-bone-mute/60">
            {goal.commitment}
          </span>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${done ? "text-gold" : "text-bone-mute"}`}>
            {done ? "Completed" : "Archived"}
          </span>
        </span>
        <button
          type="button"
          className="min-h-[44px] shrink-0 px-2 text-sm text-bone-dim hover:text-gold"
          onClick={() => (done ? reopenGoal(goal.id) : restoreGoal(goal.id))}
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={`card px-4 py-4 ${decision ? "border-gold/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/goals/${goal.id}`} className="min-w-0 hover:text-gold-soft">
          <span className="block font-display text-lg font-bold uppercase leading-tight tracking-wide">{goal.commitment}</span>
        </Link>
        <HealthBadge health={goal.health} />
      </div>
      {goal.nextAction && (
        <p className="mt-2 text-sm text-bone-dim">
          Next: {goal.nextAction}
          {goal.nextActionDate && <span className={overdue ? "text-bad" : "text-bone-mute"}> · {friendly(goal.nextActionDate, today)}</span>}
        </p>
      )}

      {mode === "revise" && <Revise goal={goal} today={today} onCancel={() => setMode("idle")} onSaved={() => { setMode("idle"); onDecide("revised"); }} />}
      {mode === "complete" && <Finish goal={goal} onCancel={() => setMode("idle")} />}

      {mode === "idle" &&
        (decision ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-700 pt-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
                {decision === "carried" ? "Carried forward" : "Revised"}
              </span>
              {overdue && <span className="mt-1 block text-xs text-bone-mute">The next step is past due.</span>}
            </span>
            <span className="flex shrink-0 gap-1">
              {overdue && (
                <button type="button" className="min-h-[44px] px-2 text-sm text-gold" onClick={() => setMode("revise")}>
                  Update it
                </button>
              )}
              <button type="button" className="min-h-[44px] px-2 text-sm text-bone-mute hover:text-bone" onClick={() => onDecide(undefined)}>
                Change
              </button>
            </span>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn-gold min-h-[44px] px-3 text-sm" onClick={() => onDecide("carried")}>
              Carry forward
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" onClick={() => setMode("revise")}>
              Revise
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" onClick={() => setMode("complete")}>
              Complete
            </button>
            <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm text-bone-dim" onClick={() => archiveGoal(goal.id)}>
              Archive
            </button>
          </div>
        ))}
    </div>
  );
}

function Revise({ goal, today, onCancel, onSaved }: { goal: Goal; today: string; onCancel: () => void; onSaved: () => void }) {
  const [commitment, setCommitment] = useState(goal.commitment);
  const [nextAction, setNextAction] = useState(goal.nextAction ?? "");
  const [nextActionDate, setNextActionDate] = useState(goal.nextActionDate ?? "");
  const [tried, setTried] = useState(false);
  const problems = tried ? rowProblems({ ...newRow(goal.id), commitment, nextAction, nextActionDate }, today) : {};
  const fid = (f: string) => `rev-${goal.id}-${f}`;

  function save() {
    setTried(true);
    if (Object.keys(rowProblems({ ...newRow(goal.id), commitment, nextAction, nextActionDate }, today)).length) return;
    // Same goal id, so the history stays and the change is logged as a revision.
    saveGoal({ ...goalToInput(goal), commitment: commitment.trim(), nextAction: nextAction.trim(), nextActionDate }, false);
    onSaved();
  }

  return (
    <div className="mt-4 space-y-4 border-t border-ink-700 pt-4">
      <div>
        <label htmlFor={fid("c")} className="label">
          The commitment, as it stands now
        </label>
        <textarea id={fid("c")} rows={2} className={`field resize-none ${problems.commitment ? "border-bad" : ""}`} value={commitment} onChange={(e) => setCommitment(e.target.value)} />
        {problems.commitment && <p className="mt-2 text-sm text-bad">{problems.commitment}</p>}
      </div>
      <div>
        <label htmlFor={fid("a")} className="label">
          Next step
        </label>
        <input id={fid("a")} className={`field ${problems.nextAction ? "border-bad" : ""}`} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        {problems.nextAction && <p className="mt-2 text-sm text-bad">{problems.nextAction}</p>}
      </div>
      <div>
        <label htmlFor={fid("d")} className="label">
          When?
        </label>
        <input
          id={fid("d")}
          type="date"
          min={today}
          className={`field w-auto min-w-[10.5rem] ${problems.nextActionDate ? "border-bad" : ""}`}
          value={nextActionDate}
          onChange={(e) => setNextActionDate(e.target.value)}
        />
        {problems.nextActionDate && <p className="mt-2 text-sm text-bad">{problems.nextActionDate}</p>}
      </div>
      <p className="text-xs text-bone-mute">Check-ins, blockers and your brother stay with the goal.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-gold flex-1" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

function Finish({ goal, onCancel }: { goal: Goal; onCancel: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 space-y-4 border-t border-ink-700 pt-4">
      <div>
        <label htmlFor={`fin-${goal.id}`} className="label">
          How did it end? (optional)
        </label>
        <input id={`fin-${goal.id}`} className="field" placeholder="Ran the whole 5K without stopping" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-gold flex-1" onClick={() => completeGoal(goal.id, note.trim() || undefined)}>
          Mark complete
        </button>
      </div>
    </div>
  );
}
