"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SeasonRows } from "@/components/season-rows";
import { ReviewCard } from "@/components/season-review";
import { Chip, Loading, Shell } from "@/components/ui";
import { addDays, addMonthsAnchored, FREQUENCY_LABEL, friendly, todayIn } from "@/lib/dates";
import {
  isBlank,
  missingWords,
  newRow,
  parseWorkspace,
  reconcile,
  rowReady,
  rowToInput,
  SEASON_KEY,
  type Decision,
  type SeasonRow,
  type Workspace
} from "@/lib/season";
import { deleteDraft, saveGoal, useApp } from "@/lib/store";
import { uid } from "@/lib/templates";
import type { AppState, Frequency, Goal } from "@/lib/types";

type Tab = "back" | "new" | "launch";
const TABS: Tab[] = ["back", "new", "launch"];

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Season />
    </Suspense>
  );
}

function Season() {
  const app = useApp();
  const search = useSearchParams();
  if (!app) return <Loading />;
  const asked = search.get("tab") as Tab | null;
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <Planner app={app} initialTab={asked && TABS.includes(asked) ? asked : undefined} />
    </Shell>
  );
}

function loadWorkspace(): Workspace {
  try {
    return parseWorkspace(window.localStorage.getItem(SEASON_KEY));
  } catch {
    return parseWorkspace(null);
  }
}

function firstCheckIn(today: string, f: Frequency) {
  if (f === "daily") return addDays(today, 1);
  if (f === "biweekly") return addDays(today, 14);
  if (f === "monthly") return addMonthsAnchored(today, 1);
  return addDays(today, 7);
}

