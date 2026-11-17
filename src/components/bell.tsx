"use client";

import Link from "next/link";
import { useInbox } from "@/lib/notice-store";
import { badge } from "@/lib/notices";
import { useApp } from "@/lib/store";

/** The bell in the header, with a count of what he hasn't seen. */
export function Bell({ on }: { on: boolean }) {
  const app = useApp();
  const { unread } = useInbox(app?.account?.userId);
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
      aria-current={on ? "page" : undefined}
      className={`relative grid h-[42px] w-[42px] place-items-center rounded-full border transition ${
        on ? "border-gold text-gold" : "border-ink-600 text-bone-dim hover:border-gold/50 hover:text-gold"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 21h4" />
      </svg>
      {unread > 0 && (
        <span aria-hidden className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold leading-none text-ink">
          {badge(unread)}
        </span>
      )}
    </Link>
  );
}
