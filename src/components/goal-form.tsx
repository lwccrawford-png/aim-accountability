"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, ROOMS, TAG_LABELS, visible } from "@/lib/catalog";
import { addDays, FREQUENCY_LABEL, friendly } from "@/lib/dates";
import { isReady, saveGoal, type GoalInput } from "@/lib/store";
import { sprintTasks, thirtyDayMilestones, uid } from "@/lib/templates";
import type { Frequency, Goal, GuidedFields, PlanItem, Template } from "@/lib/types";
import { Chip } from "@/components/ui";

interface Props {
  goal?: Goal;
  lmtlss: boolean;
  today: string;
  onDone: (g: Goal) => void;
  /** First-run: show the big welcome headline. */
  welcome?: boolean;
}

const GUIDED: { key: keyof GuidedFields; label: string; placeholder: string; type?: "date" }[] = [
  { key: "outcome", label: "What does done look like?", placeholder: "Set a date and confirm three men" },
  { key: "measure", label: "How will you know you hit it?", placeholder: "Three names, one room, one night on the calendar" },
  { key: "plan", label: "What's the plan, and what's in the way?", placeholder: "Ask after church Sunday. Work runs late on Thursdays." },
  { key: "why", label: "Why does this matter to you?", placeholder: "I've wanted brothers around me for years" },
  { key: "targetDate", label: "When will it be finished?", placeholder: "", type: "date" }
];

const TEMPLATES: { id: Template; name: string; blurb: string }[] = [
  { id: "custom", name: "Custom", blurb: "Start clean. Add steps as you go." },
  { id: "sprint7", name: "7-Day Sprint", blurb: "A task for each of the next seven days." },
  { id: "goal30", name: "30-Day Goal", blurb: "Milestones spread across thirty days." }
];