function Planner({ app, initialTab }: { app: AppState; initialTab?: Tab }) {
  const today = todayIn(app.settings.timeZone);
  const lmtlss = app.settings.lmtlssMode;
  const goals = app.goals;

  const [ws, setWs] = useState<Workspace>(() => {
    const w = loadWorkspace();
    const rows = reconcile(w.rows, goals);
    return { ...w, rows: rows.length ? rows : [newRow(uid())] };
  });
  // Goals that were live when the page opened, or were touched here, stay on the Look back tab
  // after they're completed or archived, so Undo is one tap away.
  const [reviewIds, setReviewIds] = useState<string[]>(() => goals.filter((g) => g.lifecycle === "active").map((g) => g.id));
  const [tab, setTab] = useState<Tab>(initialTab ?? (reviewIds.length ? "back" : "new"));
  const [openId, setOpenId] = useState<string | undefined>(() => (ws.rows.length === 1 && isBlank(ws.rows[0]) ? ws.rows[0].id : undefined));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string>();
  const [launched, setLaunched] = useState<string[]>([]);

  // Drafts saved on another device show up; rows already live drop out.
  const rows = useMemo(() => reconcile(ws.rows, goals), [ws.rows, goals]);
  const review = useMemo(() => {
    const live = goals.filter((g) => g.lifecycle === "active").map((g) => g.id);
    const ids = [...reviewIds, ...live.filter((id) => !reviewIds.includes(id))];
    return ids.map((id) => goals.find((g) => g.id === id)).filter((g): g is Goal => !!g && !launched.includes(g.id));
  }, [goals, reviewIds, launched]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SEASON_KEY, JSON.stringify(ws));
    } catch {
      // Private mode or full storage: the workspace just won't survive a reload.
    }
  }, [ws]);

  const setRows = (next: SeasonRow[]) => setWs((w) => ({ ...w, rows: next }));
  const patchRow = (row: SeasonRow) => setRows(rows.map((r) => (r.id === row.id ? row : r)));
  const decide = (id: string, d?: Decision) =>
    setWs((w) => {
      const decisions = { ...w.decisions };
      if (d) decisions[id] = d;
      else delete decisions[id];
      return { ...w, decisions };
    });

  const pickTab = (t: Tab) => {
    if (openId) setChecked(new Set(checked).add(openId));
    setOpenId(undefined);
    setNotice(undefined);
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  function addRow() {
    const r = newRow(uid());
    if (openId) setChecked(new Set(checked).add(openId));
    setRows([...rows, r]);
    setOpenId(r.id);
  }

  function removeRow(r: SeasonRow) {
    const saved = goals.some((g) => g.id === r.id && g.lifecycle === "draft");
    if (saved && !window.confirm("Remove this goal? Its saved draft will be deleted too.")) return;
    if (saved) deleteDraft(r.id);
    const rest = rows.filter((x) => x.id !== r.id);
    const blank = newRow(uid());
    setRows(rest.length ? rest : [blank]);
    setOpenId(rest.length ? undefined : blank.id);
  }

  function saveDrafts() {
    const t = new Date().toISOString();
    let n = 0;
    const next = rows.map((r) => {
      if (isBlank(r)) return r;
      saveGoal(rowToInput(r, goals.find((g) => g.id === r.id), ws.endsOn), false);
      n++;
      return { ...r, savedAt: t };
    });
    setRows(next);
    setNotice(
      n === 0
        ? "Nothing to save yet. Write a commitment or a first step."
        : `${n === 1 ? "1 draft" : `${n} drafts`} saved to My Goals.${app.account ? " They'll be on your other devices too." : ""}`
    );
  }

  const writtenRows = rows.filter((r) => !isBlank(r));
  const readyRows = writtenRows.filter((r) => rowReady(r, today));
  const chosen = readyRows.filter((r) => r.selected);
  const decided = review.filter((g) => g.lifecycle !== "active" || ws.decisions[g.id]).length;

  function activate() {
    setChecked(new Set([...checked, ...writtenRows.map((r) => r.id)]));
    const ok: string[] = [];
    const failed = new Map<string, string>();
    for (const r of chosen) {
      try {
        const base = goals.find((g) => g.id === r.id);
        const cadence = base?.cadence ? undefined : { frequency: ws.frequency, firstDue: firstCheckIn(today, ws.frequency) };
        // The row id is the goal id, so a retry updates the same goal instead of making a second one.
        const g = saveGoal(rowToInput(r, base, ws.endsOn), true, cadence);
        if (g.lifecycle === "active") ok.push(r.id);
        else failed.set(r.id, "This one didn't go live. Check the fields and try again.");
      } catch (e) {
        failed.set(r.id, `This one didn't go live: ${e instanceof Error ? e.message : "something went wrong"}. Your words are still here.`);
      }
    }
    const left = rows.filter((r) => !ok.includes(r.id)).map((r) => (failed.has(r.id) ? { ...r, error: failed.get(r.id) } : r));
    setRows(left.length ? left : [newRow(uid())]);
    setLaunched([...launched, ...ok]);
    if (failed.size) setNotice(`${failed.size === 1 ? "One goal" : `${failed.size} goals`} didn't go live. They're still on the list below.`);
  }

  const tabs: { id: Tab; label: string; count: string }[] = [
    { id: "back", label: "Look back", count: review.length ? `${decided}/${review.length}` : "" },
    { id: "new", label: "New goals", count: writtenRows.length ? String(writtenRows.length) : "" },
    { id: "launch", label: "Launch", count: chosen.length ? String(chosen.length) : "" }
  ];

  return (
    <div>
      <p className="eyebrow">New season</p>
      <h1 className="mt-2 font-display text-[40px] font-extrabold uppercase leading-[0.92] tracking-tight">Plan a New Season</h1>
      <p className="mt-3 max-w-sm text-bone-dim">Decide what stays, write what&apos;s next, then make it live. Nothing is shared unless you share it.</p>

      <div role="tablist" aria-label="Season steps" className="sticky top-0 z-10 -mx-5 mt-6 flex gap-1 bg-ink/90 px-5 py-2 backdrop-blur-md">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => pickTab(t.id)}
            className={`min-h-[44px] flex-1 rounded-full px-2 text-[13px] font-semibold transition ${tab === t.id ? "bg-bone text-ink" : "text-bone-mute hover:text-bone"}`}
          >
            {t.label}
            {t.count && <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/[0.06] px-4 py-3 text-sm text-bone">
          {notice}
        </p>
      )}

      <div role="tabpanel" className="mt-5 animate-rise" key={tab}>
        {tab === "back" && (
          <section className="space-y-3">
            {review.length === 0 ? (
              <div className="card px-5 py-8 text-center">
                <p className="font-display text-xl font-bold uppercase tracking-wide">Nothing going right now</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-bone-dim">A clean slate. Write the goals for this season next.</p>
                <button type="button" className="btn-gold mt-5" onClick={() => pickTab("new")}>
                  Write new goals
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-bone-dim">Before you add anything, settle what you already have going.</p>
                {review.map((g) => (
                  <ReviewCard
                    key={g.id}
                    goal={g}
                    today={today}
                    decision={ws.decisions[g.id]}
                    onDecide={(d) => {
                      if (!reviewIds.includes(g.id)) setReviewIds([...reviewIds, g.id]);
                      decide(g.id, d);
                    }}
                  />
                ))}
                <button type="button" className="btn-gold mt-3 w-full" onClick={() => pickTab("new")}>
                  Next: new goals
                </button>
              </>
            )}
          </section>
        )}

        {tab === "new" && (
          <section className="space-y-4">
            <SeasonRows
              rows={rows}
              goals={goals}
              today={today}
              lmtlss={lmtlss}
              openId={openId}
              checked={checked}
              onOpen={(id) => {
                if (openId && openId !== id) setChecked(new Set(checked).add(openId));
                setOpenId(id);
              }}
              onCheck={(id) => setChecked(new Set(checked).add(id))}
              onChange={patchRow}
              onRemove={removeRow}
            />
            <button type="button" onClick={addRow} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-600 font-display text-base font-bold uppercase tracking-[0.08em] text-bone-dim transition hover:border-gold/60 hover:text-gold-soft">
              <span aria-hidden className="text-xl leading-none text-gold">+</span> Add a goal
            </button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={saveDrafts}>
                Save drafts
              </button>
              <button type="button" className="btn-gold" onClick={() => pickTab("launch")}>
                Next: launch
              </button>
            </div>
            <p className="text-xs text-bone-mute">This list stays on this device while you work. Save drafts to keep them in My Goals.</p>
          </section>
        )}

        {tab === "launch" && (
          <Launch
            rows={writtenRows}
            today={today}
            ws={ws}
            launched={launched.map((id) => goals.find((g) => g.id === id)).filter((g): g is Goal => !!g)}
            chosen={chosen.length}
            syncError={app.sync?.state === "error" || app.sync?.state === "offline"}
            onWs={(patch) => setWs((w) => ({ ...w, ...patch }))}
            onToggle={(r) => patchRow({ ...r, selected: !r.selected })}
            onFix={(r) => {
              setChecked(new Set(checked).add(r.id));
              pickTab("new");
              setOpenId(r.id);
            }}
            onActivate={activate}
            onMore={() => {
              setLaunched([]);
              pickTab("new");
            }}
          />
        )}
      </div>
    </div>
  );
}

