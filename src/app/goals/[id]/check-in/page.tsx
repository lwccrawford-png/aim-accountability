"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Empty, HealthPicker, Loading, Shell } from "@/components/ui";
import { compare, friendly, todayIn } from "@/lib/dates";
import { submitCheckin, useApp } from "@/lib/store";
import { uid } from "@/lib/templates";
import type { Goal, Health } from "@/lib/types";

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const app = useApp();
  if (!app) return <Loading />;
  const goal = app.goals.find((g) => g.id === id && g.lifecycle === "active");
  const lmtlss = app.settings.lmtlssMode;
  return (
    <Shell lmtlss={lmtlss}>
      {goal ? (
        <CheckIn goal={goal} today={todayIn(app.settings.timeZone)} lmtlss={lmtlss} />
      ) : (
        <Empty title="Nothing to check in on" body="This goal isn't active." href="/goals" cta="My Goals" />
      )}
    </Shell>
  );
}

function CheckIn({ goal, today, lmtlss }: { goal: Goal; today: string; lmtlss: boolean }) {
  const router = useRouter();
  // One key per open form: a double tap or a retry applies once.
  const [submissionId] = useState(uid);
  const [did, setDid] = useState("");
  const [blocker, setBlocker] = useState("");
  const [next, setNext] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [health, setHealth] = useState<Health>(goal.health);
  const [sent, setSent] = useState(false);

  const due = goal.cadence && compare(goal.cadence.nextDue, today) <= 0;
  const overdue = goal.cadence && compare(goal.cadence.nextDue, today) < 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (sent || !did.trim()) return;
        setSent(true);
        submitCheckin(goal.id, submissionId, { did: did.trim(), blocker: blocker.trim(), next: next.trim() }, health, next.trim() ? { text: next.trim(), date: nextDate || today } : undefined);
        router.push(`/goals/${goal.id}`);
      }}
    >
      <div>
        <p className="eyebrow">{overdue ? `Overdue since ${friendly(goal.cadence!.nextDue, today)}` : due ? "Due today" : "Extra check-in"}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Post My Check-in</h1>
        <p className="mt-3 text-bone-mute">{goal.commitment}</p>
        {!due && goal.cadence && (
          <p className="mt-2 text-sm text-bone-mute">Your next scheduled check-in stays on {friendly(goal.cadence.nextDue, today)}.</p>
        )}
      </div>
      <Q id="did" label="What did you do?" value={did} set={setDid} placeholder="What you actually got done" required />
      <Q id="blocker" label="What got in the way?" value={blocker} set={setBlocker} placeholder="Be honest. Time, energy, people, fear" />
      <div>
        <Q id="next" label="What will you do next?" value={next} set={setNext} placeholder={goal.nextAction ?? "One step, this week"} />
        {next.trim() && (
          <div className="mt-3 flex items-center gap-3">
            <label htmlFor="nextDate" className="text-sm text-bone-mute">
              By
            </label>
            <input id="nextDate" type="date" className="field w-auto py-2.5" value={nextDate || today} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        )}
      </div>
      <div>
        <p className="label">Where does it stand?</p>
        <HealthPicker value={health} onChange={setHealth} />
      </div>
      {lmtlss && (
        <p className="rounded-xl border border-gold/25 px-4 py-3 text-sm italic text-bone-dim">
          “Whatever you do, work heartily, as for the Lord and not for men.” <span className="not-italic text-bone-mute">Colossians 3:23</span>
        </p>
      )}
      <div className="sticky bottom-[61px] -mx-5 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pb-2 pt-6">
        <button type="submit" className="btn-gold w-full" disabled={sent || !did.trim()}>
          Post My Check-in
        </button>
      </div>
    </form>
  );
}

function Q({ id, label, value, set, placeholder, required }: { id: string; label: string; value: string; set: (v: string) => void; placeholder: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} rows={2} className="field resize-none" placeholder={placeholder} value={value} onChange={(e) => set(e.target.value)} required={required} />
    </div>
  );
}