export function GoalForm({ goal, lmtlss, today, onDone, welcome }: Props) {
  const [id] = useState(() => goal?.id ?? uid());
  const [commitment, setCommitment] = useState(goal?.commitment ?? "");
  const [nextAction, setNextAction] = useState(goal?.nextAction ?? "");
  const [nextActionDate, setNextActionDate] = useState(goal?.nextActionDate ?? "");
  const [guided, setGuided] = useState<GuidedFields>(goal?.guided ?? {});
  const [category, setCategory] = useState(goal?.category);
  const [tags, setTags] = useState<string[]>(goal?.tags ?? []);
  const [roomIds, setRoomIds] = useState<string[]>(goal?.roomIds ?? []);
  const [template, setTemplate] = useState<Template>(goal?.template ?? "custom");
  const [milestoneCount, setMilestoneCount] = useState<4 | 6>(goal?.milestoneCount ?? 4);
  const [planStart, setPlanStart] = useState(today);
  const [tasks, setTasks] = useState<PlanItem[]>(goal?.tasks ?? []);
  const [milestones, setMilestones] = useState<PlanItem[]>(goal?.milestones ?? []);
  const [frequency, setFrequency] = useState<Frequency>(goal?.cadence?.frequency ?? "weekly");
  const [firstDue, setFirstDue] = useState(goal?.cadence?.nextDue ?? addDays(today, 7));
  const [open, setOpen] = useState(!!goal && goal.lifecycle !== "draft");
  const [tried, setTried] = useState(false);

  const editingActive = !!goal && goal.lifecycle !== "draft";
  const cats = useMemo(() => visible(CATEGORIES, lmtlss), [lmtlss]);
  const tagLabels = useMemo(() => visible(TAG_LABELS, lmtlss), [lmtlss]);
  const rooms = useMemo(() => visible(ROOMS, lmtlss), [lmtlss]);
  const roomTagOn = tags.includes("lmtlss_room");

  const missing = {
    commitment: !commitment.trim(),
    nextAction: !nextAction.trim(),
    nextActionDate: !nextActionDate
  };

  function pickTemplate(t: Template, count = milestoneCount, start = planStart) {
    setTemplate(t);
    // Generated items only replace other generated items, never your edits on a saved goal.
    if (t === "sprint7") {
      setTasks(sprintTasks(start));
      setMilestones([]);
    } else if (t === "goal30") {
      setMilestones(thirtyDayMilestones(start, count));
      setTasks([]);
    } else {
      setTasks([]);
      setMilestones([]);
    }
  }

  function toggle<T>(list: T[], v: T) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function submit(activate: boolean) {
    setTried(true);
    if (activate && !isReady({ commitment, nextAction, nextActionDate })) return;
    if (!activate && !commitment.trim() && !nextAction.trim()) return;
    const input: GoalInput = {
      id,
      commitment: commitment.trim(),
      nextAction: nextAction.trim() || undefined,
      nextActionDate: nextActionDate || undefined,
      guided,
      category,
      tags: roomTagOn && roomIds.length === 0 ? tags.filter((t) => t !== "lmtlss_room") : tags,
      roomIds: roomTagOn ? roomIds : [],
      template,
      milestoneCount: template === "goal30" ? milestoneCount : undefined,
      tasks,
      milestones
    };
    const cadenceChanged = !goal?.cadence || goal.cadence.frequency !== frequency || goal.cadence.nextDue !== firstDue;
    const saved = saveGoal(input, activate, cadenceChanged ? { frequency, firstDue } : undefined);
    onDone(saved);
  }

  const err = (k: keyof typeof missing) => tried && missing[k];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="space-y-8"
      noValidate
    >
      {welcome && (
        <div className="animate-rise pt-4">
          <p className="eyebrow">Start here</p>
          <h1 className="mt-3 font-display text-[44px] font-extrabold uppercase leading-[0.92] tracking-tight">
            Say it.
            <br />
            Take the first step.
            <br />
            <span className="text-gold">Bring a brother.</span>
          </h1>
          <p className="mt-4 max-w-sm text-bone-dim">Three questions. Your goal stays private until you decide to share it.</p>
        </div>
      )}

      <section className="space-y-6 animate-rise [animation-delay:80ms]">
        <div>
          <label htmlFor="commitment" className="label">
            What are you committing to?
          </label>
          <textarea
            id="commitment"
            rows={2}
            className={`field resize-none text-lg ${err("commitment") ? "border-bad" : ""}`}
            placeholder="Host my first men's group by January 31"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            aria-invalid={err("commitment") || undefined}
            aria-describedby={err("commitment") ? "commitment-err" : undefined}
          />
          {err("commitment") && (
            <p id="commitment-err" className="mt-2 text-sm text-bad">
              Name the commitment first.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="nextAction" className="label">
            What&apos;s your first step?
          </label>
          <input
            id="nextAction"
            className={`field ${err("nextAction") ? "border-bad" : ""}`}
            placeholder="Ask three men if they'd come"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            aria-invalid={err("nextAction") || undefined}
          />
          {err("nextAction") && <p className="mt-2 text-sm text-bad">One small step you can take this week.</p>}
        </div>
        <div>
          <label htmlFor="nextActionDate" className="label">
            When will you take it?
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { l: "Today", d: today },
              { l: "Tomorrow", d: addDays(today, 1) },
              { l: "This weekend", d: addDays(today, (6 - new Date(today + "T12:00:00Z").getUTCDay() + 7) % 7 || 7) }
            ].map((o) => (
              <Chip key={o.l} on={nextActionDate === o.d} onClick={() => setNextActionDate(o.d)}>
                {o.l}
              </Chip>
            ))}
            <input
              id="nextActionDate"
              type="date"
              className={`field w-auto min-w-[10.5rem] py-2.5 ${err("nextActionDate") ? "border-bad" : ""}`}
              value={nextActionDate}
              min={editingActive ? undefined : today}
              onChange={(e) => setNextActionDate(e.target.value)}
              aria-invalid={err("nextActionDate") || undefined}
            />
          </div>
          {err("nextActionDate") && <p className="mt-2 text-sm text-bad">Pick a day. A step without a day stays a wish.</p>}
        </div>
      </section>

      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-h-[56px] w-full items-center justify-between px-5 text-left"
        >
          <span>
            <span className="font-display text-lg font-bold uppercase tracking-wide">Make it stronger</span>
            <span className="block text-sm text-bone-mute">Outcome, plan, category, check-ins. All optional.</span>
          </span>
          <span aria-hidden className={`text-2xl text-gold transition ${open ? "rotate-45" : ""}`}>
            +
          </span>
        </button>

        {open && (
          <div className="space-y-8 border-t border-ink-700 px-5 pb-6 pt-6">
            <section className="space-y-5">
              <p className="eyebrow">Guided goal</p>
              {GUIDED.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`g-${f.key}`} className="label">
                    {f.label}
                  </label>
                  <input
                    id={`g-${f.key}`}
                    type={f.type ?? "text"}
                    className={`field ${f.type === "date" ? "w-auto min-w-[10.5rem]" : ""}`}
                    placeholder={f.placeholder}
                    value={guided[f.key] ?? ""}
                    onChange={(e) => setGuided({ ...guided, [f.key]: e.target.value || undefined })}
                  />
                </div>
              ))}
              <p className="text-xs text-bone-mute">The finish date is separate from your first step.</p>
            </section>

            <section>
              <p className="eyebrow mb-3">Area of life</p>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <Chip key={c.id} on={category === c.id} gold={c.lmtlssOnly} onClick={() => setCategory(category === c.id ? undefined : c.id)}>
                    {c.name}
                  </Chip>
                ))}
              </div>
              {category && cats.find((c) => c.id === category)?.hint && (
                <p className="mt-3 text-sm text-bone-mute">{cats.find((c) => c.id === category)?.hint}</p>
              )}
            </section>

            {tagLabels.length > 0 && (
              <section>
                <p className="eyebrow mb-3">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tagLabels.map((t) => (
                    <Chip key={t.id} gold on={tags.includes(t.id)} onClick={() => setTags(toggle(tags, t.id))}>
                      {t.name}
                    </Chip>
                  ))}
                </div>
                {roomTagOn && (
                  <div className="mt-5 rounded-xl border border-gold/30 bg-gold/[0.04] p-4">
                    <p className="text-sm text-bone-dim">{TAG_LABELS[0].hint} Pick any that fit.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {rooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={roomIds.includes(r.id)}
                          onClick={() => setRoomIds(toggle(roomIds, r.id))}
                          className={`min-h-[52px] rounded-xl border px-3 text-left transition ${
                            roomIds.includes(r.id) ? "border-gold bg-gold/15 text-gold-soft" : "border-ink-600 text-bone-dim hover:text-bone"
                          }`}
                        >
                          <span className="font-display text-[11px] font-bold tracking-[0.2em] text-bone-mute">
                            {String(r.order).padStart(2, "0")}
                          </span>{" "}
                          <span className="font-display text-base font-bold uppercase tracking-wide">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section>
              <p className="eyebrow mb-3">Plan</p>
              <div className="grid gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={template === t.id}
                    onClick={() => pickTemplate(t.id)}
                    className={`flex min-h-[56px] items-center justify-between rounded-xl border px-4 text-left transition ${
                      template === t.id ? "border-gold bg-gold/10" : "border-ink-600 hover:border-bone-mute"
                    }`}
                  >
                    <span>
                      <span className="font-display text-base font-bold uppercase tracking-wide">{t.name}</span>
                      <span className="block text-sm text-bone-mute">{t.blurb}</span>
                    </span>
                    <span aria-hidden className={template === t.id ? "text-gold" : "text-ink-600"}>
                      ●
                    </span>
                  </button>
                ))}
              </div>

              {template !== "custom" && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor="planStart" className="label">
                        Starts
                      </label>
                      <input
                        id="planStart"
                        type="date"
                        className="field w-auto py-2.5"
                        value={planStart}
                        onChange={(e) => {
                          setPlanStart(e.target.value);
                          if (e.target.value) pickTemplate(template, milestoneCount, e.target.value);
                        }}
                      />
                    </div>
                    {template === "goal30" && (
                      <div className="flex gap-2" role="group" aria-label="Number of milestones">
                        {([4, 6] as const).map((n) => (
                          <Chip
                            key={n}
                            on={milestoneCount === n}
                            onClick={() => {
                              setMilestoneCount(n);
                              pickTemplate("goal30", n);
                            }}
                          >
                            {n} milestones
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                  <ItemEditor
                    items={template === "sprint7" ? tasks : milestones}
                    onChange={template === "sprint7" ? setTasks : setMilestones}
                    today={today}
                  />
                  <p className="text-xs text-bone-mute">Rename any of these now or later.</p>
                </div>
              )}
            </section>

            <section>
              <p className="eyebrow mb-3">Check-ins</p>
              <label htmlFor="freq" className="label">
                How often will you report in?
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <Chip key={f} on={frequency === f} onClick={() => setFrequency(f)}>
                    {FREQUENCY_LABEL[f]}
                  </Chip>
                ))}
              </div>
              <label htmlFor="firstDue" className="label mt-5">
                First check-in
              </label>
              <input
                id="firstDue"
                type="date"
                className="field w-auto py-2.5"
                value={firstDue}
                onChange={(e) => e.target.value && setFirstDue(e.target.value)}
              />
            </section>
          </div>
        )}
      </div>

      <div className={`sticky ${welcome ? "bottom-0 pb-[max(.75rem,env(safe-area-inset-bottom))]" : "bottom-[61px] pb-3"} -mx-5 flex gap-3 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pt-6 z-10`}>
        {goal?.lifecycle && goal.lifecycle !== "draft" ? (
          <button type="button" className="btn-gold flex-1" onClick={() => submit(false)}>
            Save Changes
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => submit(false)}>
              Save Draft
            </button>
            <button type="submit" className="btn-gold flex-1">
              Set a Goal
            </button>
          </>
        )}
      </div>
    </form>
  );
}

export function ItemEditor({
  items,
  onChange,
  today
}: {
  items: PlanItem[];
  onChange: (items: PlanItem[]) => void;
  today: string;
}) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={it.id} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wider text-bone-mute">{friendly(it.dueDate, today)}</span>
          <input
            aria-label={`Item ${i + 1}`}
            className="field py-2.5"
            value={it.title}
            onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
          />
          <button
            type="button"
            aria-label={`Remove ${it.title}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-bone-mute hover:bg-ink-700 hover:text-bad"
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  );
}
