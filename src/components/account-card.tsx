"use client";

import { useState } from "react";
import { signInWithEmail } from "@/lib/store";
import { accountsEnabled } from "@/lib/supabase";

/** Email sign-in. No passwords: a link arrives by email. */
export function SignInForm({ next, cta = "Send My Sign-in Link" }: { next?: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  if (!accountsEnabled) return <p className="text-sm text-bone-mute">Accounts aren&apos;t switched on yet. Your goals are saved on this device.</p>;
  if (state === "sent")
    return (
      <div role="status" className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-4">
        <p className="font-display text-lg font-bold uppercase text-gold-soft">Check your email</p>
        <p className="mt-1 text-sm text-bone-dim">We sent a sign-in link to {email}. Open it on this device and your goals come with you.</p>
      </div>
    );
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try {
          await signInWithEmail(email.trim(), next);
          setState("sent");
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
          setState("error");
        }
      }}
    >
      <label htmlFor="email" className="label">
        Email
      </label>
      <input id="email" type="email" required autoComplete="email" inputMode="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {state === "error" && <p className="text-sm text-bad" role="alert">{msg}</p>}
      <button type="submit" className="btn-gold w-full" disabled={state === "sending" || !email.includes("@")}>
        {state === "sending" ? "Sending…" : cta}
      </button>
    </form>
  );
}
