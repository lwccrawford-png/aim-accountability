"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignInForm } from "@/components/account-card";
import { BrotherCard } from "@/components/brother-card";
import { Thread } from "@/components/thread";
import { Blockers } from "@/components/blockers";
import { HelpMeStart } from "@/components/help-me-start";
import { applySuggestion, dismissSuggestion, postShared } from "@/lib/partners";
import { Empty, HealthBadge, HealthPicker, LifecycleTag, Loading, Shell, healthLabel } from "@/components/ui";
import { categoryName, roomName } from "@/lib/catalog";
import { accountsEnabled } from "@/lib/supabase";
import { compare, FREQUENCY_LABEL, friendly, todayIn } from "@/lib/dates";
import {
  addItem,
  archiveGoal,
  completeGoal,
  completeNextAction,
  editItem,
  postUpdate,
  removeItem,
  reopenGoal,
  restoreGoal,
  setHealth,
  setNextAction,
  useApp
} from "@/lib/store";
import type { Goal, PlanItem, TimelineEntry } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <GoalDetail />
    </Suspense>
  );
}

function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const app = useApp();
  if (!app) return <Loading />;
  const lmtlss = app.settings.lmtlssMode;
  const goal = app.goals.find((g) => g.id === id);
  if (!goal)
    return (
      <Shell lmtlss={lmtlss}>
        <Empty title="Goal not found" body="It may have been removed on this device." href="/goals" cta="My Goals" />
      </Shell>
    );
  const today = todayIn(app.settings.timeZone);
  return (
    <Shell lmtlss={lmtlss}>
      <Detail lmtlss={lmtlss} goal={goal} today={today} justSet={search.get("new") === "1"} signedIn={!!app.account} initialTab={(["plan", "checkins", "blockers", "brother", "history"].includes(search.get("tab") ?? "") ? search.get("tab") : "plan") as Tab} />
    </Shell>
  );
}

type Tab = "plan" | "checkins" | "blockers" | "brother" | "history";