function Launch({
  rows,
  today,
  ws,
  launched,
  chosen,
  syncError,
  onWs,
  onToggle,
  onFix,
  onActivate,
  onMore
}: {
  rows: SeasonRow[];
  today: string;
  ws: Workspace;
  launched: Goal[];
  chosen: number;
  syncError: boolean;
  onWs: (patch: Partial<Workspace>) => void;
  onToggle: (r: SeasonRow) => void;
  onFix: (r: SeasonRow) => void;
  onActivate: () => void;
  onMore: () => void;
}) {
  if (launched.length && rows.every((r) => !r.error)) {
    return (
      <section className="space-y-4">
        <div className="card border-gold/40 px-5 py-6">
          <p className="eyebrow">Live</p>
          <p className="mt-2 font-display text-3xl font-extrabold uppercase leading-none">
            {launched.length === 1 ? "One goal is live" : `${launched.length} goals are live`}
          </p>
          <p className="mt-3 text-sm text-bone-dim">
            Nothing was shared. Open a goal to invite a brother or post a win when you&apos;re ready.
            {syncError && " They're saved on this device and will sync when you're back online."}
          </p>
        </div>
        <ul className="space-y-2">
          {launched.map((g) => (
            <li key={g.id}>
              <Link href={`/goals/${g.id}`} className="card flex min-h-[56px] items-center justify-between gap-3 px-4">
                <span className="truncate font-display text-base font-bold uppercase tracking-wide">{g.commitment}</span>
                <span className="shrink-0 text-sm text-gold">Open</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/goals" className="btn-ghost">
            My Goals
          </Link>
          <button type="button" className="btn-ghost" onClick={onMore}>
            Add more
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="card space-y-5 px-4 py-5">
        <div>
          <p className="label">Check in on new goals</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
              <Chip key={f} on={ws.frequency === f} onClick={() => onWs({ frequency: f })}>
                {FREQUENCY_LABEL[f]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="season-ends" className="label">
            Season ends (optional)
          </label>
          <input
            id="season-ends"
            type="date"
            min={today}
            className="field w-auto min-w-[10.5rem]"
            value={ws.endsOn ?? ""}
            onChange={(e) => onWs({ endsOn: e.target.value || undefined })}
          />
          <p className="mt-2 text-xs text-bone-mute">Used as the finish date for any goal that doesn&apos;t have one.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="font-display text-xl font-bold uppercase tracking-wide">No new goals yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-bone-dim">Write at least one on the New goals tab.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const ready = rowReady(r, today);
            return (
              <li key={r.id} className={`card px-4 py-3 ${r.error ? "border-bad/50" : ""}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Make "${r.commitment || "this goal"}" live`}
                    className="mt-1 h-6 w-6 shrink-0 accent-[#c9a65a] disabled:opacity-30"
                    checked={ready && r.selected}
                    disabled={!ready}
                    onChange={() => onToggle(r)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold uppercase leading-tight tracking-wide">{r.commitment.trim() || "No commitment yet"}</p>
                    {ready ? (
                      <p className="mt-1 truncate text-sm text-bone-dim">
                        {r.nextAction} · {friendly(r.nextActionDate || undefined, today)}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-bad">Needs {missingWords(r, today).join(", ")}</p>
                    )}
                    {r.error && <p className="mt-1 text-sm text-bad">{r.error}</p>}
                  </div>
                  {(!ready || r.error) && (
                    <button type="button" className="min-h-[44px] shrink-0 px-2 text-sm text-gold" onClick={() => onFix(r)}>
                      Fix
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
        <button type="button" className="btn-gold w-full" disabled={chosen === 0} onClick={onActivate}>
          {chosen === 0 ? "Pick a goal to make live" : chosen === 1 ? "Make 1 goal live" : `Make ${chosen} goals live`}
        </button>
        <p className="text-center text-xs text-bone-mute">No invites or posts go out. You decide that from each goal.</p>
      </div>
    </section>
  );
}
