"use client";

import { useState } from "react";
import { CATEGORIES, ROOMS, categoryName, roomName, visible } from "@/lib/catalog";
import { addDays, friendly } from "@/lib/dates";
import { duplicateOf, isBlank, missingWords, rowProblems, rowReady, type SeasonRow } from "@/lib/season";
import type { Goal } from "@/lib/types";
import { Chip } from "@/components/ui";

interface Props {
  rows: SeasonRow[];
  goals: Goal[];
  today: string;
  lmtlss: boolean;
  openId?: string;
  checked: Set<string>;
  onOpen: (id?: string) => void;
  onCheck: (id: string) => void;
  onChange: (row: SeasonRow) => void;
  onRemove: (row: SeasonRow) => void;
}

export function SeasonRows({ rows, goals, today, lmtlss, openId, checked, onOpen, onCheck, onChange, onRemove }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((r) =>
        r.id === openId ? (
          <li key={r.id}>
            <RowEditor
              row={r}
              dup={duplicateOf(r, rows, goals)}
              today={today}
              lmtlss={lmtlss}
              showErrors={checked.has(r.id)}
              onChange={onChange}
              onDone={() => {
                onCheck(r.id);
                onOpen(undefined);
              }}
              onRemove={() => onRemove(r)}
            />
          </li>
        ) : (
          <li key={r.id}>
            <RowSummary row={r} today={today} flagged={checked.has(r.id)} dup={!!duplicateOf(r, rows, goals)} onOpen={() => onOpen(r.id)} />
          </li>
        )
      )}
    </ul>
  );
}

