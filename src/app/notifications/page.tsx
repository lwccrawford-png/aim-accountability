"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Loading, Shell } from "@/components/ui";
import { markInboxRead, useInbox } from "@/lib/notice-store";
import { ago, noticeLine } from "@/lib/notices";
import { useApp } from "@/lib/store";

export default function Notifications() {
  const app = useApp();
  const userId = app?.account?.userId;
  const inbox = useInbox(userId);

  // Opening the page is reading it. The "new" marks stay until he comes back.
  useEffect(() => {
    if (userId && inbox.unread > 0) void markInboxRead();
  }, [userId, inbox.unread]);

  if (!app) return <Loading />;
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <p className="eyebrow">Notifications</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">What&apos;s new</h1>

      {!app.account ? (
        <div className="card mt-6 p-5">
          <p className="text-bone-dim">
            When a brother checks in with you, asks a question or sends a suggestion, it shows up here. That needs an account, so the app knows who to tell.
          </p>
          <Link href="/account" className="btn-gold mt-5 w-full">
            Sign In
          </Link>
        </div>
      ) : inbox.items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-600 px-5 py-6">
          <p className="font-display text-xl font-bold uppercase tracking-wide">Nothing yet</p>
          <p className="mt-1 text-sm text-bone-mute">
            Invite a brother to walk with you on a goal. When he checks in, asks or suggests something, you&apos;ll see it here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {inbox.items.map((n) => {
            const line = noticeLine(n);
            return (
              <li key={n.id}>
                <Link href={line.href} className={`card flex gap-3 px-4 py-4 transition hover:border-gold/50 ${n.read ? "" : "border-gold/50"}`}>
                  <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-ink-600" : "bg-gold"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`min-w-0 ${n.read ? "font-medium text-bone-dim" : "font-semibold"}`}>
                        {!n.read && <span className="sr-only">New: </span>}
                        {line.title}
                      </span>
                      <span className="shrink-0 text-xs text-bone-mute">{ago(n.at)}</span>
                    </span>
                    {n.body && <span className="mt-1 block text-sm text-bone-dim line-clamp-2">“{n.body}”</span>}
                    {n.goal && <span className="mt-1 block truncate text-xs text-bone-mute">{n.goal}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-bone-mute">
        What&apos;s due is on <Link href="/" className="text-bone-dim underline underline-offset-4">Today</Link>. Email reminders are in{" "}
        <Link href="/settings" className="text-bone-dim underline underline-offset-4">Settings</Link>.
      </p>
    </Shell>
  );
}
