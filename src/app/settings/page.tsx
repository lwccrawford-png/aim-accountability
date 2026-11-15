"use client";

import Link from "next/link";
import { useState } from "react";
import { Loading, Shell } from "@/components/ui";
import { exportJson, importPrototype, readPrototype, updateSettings, useApp } from "@/lib/store";

export default function Settings() {
  const app = useApp();
  const [msg, setMsg] = useState("");
  if (!app) return <Loading />;
  const s = app.settings;
  const zones = (() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [s.timeZone];
    }
  })();

  return (
    <Shell lmtlss={s.lmtlssMode}>
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Settings</h1>

      <Link href="/account" className="card mt-6 flex min-h-[64px] items-center justify-between p-5 hover:border-gold/50">
        <span>
          <span className="block font-display text-xl font-bold uppercase tracking-wide">Account</span>
          <span className="block text-sm text-bone-dim">{app.account ? app.account.email : "Sign in to keep goals on every device"}</span>
        </span>
        <span aria-hidden className="text-gold">→</span>
      </Link>

      <Link href="/plans" className="card mt-4 flex min-h-[64px] items-center justify-between p-5 hover:border-gold/50">
        <span>
          <span className="block font-display text-xl font-bold uppercase tracking-wide">Plans</span>
          <span className="block text-sm text-bone-dim">Monthly or yearly</span>
        </span>
        <span aria-hidden className="text-gold">→</span>
      </Link>

      <section className="card mt-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-wide">LMTLSS mode</p>
            <p className="mt-1 text-sm text-bone-dim">
              Adds Steps of Faith, Origins Room tags, My Rooms and Scripture at check-in. Your goals stay the same either way.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={s.lmtlssMode}
            aria-label="LMTLSS mode"
            onClick={() => updateSettings({ lmtlssMode: !s.lmtlssMode })}
            className={`relative h-8 w-14 shrink-0 rounded-full border transition ${s.lmtlssMode ? "border-gold bg-gold" : "border-ink-600 bg-ink-700"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${s.lmtlssMode ? "left-7 bg-ink" : "left-1 bg-bone-mute"}`} />
          </button>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <label htmlFor="tz" className="label">
          Time zone
        </label>
        <select id="tz" className="field" value={s.timeZone} onChange={(e) => updateSettings({ timeZone: e.target.value })}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-bone-mute">Due dates and check-ins follow this zone.</p>
      </section>

      <section className="card mt-4 space-y-3 p-5">
        <p className="font-display text-xl font-bold uppercase tracking-wide">Your data</p>
        <p className="text-sm text-bone-dim">{app.account ? "Saved to your account, with a copy on this device." : "Saved on this device."}</p>
        <button
          className="btn-ghost w-full"
          onClick={() => {
            const blob = new Blob([exportJson()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `accountability-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Export My Goals
        </button>
        <label className="btn-ghost w-full cursor-pointer">
          Import from Earlier Version
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                // Accept an array of v1 goals, or {active, archive} arrays.
                const active = JSON.stringify(Array.isArray(data) ? data : data.active ?? data[ "accountability_goals_v1"] ?? []);
                const archive = JSON.stringify(Array.isArray(data) ? [] : data.archive ?? data["accountability_goals_archive_v1"] ?? []);
                const found = readPrototype({ active, archive });
                const n = importPrototype(found.fresh);
                setMsg(n ? `Brought in ${n} goal${n === 1 ? "" : "s"}.` : found.all.length ? "Those goals are already here." : "No goals found in that file.");
              } catch {
                setMsg("That file couldn't be read.");
              }
              e.target.value = "";
            }}
          />
        </label>
        {msg && <p className="text-sm text-gold" role="status">{msg}</p>}
      </section>

      <p className="mt-8 text-center text-xs uppercase tracking-[0.3em] text-bone-mute">Accountability · built by LMTLSS</p>
    </Shell>
  );
}
