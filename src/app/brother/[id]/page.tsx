"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PartnerBlockers } from "@/components/blockers";
import { Thread } from "@/components/thread";
import { Chip, Empty, HealthBadge, Loading, Shell } from "@/components/ui";
import { addDays, compare, FREQUENCY_LABEL, friendly, todayIn } from "@/lib/dates";
import { endPartnership, partnerCheckin, postShared, setPartnerCadence } from "@/lib/partners";
import { useApp } from "@/lib/store";
import { uid } from "@/lib/templates";
import type { Frequency, Partnership } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <BrotherGoal />
    </Suspense>
  );
}

function BrotherGoal() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const app = useApp();
  if (!app) return <Loading />;
  const p = app.partnerships?.find((x) => x.goalId === id);
  const lmtlss = app.settings.lmtlssMode;
  if (!p)
    return (
      <Shell lmtlss={lmtlss}>
        <Empty title="Not shared with you" body="This goal isn't shared with you, or the partnership ended." href="/" cta="Home" />
      </Shell>
    );
  return (
    <Shell lmtlss={lmtlss}>
      <View p={p} today={todayIn(app.settings.timeZone)} tz={app.settings.timeZone} isNew={search.get("new") === "1"} />
    </Shell>
  );
}

function View({ p, today, tz, isNew }: { p: Partnership; today: string; tz: string; isNew: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "checkin" | "suggest" | "rhythm" | "leave">(p.cadence ? "none" : "rhythm");
  const [tab, setTab] = useState<"goal" | "blockers" | "talk">("goal");
  // Blockers he hasn't weighed in on yet.
  const unread = (p.blockers ?? []).filter((b) => b.status !== "cleared" && !b.partnerView).length;
  const due = p.cadence && compare(p.cadence.nextDue, today) <= 0;
  const late = p.cadence && compare(p.cadence.nextDue, today) < 0;
  const g = p.guided ?? {};

  return (
    <div className="space-y-6">
      {isNew && (
        <div className="animate-rise rounded-2xl border border-gold/50 bg-gold/10 px-5 py-4">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-gold-soft">You&apos;re in.</p>
          <p className="text-sm text-bone-dim">Pick how often you&apos;ll reach out to {p.ownerName}. That&apos;s your side of the deal.</p>
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-5 border-b border-ink-700 bg-ink/95 px-5 pb-3 pt-2 backdrop-blur-md">
      <header>
        <p className="eyebrow">Walking with {p.ownerName}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <HealthBadge health={p.health} />
          {p.lifecycle === "completed" && <span className="rounded-full border border-gold/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-soft">✓ Completed</span>}
        </div>
        <h1 className="mt-3 font-display text-[26px] line-clamp-2 font-extrabold uppercase leading-[0.95]">{p.commitment}</h1>
      </header>
        <div role="tablist" aria-label="Sections" className="mt-3 flex gap-1">
          {(
            [
              ["goal", "His Goal", !!due],
              ["blockers", "Blockers", unread > 0],
              ["talk", "Talk", false]
            ] as const
          ).map(([id, label, dot]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative min-h-[40px] rounded-full px-4 text-sm font-semibold transition ${tab === id ? "bg-bone text-ink" : "text-bone-mute hover:text-bone"}`}
            >
              {label}
              {dot && <span aria-label="needs attention" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "goal" && (
        <div className="space-y-6">
      {p.nextAction && (
        <section className="card p-5">
          <p className="eyebrow">His next step</p>
          <p className="mt-2 text-lg font-semibold">{p.nextAction}</p>
          {p.nextActionDate && <p className={`text-sm ${compare(p.nextActionDate, today) < 0 ? "text-bad" : "text-bone-mute"}`}>Due {friendly(p.nextActionDate, today)}</p>}
        </section>
      )}

      <section className={`card p-5 ${due ? "border-gold/50" : ""}`}>
        <p className="eyebrow">Your check-in</p>
        {p.cadence ? (
          <p className="mt-2 text-bone-dim">
            {FREQUENCY_LABEL[p.cadence.frequency]} ·{" "}
            <span className={late ? "text-bad" : due ? "text-gold" : ""}>
              {late ? "overdue since " : "next "}
              {friendly(p.cadence.nextDue, today)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-bone-mute">Set how often you&apos;ll reach out.</p>
        )}
        {mode === "checkin" ? (
          <PartnerCheckinForm p={p} tz={tz} onDone={() => setMode("none")} />
        ) : mode === "rhythm" ? (
          <RhythmForm p={p} today={today} tz={tz} onDone={() => setMode("none")} />
        ) : (
          <div className="mt-4 flex gap-2">
            <button className={`${due ? "btn-gold" : "btn-ghost"} flex-1`} onClick={() => setMode("checkin")} disabled={p.lifecycle !== "active"}>
              Check In on a Brother
            </button>
            <button className="btn-ghost px-4" onClick={() => setMode("rhythm")}>
              Rhythm
            </button>
          </div>
        )}
      </section>

      {p.items.length > 0 && (
        <section>
          <p className="eyebrow mb-3">His plan</p>
          <ul className="card divide-y divide-ink-700">
            {p.items.map((i) => (
              <li key={i.id} className="flex min-h-[52px] items-center gap-3 px-4">
                <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs ${i.completed ? "border-gold bg-gold text-ink" : "border-bone-mute/50"}`}>
                  {i.completed && "✓"}
                </span>
                <span className={`flex-1 truncate ${i.completed ? "text-bone-mute line-through" : ""}`}>{i.title}</span>
                {i.dueDate && <span className="text-xs text-bone-mute">{friendly(i.dueDate, today)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(g.outcome || g.why || g.measure || g.plan) && (
        <section className="card divide-y divide-ink-700">
          {[
            ["Done looks like", g.outcome],
            ["Measured by", g.measure],
            ["Plan", g.plan],
            ["Why it matters", g.why]
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="px-5 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-bone-mute">{k}</p>
                <p className="mt-0.5">{v}</p>
              </div>
            ))}
        </section>
      )}

      {mode === "leave" ? (
        <div className="rounded-xl border border-bad/40 p-4">
          <p className="text-sm">Step away from {p.ownerName}&apos;s goal? You&apos;ll lose access right away.</p>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1 border-bad/50 text-bad"
              onClick={async () => {
                await endPartnership(p.goalId);
                router.push("/");
              }}
            >
              Step Away
            </button>
            <button className="btn-ghost" onClick={() => setMode("none")}>
              Stay
            </button>
          </div>
        </div>
      ) : (
        <button className="w-full py-3 text-sm text-bone-mute hover:text-bone" onClick={() => setMode("leave")}>
          Step away from this goal
        </button>
      )}
        </div>
      )}

      {tab === "blockers" && <PartnerBlockers blockers={p.blockers ?? []} ownerName={p.ownerName} />}

      {tab === "talk" && (
        <div className="space-y-6">
      <Thread entries={p.thread} today={today} viewer="partner" onPost={(t) => postShared(p.goalId, "question", t)} postLabel="Ask him" />

      {mode === "suggest" ? (
        <SuggestForm p={p} onDone={() => setMode("none")} />
      ) : (
        <button className="btn-ghost w-full" onClick={() => setMode("suggest")} disabled={p.lifecycle !== "active"}>
          Suggest a Sharper Goal
        </button>
      )}

        </div>
      )}
    </div>
  );
}

function PartnerCheckinForm({ p, tz, onDone }: { p: Partnership; tz: string; onDone: () => void }) {
  const [submissionId] = useState(uid);
  const [saw, setSaw] = useState("");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !saw.trim()) return;
        setBusy(true);
        try {
          await partnerCheckin(p, submissionId, saw.trim(), ask.trim(), tz);
          onDone();
        } catch (er) {
          setErr(er instanceof Error ? er.message : "Couldn't send.");
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="saw" className="label">
          What progress did you see?
        </label>
        <textarea id="saw" rows={2} className="field resize-none" placeholder="He made the calls. Two said yes." value={saw} onChange={(e) => setSaw(e.target.value)} />
      </div>
      <div>
        <label htmlFor="ask" className="label">
          What question or challenge will help him take the next step?
        </label>
        <textarea id="ask" rows={2} className="field resize-none" placeholder="What's stopping you from asking the third man today?" value={ask} onChange={(e) => setAsk(e.target.value)} />
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1" disabled={busy || !saw.trim()}>
          Post My Check-in
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RhythmForm({ p, today, tz, onDone }: { p: Partnership; today: string; tz: string; onDone: () => void }) {
  const [frequency, setFrequency] = useState<Frequency>(p.cadence?.frequency ?? "weekly");
  const [first, setFirst] = useState(p.cadence?.nextDue ?? addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
          <Chip key={f} on={frequency === f} onClick={() => setFrequency(f)}>
            {FREQUENCY_LABEL[f]}
          </Chip>
        ))}
      </div>
      <div>
        <label htmlFor="first" className="label">
          First check-in
        </label>
        <input id="first" type="date" className="field w-auto py-2.5" value={first} min={today} onChange={(e) => e.target.value && setFirst(e.target.value)} />
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex gap-2">
        <button
          className="btn-gold flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setPartnerCadence(p.goalId, frequency, first, tz);
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Couldn't save.");
              setBusy(false);
            }
          }}
        >
          Save Rhythm
        </button>
        {p.cadence && (
          <button className="btn-ghost" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function SuggestForm({ p, onDone }: { p: Partnership; onDone: () => void }) {
  const [why, setWhy] = useState("");
  const [commitment, setCommitment] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const any = commitment.trim() || nextAction.trim() || outcome.trim();
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!any || busy) return;
        setBusy(true);
        await postShared(p.goalId, "suggestion", why.trim(), {
          commitment: commitment.trim() || undefined,
          nextAction: nextAction.trim() || undefined,
          outcome: outcome.trim() || undefined
        });
        onDone();
      }}
    >
      <p className="font-display text-xl font-bold uppercase">Suggest a sharper goal</p>
      <p className="text-sm text-bone-mute">He decides whether to use it. Fill in only what you&apos;d change.</p>
      <input className="field" aria-label="Commitment" placeholder={p.commitment} value={commitment} onChange={(e) => setCommitment(e.target.value)} />
      <input className="field" aria-label="Next step" placeholder={p.nextAction ?? "A clearer next step"} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
      <input className="field" aria-label="What done looks like" placeholder="What done looks like" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      <textarea rows={2} className="field resize-none" aria-label="Why" placeholder="Why you'd change it (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1" disabled={!any || busy}>
          Send Suggestion
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
