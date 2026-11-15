"use client";

import { useState } from "react";
import { SignInForm } from "@/components/account-card";
import { FREQUENCY_LABEL, friendly } from "@/lib/dates";
import { createInvite, endPartnership, revokeInvite } from "@/lib/partners";
import { accountsEnabled } from "@/lib/supabase";
import type { Goal, ShareScope } from "@/lib/types";

const STATUS_LABEL = {
  pending: "Waiting",
  accepted: "Accepted",
  declined: "Declined",
  revoked: "Taken back",
  expired: "Expired"
} as const;

export function BrotherCard({ goal, signedIn, today }: { goal: Goal; signedIn: boolean; today: string }) {
  const sharing = goal.sharing;
  const partner = sharing?.partner;
  const pending = sharing?.invites?.find((i) => i.status === "pending");
  const [composing, setComposing] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!accountsEnabled) return null;

  if (!signedIn)
    return (
      <section className="card p-5">
        <p className="eyebrow">Brother</p>
        <p className="mt-2 text-bone-dim">Invite one man to see this goal and check in on you. Sign in first, so he knows it&apos;s you.</p>
        <div className="mt-4">
          <SignInForm next={`/goals/${goal.id}`} cta="Sign In to Invite" />
        </div>
      </section>
    );

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <p className="eyebrow">Brother</p>

      {partner && !composing && (
        <div className="mt-3">
          <p className="font-display text-2xl font-extrabold uppercase">{partner.name}</p>
          <p className="text-sm text-bone-mute">Walking with you since {new Date(partner.since).toLocaleDateString()}</p>
          <p className="mt-2 text-sm text-bone-dim">
            {partner.cadence
              ? `He checks in ${FREQUENCY_LABEL[partner.cadence.frequency].toLowerCase()} · next ${friendly(partner.cadence.nextDue, today)}`
              : "He hasn't set his check-in rhythm yet."}
          </p>
          <p className="mt-1 text-xs text-bone-mute">
            He sees your plan and the conversation{partner.scope.checkins ? ", plus your check-ins" : ""}
            {partner.scope.details ? ", plus why it matters" : ""}.
          </p>
          {confirmEnd ? (
            <div className="mt-4 rounded-xl border border-bad/40 p-4">
              <p className="text-sm">Remove {partner.name}? He loses access right away. Your history stays.</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1 border-bad/50 text-bad" disabled={busy} onClick={() => run(() => endPartnership(goal.id))}>
                  Remove Him
                </button>
                <button className="btn-ghost" onClick={() => setConfirmEnd(false)}>
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setComposing(true)}>
                Replace
              </button>
              <button className="btn-ghost flex-1" onClick={() => setConfirmEnd(true)}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {!partner && !pending && !composing && !link && (
        <>
          <p className="mt-2 text-bone-dim">One man who&apos;ll ask you the hard question. He sees this goal, nothing else.</p>
          <button className="btn-gold mt-4 w-full" disabled={goal.lifecycle !== "active"} onClick={() => setComposing(true)}>
            Invite a Brother
          </button>
        </>
      )}

      {link && <InviteLink link={link} onDone={() => setLink(null)} />}

      {!link && pending && !composing && (
        <div className="mt-3 rounded-xl border border-gold/30 p-4">
          <p className="text-sm">
            Waiting on <span className="font-semibold">{pending.email}</span>
          </p>
          <p className="text-xs text-bone-mute">Link expires {friendly(pending.expiresAt.slice(0, 10), today)}</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setComposing(true)}>
              New Link
            </button>
            <button className="btn-ghost flex-1" disabled={busy} onClick={() => run(() => revokeInvite(pending.id))}>
              Take It Back
            </button>
          </div>
        </div>
      )}

      {composing && (
        <InviteComposer
          replacing={partner?.name}
          busy={busy}
          onCancel={() => setComposing(false)}
          onSend={(email, scope) =>
            run(async () => {
              const r = await createInvite(goal.id, email, scope);
              setLink(r.link);
              setComposing(false);
            })
          }
        />
      )}

      {err && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {err}
        </p>
      )}

      {(sharing?.invites?.length ?? 0) > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-bone-mute">Invite history</summary>
          <ul className="mt-2 space-y-1">
            {sharing!.invites!.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="truncate">{i.email}</span>
                <span className="shrink-0 text-bone-mute">{STATUS_LABEL[i.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function InviteComposer({
  onSend,
  onCancel,
  busy,
  replacing
}: {
  onSend: (email: string, scope: ShareScope) => void;
  onCancel: () => void;
  busy: boolean;
  replacing?: string;
}) {
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<ShareScope>({ checkins: true, details: false });
  const [review, setReview] = useState(false);
  const valid = /.+@.+\..+/.test(email.trim());

  if (review)
    return (
      <div className="mt-3 space-y-3">
        <p className="font-display text-lg font-bold uppercase">Before you send</p>
        <dl className="space-y-2 rounded-xl border border-ink-600 p-4 text-sm">
          <div>
            <dt className="text-bone-mute">Going to</dt>
            <dd className="font-semibold">{email.trim()}</dd>
          </div>
          <div>
            <dt className="text-bone-mute">He&apos;ll see</dt>
            <dd>
              This goal, your next step, the plan and status{scope.checkins ? ", your check-ins" : ""}
              {scope.details ? ", what it looks like done and why it matters" : ""}, and anything you post to him.
            </dd>
          </div>
          <div>
            <dt className="text-bone-mute">He won&apos;t see</dt>
            <dd>Your other goals, your updates, or anything from before he joined.</dd>
          </div>
          {replacing && (
            <div>
              <dt className="text-bone-mute">{replacing}</dt>
              <dd>Loses access when the new man accepts.</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-bone-mute">He has to sign in with this email to accept. The link works for 7 days.</p>
        <div className="flex gap-2">
          <button className="btn-gold flex-1" disabled={busy} onClick={() => onSend(email.trim(), scope)}>
            {busy ? "Making link…" : "Create Invite Link"}
          </button>
          <button className="btn-ghost" onClick={() => setReview(false)}>
            Back
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setReview(true);
      }}
    >
      <div>
        <label htmlFor="bro-email" className="label">
          His email
        </label>
        <input id="bro-email" type="email" inputMode="email" autoComplete="off" className="field" placeholder="brother@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Also share</legend>
        <Toggle on={scope.checkins} onChange={(v) => setScope({ ...scope, checkins: v })} label="My check-ins" hint="What you did, what got in the way" />
        <Toggle on={scope.details} onChange={(v) => setScope({ ...scope, details: v })} label="Why it matters and what done looks like" hint="Your guided answers" />
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1" disabled={!valid}>
          Review
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-ink-600 px-4 text-left"
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-bone-mute">{hint}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full border transition ${on ? "border-gold bg-gold" : "border-ink-600 bg-ink-700"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${on ? "left-6 bg-ink" : "left-1 bg-bone-mute"}`} />
      </span>
    </button>
  );
}

function InviteLink({ link, onDone }: { link: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = "I'm working on a goal and I want you holding me to it. Here's the link:";
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-gold/50 bg-gold/10 p-4">
      <p className="font-display text-lg font-bold uppercase text-gold-soft">Link ready</p>
      <p className="text-sm text-bone-dim">Send it to him however you two talk. It only shows up once, so send it now.</p>
      <input readOnly aria-label="Invite link" className="field py-2.5 text-sm" value={link} onFocus={(e) => e.target.select()} />
      <div className="flex gap-2">
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button className="btn-gold flex-1" onClick={() => navigator.share({ title: "Accountability", text, url: link }).catch(() => {})}>
            Send It
          </button>
        )}
        <button
          className="btn-ghost flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${text} ${link}`);
              setCopied(true);
            } catch {
              /* select-and-copy still works */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button className="w-full py-2 text-sm text-bone-mute hover:text-bone" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
