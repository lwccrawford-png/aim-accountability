"use client";

import { SignInForm } from "@/components/account-card";
import { Loading, Shell } from "@/components/ui";
import { NameCard } from "@/components/name-card";
import { signOut, useApp } from "@/lib/store";

export default function Account() {
  const app = useApp();
  if (!app) return <Loading />;
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
          <button className="btn-ghost w-full" onClick={() => void signOut()}>
            Sign Out
          </button>
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

