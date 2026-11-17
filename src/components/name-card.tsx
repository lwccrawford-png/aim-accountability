"use client";

import { useState } from "react";
import { updateSettings } from "@/lib/store";

export function NameCard({ current, compact }: { current?: string; compact?: boolean }) {
  const [name, setName] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  return (
    <form
      className={compact ? "space-y-3" : "card space-y-3 p-5"}
      onSubmit={(e) => {
        e.preventDefault();
        if (!clean) return;
        updateSettings({ displayName: clean });
        setSaved(true);
      }}
    >
      <label htmlFor="dname" className="label">
        Your name
      </label>
      <input id="dname" className="field" autoComplete="given-name" placeholder="First name, the way brothers know you" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
      <p className="text-xs text-bone-mute">Shown to your brother and in the Brotherhood. Your email never is.</p>
      <button type="submit" className="btn-ghost w-full" disabled={!clean || clean === current}>
        {saved && clean === current ? "Saved" : "Save Name"}
      </button>
    </form>
  );
}
