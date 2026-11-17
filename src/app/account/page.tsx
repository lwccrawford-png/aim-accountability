"use client";

import { useState } from "react";
import { SignInForm } from "@/components/account-card";
import { Loading, Shell } from "@/components/ui";
import { NameCard } from "@/components/name-card";
import { signOut, useApp } from "@/lib/store";

export default function Account() {
  const app = useApp();
  const [unsaved, setUnsaved] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!app) return <Loading />;

  async function leave(force: boolean) {
    setBusy(true);
    const r = await signOut(force);
    setUnsaved(r.ok ? 0 : r.unsaved);
    setBusy(false);
  }

  const a = app.account;
  const sync = app.sync;
  const waiting = (app.pending?.length ?? 0) + (app.pendingDeletes?.length ?? 0);
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <p className="eyebrow">Account</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">{a ? "You're signed in" : "Keep your goals"}</h1>
      {a ? (
        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <p className="text-sm text-bone-mute">Signed in as</p>
            <p className="mt-1 text-lg font-semibold">{a.email}</p>
            <p className="mt-4 flex items-center gap-2 text-sm" role="status">
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${sync?.state === "error" ? "bg-bad" : sync?.state === "saving" || waiting ? "animate-glint bg-gold" : "bg-ok"}`}
              />
              {sync?.state === "error"
                ? "Couldn't save just now. We'll keep trying."
                : sync?.state === "offline"
                  ? "Offline. Changes save when you're back."
                  : waiting
                    ? "Saving…"
                    : "All goals saved to your account."}
            </p>
          </div>
          <NameCard current={app.settings.displayName} />
          {unsaved > 0 ? (
            <div className="card border-bad/50 p-5" role="alert">
              <p className="font-display text-xl font-bold uppercase tracking-wide">
                {unsaved} change{unsaved === 1 ? " hasn't" : "s haven't"} saved yet
              </p>
              <p className="mt-2 text-sm text-bone-dim">
                {typeof navigator !== "undefined" && !navigator.onLine ? "You're offline. " : ""}
                Signing out now clears this device, and {unsaved === 1 ? "that change" : "those changes"} would be lost. Get back online and try again to keep {unsaved === 1 ? "it" : "them"}.
              </p>
              <div className="mt-4 flex gap-2">
                <button className="btn-gold flex-1" disabled={busy} onClick={() => void leave(false)}>
                  Try Again
                </button>
                <button className="btn-ghost" disabled={busy} onClick={() => void leave(true)}>
                  Sign Out Anyway
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-ghost w-full" disabled={busy} onClick={() => void leave(false)}>
              {busy ? "Saving…" : "Sign Out"}
            </button>
          )}
          <p className="text-center text-xs text-bone-mute">Signing out removes the copy on this device. Your account keeps everything.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <p className="text-bone-dim">Sign in to keep your goals on every device, invite a brother to walk with you, and get reminders by email. Goals already on this phone come along.</p>
          <div className="card p-5">
            <SignInForm />
          </div>
        </div>
      )}
    </Shell>
  );
}