function RowSummary({ row, today, flagged, dup, onOpen }: { row: SeasonRow; today: string; flagged: boolean; dup: boolean; onOpen: () => void }) {
  const ready = rowReady(row, today);
  const blank = isBlank(row);
  const missing = missingWords(row, today);
  return (
    <button type="button" onClick={onOpen} className={`card flex w-full items-start gap-3 px-4 py-4 text-left transition hover:border-ink-600 ${blank ? "border-dashed" : ""}`}>
      <span
        aria-hidden
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ready ? "bg-gold" : flagged && !blank ? "bg-bad" : "border border-bone-mute"}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block font-display text-lg font-bold uppercase leading-tight tracking-wide ${blank ? "text-bone-mute" : ""}`}>
          {row.commitment.trim() || (blank ? "Empty goal" : "No commitment yet")}
        </span>
        {row.nextAction.trim() && (
          <span className="mt-1 block truncate text-sm text-bone-dim">
            {row.nextAction}
            {row.nextActionDate && <span className="text-bone-mute"> · {friendly(row.nextActionDate, today)}</span>}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
          {ready ? <span className="text-gold">Ready</span> : !blank && <span className={flagged ? "text-bad" : "text-bone-mute"}>Needs {missing.join(", ")}</span>}
          {row.category && <span className="text-bone-mute">{categoryName(row.category)}</span>}
          {row.roomIds.length > 0 && <span className="text-gold/80">{row.roomIds.map(roomName).join(" · ")}</span>}
          {dup && <span className="text-bone-mute">Possible repeat</span>}
          {row.error && <span className="text-bad">Didn&apos;t go live</span>}
        </span>
      </span>
      <span aria-hidden className="mt-1 text-bone-mute">
        Edit
      </span>
    </button>
  );
}

function RowEditor({
  row,
  dup,
  today,
  lmtlss,
  showErrors,
  onChange,
  onDone,
  onRemove
}: {
  row: SeasonRow;
  dup?: string;
  today: string;
  lmtlss: boolean;
  showErrors: boolean;
  onChange: (row: SeasonRow) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  const [roomsOpen, setRoomsOpen] = useState(row.roomIds.length > 0);
  const problems = showErrors && !isBlank(row) ? rowProblems(row, today) : {};
  const cats = visible(CATEGORIES, lmtlss);
  const rooms = visible(ROOMS, lmtlss);
  const set = (patch: Partial<SeasonRow>) => onChange({ ...row, ...patch, error: undefined });
  const fid = (f: string) => `row-${row.id}-${f}`;
  const quick = [
    { label: "Today", d: today },
    { label: "Tomorrow", d: addDays(today, 1) },
    { label: "In a week", d: addDays(today, 7) }
  ];

  return (
    <div className="card animate-rise space-y-6 border-gold/40 px-4 pb-5 pt-5">
      {row.error && (
        <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bone">
          {row.error}
        </p>
      )}
      <div>
        <label htmlFor={fid("c")} className="label">
          What are you committing to?
        </label>
        <textarea
          id={fid("c")}
          rows={2}
          autoFocus={isBlank(row)}
          className={`field resize-none text-lg ${problems.commitment ? "border-bad" : ""}`}
          placeholder="Lead family devotions twice a week"
          value={row.commitment}
          onChange={(e) => set({ commitment: e.target.value })}
          aria-invalid={!!problems.commitment || undefined}
          aria-describedby={problems.commitment ? `${fid("c")}-err` : undefined}
        />
        {problems.commitment && (
          <p id={`${fid("c")}-err`} className="mt-2 text-sm text-bad">
            {problems.commitment}
          </p>
        )}
        {dup && <p className="mt-2 text-sm text-bone-mute">{dup}</p>}
      </div>

      <div>
        <label htmlFor={fid("a")} className="label">
          First step
        </label>
        <input
          id={fid("a")}
          className={`field ${problems.nextAction ? "border-bad" : ""}`}
          placeholder="One small thing you can do this week"
          value={row.nextAction}
          onChange={(e) => set({ nextAction: e.target.value })}
          aria-invalid={!!problems.nextAction || undefined}
          aria-describedby={problems.nextAction ? `${fid("a")}-err` : undefined}
        />
        {problems.nextAction && (
          <p id={`${fid("a")}-err`} className="mt-2 text-sm text-bad">
            {problems.nextAction}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fid("d")} className="label">
          When?
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {quick.map((q) => (
            <Chip key={q.label} on={row.nextActionDate === q.d} onClick={() => set({ nextActionDate: q.d })}>
              {q.label}
            </Chip>
          ))}
          <input
            id={fid("d")}
            type="date"
            min={today}
            className={`field w-auto min-w-[10.5rem] ${problems.nextActionDate ? "border-bad" : ""}`}
            value={row.nextActionDate}
            onChange={(e) => set({ nextActionDate: e.target.value })}
            aria-invalid={!!problems.nextActionDate || undefined}
            aria-describedby={problems.nextActionDate ? `${fid("d")}-err` : undefined}
          />
        </div>
        {problems.nextActionDate && (
          <p id={`${fid("d")}-err`} className="mt-2 text-sm text-bad">
            {problems.nextActionDate}
          </p>
        )}
      </div>

      <div>
        <p className="label">Area of life</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {cats.map((c) => (
            <span key={c.id} className="shrink-0">
              <Chip on={row.category === c.id} gold={c.lmtlssOnly} onClick={() => set({ category: row.category === c.id ? undefined : c.id })}>
                {c.name}
              </Chip>
            </span>
          ))}
        </div>
      </div>

      {lmtlss && (
        <div className="rounded-xl border border-gold/30 bg-gold/[0.04]">
          <button
            type="button"
            aria-expanded={roomsOpen}
            onClick={() => setRoomsOpen(!roomsOpen)}
            className="flex min-h-[52px] w-full items-center justify-between px-4 text-left"
          >
            <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-gold">
              Rooms {row.roomIds.length > 0 && <span className="text-bone-dim">· {row.roomIds.length}</span>}
            </span>
            <span aria-hidden className={`text-xl text-gold transition ${roomsOpen ? "rotate-45" : ""}`}>
              +
            </span>
          </button>
          {roomsOpen && (
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {rooms.map((r) => {
                const on = row.roomIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ roomIds: on ? row.roomIds.filter((x) => x !== r.id) : [...row.roomIds, r.id] })}
                    className={`min-h-[48px] rounded-xl border px-3 text-left font-display text-sm font-bold uppercase tracking-wide transition ${
                      on ? "border-gold bg-gold/15 text-gold-soft" : "border-ink-600 text-bone-dim hover:text-bone"
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-ink-700 pt-4">
        <button type="button" onClick={onRemove} className="min-h-[44px] px-1 text-sm text-bone-mute hover:text-bad">
          Remove
        </button>
        <button type="button" onClick={onDone} className="btn-ghost min-h-[44px] px-5 text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
