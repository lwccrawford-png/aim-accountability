"use client";

import Link from "next/link";
import { DEFAULT_REMINDERS, updateReminders } from "@/lib/store";
import type { AppState } from "@/lib/types";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition ${on ? "border-gold bg-gold" : "border-ink-600 bg-ink-700"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${on ? "left-7 bg-ink" : "left-1 bg-bone-mute"}`} />
    </button>
  );
}

/** Email reminders for a man's own goals and for the goals he walks with a brother on. */
export function RemindersCard({ app }: { app: AppState }) {
  const r = app.settings.reminders ?? DEFAULT_REMINDERS;

  if (!app.account) {
    return (
      <section className="card mt-4 p-5">
        <p className="font-display text-xl font-bold uppercase tracking-wide">Reminders</p>
        <p className="mt-1 text-sm text-bone-dim">
          Get an email when a check-in or a next step is due. Reminders need an account, so we know where to send them.
        </p>
        <Link href="/account" className="btn-ghost mt-4 w-full">
          Sign in to turn them on
        </Link>
      </section>
    );
  }

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl font-bold uppercase tracking-wide">Reminders</p>
          <p className="mt-1 text-sm text-bone-dim">
            An email to {app.account.email ?? "your address"} when a check-in or a next step is due. One a day at most, and none on days when nothing is due.
          </p>
        </div>
        <Switch on={r.email} label="Email reminders" onChange={(v) => updateReminders({ email: v })} />
      </div>

      {r.email && (
        <div className="mt-5 space-y-5 border-t border-ink-700 pt-5">
          <div>
            <label htmlFor="remind-hour" className="label">
              Send it at
            </label>
            <select id="remind-hour" className="field w-auto min-w-[9rem]" value={r.hour} onChange={(e) => updateReminders({ hour: Number(e.target.value) })}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-bone-mute">In your time zone, {app.settings.timeZone.replace(/_/g, " ")}.</p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Goals I walk with a brother on</p>
              <p className="mt-1 text-sm text-bone-dim">
                Remind me when my check-in with him is due, and tell me if he goes quiet for two days.
              </p>
            </div>
            <Switch on={r.partner} label="Reminders for goals I walk with a brother on" onChange={(v) => updateReminders({ partner: v })} />
          </div>
          <p className="text-xs text-bone-mute">A late item is repeated 1, 3 and 7 days after its date, then the reminders stop.</p>
        </div>
      )}
    </section>
  );
}