function Detail({ goal, today, justSet, signedIn, initialTab, lmtlss }: { goal: Goal; today: string; justSet: boolean; signedIn: boolean; initialTab: Tab; lmtlss: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const pickTab = (t: Tab) => {
    setTab(t);
    // Keep the tab in the address so Back and refresh land in the same place.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  };
  const router = useRouter();
  const editable = goal.lifecycle === "active";
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState("");
  const [update, setUpdate] = useState("");
  const [editingNext, setEditingNext] = useState(!goal.nextAction && editable);
  const [nextText, setNextText] = useState(goal.nextAction ?? "");
  const [nextDate, setNextDate] = useState(goal.nextActionDate ?? today);

  const isDraft = goal.lifecycle === "draft";
  useEffect(() => {
    if (isDraft) router.replace(`/goals/${goal.id}/edit`);
  }, [isDraft, goal.id, router]);
  if (isDraft) return null;

  const g = goal.guided ?? {};
  const guidedRows = [
    ["Done looks like", g.outcome],
    ["Measured by", g.measure],
    ["Plan", g.plan],
    ["Why it matters", g.why],
    ["Finish by", g.targetDate && friendly(g.targetDate, today)]
  ].filter(([, v]) => v) as [string, string][];

  const checkinDue = goal.cadence && compare(goal.cadence.nextDue, today) <= 0;
  const openBlockers = (goal.blockers ?? []).filter((b) => b.status !== "cleared").length;
  const pendingSuggestions = goal.timeline.filter((e) => e.kind === "suggestion" && !e.resolution).length;

  const tabs = [
    { id: "plan", label: "Plan" },
    { id: "checkins", label: "Check-ins", dot: !!checkinDue },
    { id: "blockers", label: "Blockers", dot: openBlockers > 0 },
    { id: "brother", label: "Brother", dot: pendingSuggestions > 0 },
    { id: "history", label: "History" }
  ] as const;

  return (
    <div className="space-y-5">
      {justSet && editable && (
        <div className="animate-rise rounded-2xl border border-gold/50 bg-gold/10 px-5 py-4">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-gold-soft">Goal set.</p>
          <p className="text-sm text-bone-dim">You said it out loud. Now take the first step.</p>
        </div>
      )}

      {justSet && editable && accountsEnabled && !signedIn && (
        <section className="card p-5">
          <p className="eyebrow">Keep it</p>
          <p className="mt-2 text-bone-dim">Right now this goal lives on this phone. Add your email and it follows you to any device.</p>
          <div className="mt-4">
            <SignInForm next={`/goals/${goal.id}`} cta="Save It to My Account" />
          </div>
        </section>
      )}

      <header className="sticky top-0 z-10 -mx-5 border-b border-ink-700 bg-ink/95 px-5 pb-3 pt-2 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <h1 className="line-clamp-2 font-display text-[26px] font-extrabold uppercase leading-[0.95] tracking-tight">{goal.commitment}</h1>
          <HealthBadge health={goal.health} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {goal.lifecycle !== "active" && <LifecycleTag value={goal.lifecycle} />}
          {goal.category && <span className="text-[11px] uppercase tracking-[0.14em] text-bone-mute">{categoryName(goal.category)}</span>}
          {goal.roomIds.map((r) => (
            <Link key={r} href="/rooms" className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
              {roomName(r)}
            </Link>
          ))}
        </div>
        <div role="tablist" aria-label="Goal sections" className="-mx-5 mt-3 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => pickTab(t.id)}
              className={`relative min-h-[40px] shrink-0 rounded-full px-3 text-[13px] font-semibold transition ${
                tab === t.id ? "bg-bone text-ink" : "text-bone-mute hover:text-bone"
              }`}
            >
              {t.label}
              {"dot" in t && t.dot && <span aria-label="needs attention" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />}
            </button>
          ))}
        </div>
      </header>

      <div role="tabpanel" className="space-y-6">
        {tab === "plan" && (
          <>
      {editable && (
        <section className="card p-5">
          <p className="eyebrow">Next action</p>
          {editingNext ? (
            <div className="mt-3 space-y-3">
              <input className="field" aria-label="Next action" placeholder="One step you can take" value={nextText} onChange={(e) => setNextText(e.target.value)} />
              <HelpMeStart commitment={goal.commitment} lmtlss={lmtlss} category={categoryName(goal.category)} onPick={setNextText} />
              <div className="flex gap-2">
                <input type="date" aria-label="When" className="field w-auto py-2.5" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                <button
                  className="btn-gold flex-1"
                  disabled={!nextText.trim() || !nextDate}
                  onClick={() => {
                    setNextAction(goal.id, nextText.trim(), nextDate);
                    setEditingNext(false);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold">{goal.nextAction}</p>
              <p className={`text-sm ${goal.nextActionDate && compare(goal.nextActionDate, today) < 0 ? "text-bad" : "text-bone-mute"}`}>
                {goal.nextActionDate && compare(goal.nextActionDate, today) < 0 ? "Was due " : "Due "}
                {friendly(goal.nextActionDate, today)}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  className="btn-gold flex-1"
                  onClick={() => {
                    const before = goal.nextAction;
                    completeNextAction(goal.id);
                    setNextText("");
                    setNextDate(today);
                    // If nothing in the plan is left to suggest, ask for the next step.
                    if (![...goal.tasks, ...goal.milestones].some((i) => !i.completed && i.title !== before)) setEditingNext(true);
                  }}
                >
                  ✓ Done
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setNextText(goal.nextAction ?? "");
                    setNextDate(goal.nextActionDate ?? today);
                    setEditingNext(true);
                  }}
                >
                  Change
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {editable && (
        <section className="space-y-3">
          <p className="eyebrow">How&apos;s it going?</p>
          <HealthPicker value={goal.health} onChange={(h) => setHealth(goal.id, h)} />
          <textarea
            rows={2}
            className="field resize-none"
            placeholder="Post a quick update"
            aria-label="Update"
            value={update}
            onChange={(e) => setUpdate(e.target.value)}
          />
          <button
            className="btn-ghost w-full"
            disabled={!update.trim()}
            onClick={() => {
              postUpdate(goal.id, update.trim());
              setUpdate("");
            }}
          >
            Post Update
          </button>
        </section>
      )}

      {(goal.tasks.length > 0 || editable) && <PlanList goal={goal} list="tasks" label="Tasks" today={today} editable={editable} />}
      {(goal.milestones.length > 0 || (editable && goal.template === "goal30")) && (
        <PlanList goal={goal} list="milestones" label="Milestones" today={today} editable={editable} />
      )}

      {guidedRows.length > 0 && (
        <section className="card divide-y divide-ink-700">
          {guidedRows.map(([k, v]) => (
            <div key={k} className="px-5 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-bone-mute">{k}</p>
              <p className="mt-0.5">{v}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        {editable && (
          <Link href={`/goals/${goal.id}/edit`} className="btn-ghost w-full">
            Edit the Plan
          </Link>
        )}
        {editable && !finishing && (
          <button className="btn-ghost w-full border-gold/50 text-gold" onClick={() => setFinishing(true)}>
            Mark Complete
          </button>
        )}
        {finishing && (
          <div className="card space-y-3 border-gold/50 p-5">
            <p className="font-display text-xl font-bold uppercase">Finish it</p>
            <textarea
              rows={2}
              className="field resize-none"
              placeholder="What do you want to remember about this win? (optional)"
              aria-label="Completion note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn-gold flex-1"
                onClick={() => {
                  completeGoal(goal.id, note.trim() || undefined);
                  setFinishing(false);
                }}
              >
                It&apos;s Done
              </button>
              <button className="btn-ghost" onClick={() => setFinishing(false)}>
                Not Yet
              </button>
            </div>
          </div>
        )}
        {goal.lifecycle === "completed" && (
          <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/20 to-transparent px-5 py-6 text-center">
            <p className="font-display text-3xl font-extrabold uppercase text-gold-soft">Done.</p>
            <p className="mt-1 text-sm text-bone-dim">Finished {goal.completedAt && new Date(goal.completedAt).toLocaleDateString()}. Check-ins for this goal have stopped.</p>
            <p className="mt-3 text-xs text-bone-mute">Sharing wins with the Brotherhood comes in a later release.</p>
            <button className="mt-4 text-sm text-bone-mute underline-offset-4 hover:underline" onClick={() => reopenGoal(goal.id)}>
              Reopen
            </button>
          </div>
        )}
        {goal.lifecycle === "archived" ? (
          <button className="btn-gold w-full" onClick={() => restoreGoal(goal.id)}>
            Restore
          </button>
        ) : (
          <button className="w-full py-3 text-sm text-bone-mute hover:text-bone" onClick={() => archiveGoal(goal.id)}>
            Archive this goal
          </button>
        )}
      </section>
          </>
        )}

        {tab === "checkins" && (
          <>
      {editable && (
        <section className={`card p-5 ${checkinDue ? "border-gold/50" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Check-in</p>
              {goal.cadence ? (
                <p className="mt-2 text-bone-dim">
                  {FREQUENCY_LABEL[goal.cadence.frequency]} ·{" "}
                  <span className={compare(goal.cadence.nextDue, today) < 0 ? "text-bad" : checkinDue ? "text-gold" : ""}>
                    {compare(goal.cadence.nextDue, today) < 0 ? "overdue since " : "next "}
                    {friendly(goal.cadence.nextDue, today)}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-bone-mute">No rhythm set.</p>
              )}
            </div>
          </div>
          <Link href={`/goals/${goal.id}/check-in`} className={`${checkinDue ? "btn-gold" : "btn-ghost"} mt-4 w-full`}>
            Post My Check-in
          </Link>
        </section>
      )}
            <CheckinList entries={goal.timeline} />
          </>
        )}

        {tab === "blockers" && <Blockers goal={goal} today={today} editable={editable} lmtlss={lmtlss} />}

        {tab === "brother" && (
          <>
      {(editable || goal.sharing?.partner) && <BrotherCard goal={goal} signedIn={signedIn} today={today} />}
      {signedIn && (goal.sharing?.partner || goal.timeline.some((e) => e.author)) && (
        <Thread
          entries={goal.timeline}
          today={today}
          viewer="owner"
          onPost={goal.sharing?.partner ? (text) => postShared(goal.id, "reply", text) : undefined}
          onApply={(e) => applySuggestion(goal.id, e.id, e.suggested ?? {}, e.author)}
          onDismiss={(e) => dismissSuggestion(e.id)}
        />
      )}
            {!editable && !goal.sharing?.partner && <p className="text-sm text-bone-mute">Brothers can join active goals.</p>}
          </>
        )}

        {tab === "history" && (
          <Timeline entries={goal.timeline} />
        )}
      </div>
    </div>
  );
}

function PlanList({
  goal,
  list,
  label,
  today,
  editable
}: {
  goal: Goal;
  list: "tasks" | "milestones";
  label: string;
  today: string;
  editable: boolean;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const items = [...goal[list]].sort((a, b) => a.order - b.order);
  return (
    <section>
      <p className="eyebrow mb-3">{label}</p>
      <ul className="card divide-y divide-ink-700">
        {items.map((it) => (
          <Item key={it.id} it={it} today={today} editable={editable} editing={editing === it.id} setEditing={setEditing} goalId={goal.id} list={list} />
        ))}
        {editable && (
          <li className="flex gap-2 p-3">
            <input className="field py-2.5" placeholder={`Add a ${list === "tasks" ? "task" : "milestone"}`} aria-label={`New ${list === "tasks" ? "task" : "milestone"}`} value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" aria-label="Due date" className="field w-[8.5rem] shrink-0 px-2 py-2.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
            <button
              className="btn-gold min-w-[48px] shrink-0 px-3"
              aria-label="Add"
              disabled={!title.trim()}
              onClick={() => {
                addItem(goal.id, list, title.trim(), date || undefined);
                setTitle("");
                setDate("");
              }}
            >
              +
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

function Item({
  it,
  today,
  editable,
  editing,
  setEditing,
  goalId,
  list
}: {
  it: PlanItem;
  today: string;
  editable: boolean;
  editing: boolean;
  setEditing: (id: string | null) => void;
  goalId: string;
  list: "tasks" | "milestones";
}) {
  const [title, setTitle] = useState(it.title);
  const [date, setDate] = useState(it.dueDate ?? "");
  if (editing)
    return (
      <li className="space-y-2 p-3">
        <input className="field py-2.5" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <input type="date" aria-label="Due date" className="field w-auto py-2.5" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            className="btn-gold flex-1"
            onClick={() => {
              editItem(goalId, list, it.id, { title: title.trim() || it.title, dueDate: date || undefined });
              setEditing(null);
            }}
          >
            Save
          </button>
          <button className="btn-ghost px-3 text-bad" aria-label="Remove" onClick={() => removeItem(goalId, list, it.id)}>
            ×
          </button>
        </div>
      </li>
    );
  const late = !it.completed && it.dueDate && compare(it.dueDate, today) < 0;
  return (
    <li className="flex min-h-[56px] items-center gap-3 px-3">
      <button
        role="checkbox"
        aria-checked={it.completed}
        aria-label={`Mark ${it.title} ${it.completed ? "not done" : "done"}`}
        disabled={!editable}
        onClick={() => editItem(goalId, list, it.id, { completed: !it.completed })}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${
          it.completed ? "border-gold bg-gold text-ink" : "border-bone-mute/60 hover:border-gold"
        }`}
      >
        {it.completed && "✓"}
      </button>
      <button className="min-w-0 flex-1 py-2 text-left" onClick={() => editable && setEditing(it.id)} disabled={!editable}>
        <span className={`block truncate ${it.completed ? "text-bone-mute line-through" : ""}`}>{it.title}</span>
      </button>
      {it.dueDate && <span className={`shrink-0 text-xs ${late ? "text-bad" : "text-bone-mute"}`}>{friendly(it.dueDate, today)}</span>}
    </li>
  );
}

const KIND: Record<TimelineEntry["kind"], string> = {
  created: "Started",
  activated: "Goal set",
  update: "Update",
  checkin: "Check-in",
  status: "Status",
  revision: "Revised",
  completed: "Completed",
  archived: "Archived",
  restored: "Restored",
  imported: "Imported",
  partner_checkin: "Brother checked in",
  question: "Question",
  suggestion: "Suggestion",
  reply: "Reply",
  partner_joined: "Brother joined",
  partner_left: "Brother left"
};

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const sorted = entries.filter((e) => !e.author && !["reply", "question"].includes(e.kind)).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section>
      <p className="eyebrow mb-4">Timeline</p>
      <ol className="relative space-y-5 border-l border-ink-600 pl-5">
        {sorted.map((e) => (
          <li key={e.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${e.kind === "completed" || e.kind === "checkin" ? "bg-gold" : "bg-ink-600"}`}
            />
            <p className="text-xs uppercase tracking-[0.14em] text-bone-mute">
              {KIND[e.kind]}
              {e.health && ` · ${healthLabel(e.health)}`} · {new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            {e.responses ? (
              <dl className="mt-1 space-y-1 text-sm">
                {e.responses.did && (<><dt className="sr-only">Did</dt><dd><span className="text-bone-mute">Did: </span>{e.responses.did}</dd></>)}
                {e.responses.blocker && (<><dt className="sr-only">In the way</dt><dd><span className="text-bone-mute">In the way: </span>{e.responses.blocker}</dd></>)}
                {e.responses.next && (<><dt className="sr-only">Next</dt><dd><span className="text-bone-mute">Next: </span>{e.responses.next}</dd></>)}
              </dl>
            ) : (
              e.text && <p className="mt-1 text-sm">{e.text}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CheckinList({ entries }: { entries: TimelineEntry[] }) {
  const list = entries.filter((e) => e.kind === "checkin").sort((a, b) => b.at.localeCompare(a.at));
  if (list.length === 0) return <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">Your check-ins show up here.</p>;
  return (
    <ol className="space-y-3">
      {list.map((e) => (
        <li key={e.id} className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bone-mute">
            {new Date(e.at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {e.health && ` · ${healthLabel(e.health)}`}
          </p>
          {e.responses?.did && <p className="mt-1">{e.responses.did}</p>}
          {e.responses?.blocker && <p className="mt-1 text-sm text-bone-dim"><span className="text-bone-mute">In the way: </span>{e.responses.blocker}</p>}
          {e.responses?.next && <p className="mt-1 text-sm text-bone-dim"><span className="text-bone-mute">Next: </span>{e.responses.next}</p>}
        </li>
      ))}
    </ol>
  );
}
