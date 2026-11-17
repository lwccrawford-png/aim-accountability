"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { friendly } from "@/lib/dates";
import { completeNextAction, editItem } from "@/lib/store";
import { FOCUS_KEY, checkinStreak, dayItems, dayName, focusItem, parseFocus, weekDays, weekMarks, type DayItem, type DayMark, type Focus } from "@/lib/today";
import type { AppState } from "@/lib/types";

type View = "today" | "week";

const KIND_LABEL: Record<DayItem["kind"], string> = {
  action: "Next step",
  checkin: "Check-in",
  partner: "Brother",
  task: "Task",
  milestone: "Milestone"
};

function readFocus(): Focus | null {
  try {
    return parseFocus(window.localStorage.getItem(FOCUS_KEY));
  } catch {
    return null;
  }
}

/** Home: what's on today, the week at a glance, one focus, and how the day is going. */
export function TodayDashboard({ app, today }: { app: AppState; today: string }) {
  const tz = app.settings.timeZone;
  const partnerships = useMemo(() => app.partnerships ?? [], [app.partnerships]);
  const [view, setView] = useState<View>("today");
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(today);
  const [focus, setFocusState] = useState<Focus | null>(readFocus);

  const todays = useMemo(() => dayItems(app.goals, partnerships, today, today, tz), [app.goals, partnerships, today, tz]);
  const days = useMemo(() => weekDays(today, offset), [today, offset]);
  const marks = useMemo(() => weekMarks(app.goals, partnerships, days, today, tz), [app.goals, partnerships, days, today, tz]);
  const thisWeek = useMemo(
    () => (offset === 0 ? marks : weekMarks(app.goals, partnerships, weekDays(today), today, tz)),
    [offset, marks, app.goals, partnerships, today, tz]
  );
  const streak = useMemo(() => checkinStreak(app.goals, today, tz), [app.goals, today, tz]);

  // The picked day follows the week being shown.
  const day = days.includes(picked) ? picked : days.includes(today) ? today : days[0];
  const shown = useMemo(
    () => (day === today ? todays : dayItems(app.goals, partnerships, day, today, tz)),
    [day, today, todays, app.goals, partnerships, tz]
  );

  const focused = focusItem(focus, todays, today);
  const done = todays.filter((i) => i.done).length;
  const total = todays.length;

  function setFocus(key: string | null) {
    const next = key ? { date: today, key } : null;
    setFocusState(next);
    try {
      if (next) window.localStorage.setItem(FOCUS_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(FOCUS_KEY);
    } catch {
      /* storage blocked: the pick lasts until he leaves the page */
    }
  }

  return (
    <section aria-label="Today">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{dayName(today, "long")} · {friendly(today)}</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none">{view === "today" ? "Today" : "Week"}</h1>
        </div>
        <div role="tablist" aria-label="View" className="flex shrink-0 rounded-full border border-ink-600 bg-ink-800 p-1">
          {(["today", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                if (v === "today") {
                  setOffset(0);
                  setPicked(today);
                }
              }}
              className={`min-h-[40px] rounded-full px-4 text-sm font-semibold capitalize transition ${view === v ? "bg-bone text-ink" : "text-bone-mute hover:text-bone"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "today" ? (
        <>
          <Progress done={done} total={total} streak={streak} week={thisWeek} today={today} />

          {focused ? (
            <div className="card mt-6 animate-rise border-gold/60 p-5 shadow-[0_0_40px_-18px_rgba(201,166,90,0.7)]">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow text-gold">Today&apos;s focus</p>
                <button type="button" className="-my-2 min-h-[44px] px-2 text-sm text-bone-mute hover:text-bone" onClick={() => setFocus(null)}>
                  Clear
                </button>
              </div>
              <p className="mt-2 font-display text-3xl font-bold uppercase leading-tight tracking-wide">{focused.title}</p>
              <p className="mt-2 text-sm text-bone-dim">
                {focused.context}
                {focused.late && <span className="text-bad"> · due {friendly(focused.date, today)}</span>}
              </p>
              <div className="mt-5 flex gap-2">
                {canTick(focused) ? (
                  <>
                    <button type="button" className="btn-gold flex-1" onClick={() => tick(focused)}>
                      Mark It Done
                    </button>
                    <Link href={focused.href} className="btn-ghost">
                      Open
                    </Link>
                  </>
                ) : (
                  <Link href={focused.href} className="btn-gold flex-1">
                    {focused.kind === "partner" ? "Check In With Him" : "Check In"}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            todays.some((i) => !i.done) && (
              <p className="mt-6 rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">
                Pick the one thing that matters most today. Tap <span className="font-semibold text-bone-dim">Focus</span> on it.
              </p>
            )
          )}

          <ItemList
            items={todays.filter((i) => i.key !== focused?.key)}
            today={today}
            onFocus={(k) => setFocus(k)}
            empty={
              focused ? null : (
                <Quiet
                  title="Nothing due today"
                  body="Use the day to get ahead, or look at what's coming."
                  action={
                    <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setView("week")}>
                      See the Week
                    </button>
                  }
                />
              )
            }
          />
        </>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" aria-label="Previous week" className="grid h-11 w-11 place-items-center rounded-full border border-ink-600 text-bone-dim hover:border-gold/50 hover:text-gold" onClick={() => setOffset(offset - 1)}>
              <span aria-hidden>←</span>
            </button>
            <p className="text-sm font-semibold text-bone-dim" aria-live="polite">
              {offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : `${friendly(days[0], today)} to ${friendly(days[6], today)}`}
              {offset !== 0 && (
                <button type="button" className="ml-3 text-gold underline-offset-4 hover:underline" onClick={() => { setOffset(0); setPicked(today); }}>
                  Back to today
                </button>
              )}
            </p>
            <button type="button" aria-label="Next week" className="grid h-11 w-11 place-items-center rounded-full border border-ink-600 text-bone-dim hover:border-gold/50 hover:text-gold" onClick={() => setOffset(offset + 1)}>
              <span aria-hidden>→</span>
            </button>
          </div>

          <ul className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Days of the week">
            {marks.map((m) => (
              <li key={m.date}>
                <DayButton mark={m} today={today} on={m.date === day} onPick={() => setPicked(m.date)} />
              </li>
            ))}
          </ul>

          <p className="eyebrow mt-7">
            {day === today ? "Today" : dayName(day, "long")} · {friendly(day)}
          </p>
          <ItemList
            items={shown}
            today={today}
            day={day}
            empty={
              <Quiet
                title={day < today ? "Nothing logged that day" : "Nothing scheduled"}
                body={day < today ? "Finished steps and check-ins show up on the day you did them." : "Give a goal a next step with a date and it lands here."}
              />
            }
          />
        </>
      )}
    </section>
  );
}

const canTick = (i: DayItem) => i.kind === "action" || i.kind === "task" || i.kind === "milestone";

function tick(i: DayItem) {
  if (i.kind === "action" && !i.done) completeNextAction(i.goalId);
  else if ((i.kind === "task" || i.kind === "milestone") && i.itemId) editItem(i.goalId, i.kind === "task" ? "tasks" : "milestones", i.itemId, { completed: !i.done });
}

function Progress({ done, total, streak, week, today }: { done: number; total: number; streak: number; week: DayMark[]; today: string }) {
  const pct = total ? done / total : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  const label = total === 0 ? "Nothing due today" : done === total ? "All done today" : `${done} of ${total} done today`;
  return (
    <div className="card mt-6 flex items-center gap-5 p-5">
      <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] shrink-0" role="img" aria-label={label}>
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-ink-700" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 38 38)"
          className={`transition-[stroke-dashoffset] duration-700 ${total > 0 && done === total ? "stroke-ok" : "stroke-gold"}`}
        />
        <text x="38" y="44" textAnchor="middle" className="fill-bone font-display text-[20px] font-bold">
          {total === 0 ? "–" : `${done}/${total}`}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-bold uppercase leading-tight tracking-wide">{label}</p>
        <div className="mt-3 flex items-center gap-1.5" role="img" aria-label={`Check-ins this week: ${week.filter((d) => d.checkedIn).length} of 7 days`}>
          {week.map((d) => (
            <span key={d.date} className="flex flex-col items-center gap-1">
              <span
                className={`block h-2.5 w-6 rounded-full ${d.checkedIn ? "bg-gold" : d.date === today ? "border border-gold/60" : "bg-ink-700"}`}
              />
              <span className={`text-[10px] font-semibold uppercase ${d.date === today ? "text-gold" : "text-bone-mute"}`}>{dayName(d.date).slice(0, 1)}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-bone-mute">
          {streak > 1 ? `Checked in ${streak} days in a row` : streak === 1 ? "Checked in 1 day running" : "Days you checked in this week"}
        </p>
      </div>
    </div>
  );
}

function DayButton({ mark, today, on, onPick }: { mark: DayMark; today: string; on: boolean; onPick: () => void }) {
  const isToday = mark.date === today;
  const summary = [mark.open && `${mark.open} to do`, mark.done && `${mark.done} done`].filter(Boolean).join(", ") || "nothing";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${dayName(mark.date, "long")} ${friendly(mark.date)}: ${summary}`}
      onClick={onPick}
      className={`flex min-h-[76px] w-full flex-col items-center justify-center gap-1 rounded-2xl border transition ${
        on ? "border-gold bg-gold text-ink" : isToday ? "border-gold/60 text-bone" : "border-ink-700 text-bone-dim hover:border-ink-600"
      }`}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${on ? "text-ink/70" : "text-bone-mute"}`}>{dayName(mark.date).slice(0, 2)}</span>
      <span className="font-display text-xl font-bold leading-none">{Number(mark.date.slice(8))}</span>
      <span className="flex h-2 items-center gap-0.5" aria-hidden>
        {mark.late > 0 && <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-ink" : "bg-bad"}`} />}
        {mark.open - mark.late > 0 && <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-ink" : "bg-gold"}`} />}
        {mark.done > 0 && <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-ink/40" : "bg-ok"}`} />}
      </span>
    </button>
  );
}

function ItemList({ items, today, day = today, onFocus, empty }: { items: DayItem[]; today: string; day?: string; onFocus?: (key: string) => void; empty: React.ReactNode }) {
  if (!items.length) return <div className="mt-4">{empty}</div>;
  return (
    <ul className="mt-4 space-y-2">
      {items.map((i) => (
        <li key={i.key} className={`card flex items-center gap-1 pr-2 transition ${i.late ? "border-bad/50" : ""} ${i.done ? "opacity-70" : ""}`}>
          {canTick(i) && (i.kind !== "action" || !i.done) && day === today ? (
            <button
              type="button"
              aria-label={i.done ? `Mark not done: ${i.title}` : `Mark done: ${i.title}`}
              onClick={() => tick(i)}
              className="grid h-14 w-14 shrink-0 place-items-center"
            >
              <Check on={i.done} />
            </button>
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center" aria-hidden>
              {i.done ? <Check on /> : <span className={`h-2.5 w-2.5 rounded-full ${i.late ? "bg-bad" : "bg-gold"}`} />}
            </span>
          )}
          <Link href={i.href} className="min-w-0 flex-1 py-3 hover:text-gold-soft">
            <span className={`block truncate font-medium ${i.done ? "text-bone-dim line-through decoration-bone-mute/60" : ""}`}>{i.title}</span>
            <span className="block truncate text-sm text-bone-mute">
              <span className={i.late ? "text-bad" : "text-bone-dim"}>{i.done ? "Done" : i.late ? `Late · due ${friendly(i.date, today)}` : KIND_LABEL[i.kind]}</span> · {i.context}
            </span>
          </Link>
          {onFocus && !i.done && (
            <button type="button" className="min-h-[44px] shrink-0 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold hover:bg-gold/10" onClick={() => onFocus(i.key)}>
              Focus
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span className={`grid h-7 w-7 place-items-center rounded-full border-2 transition ${on ? "border-ok bg-ok text-ink" : "border-ink-600 text-transparent hover:border-gold"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function Quiet({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 px-5 py-5">
      <p className="font-display text-xl font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-sm text-bone-mute">{body}</p>
      {action}
    </div>
  );
}
