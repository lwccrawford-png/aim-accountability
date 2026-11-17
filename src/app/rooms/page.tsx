"use client";

import Link from "next/link";
import { Empty, Loading, Shell } from "@/components/ui";
import { ROOMS, visible } from "@/lib/catalog";
import { friendly, todayIn } from "@/lib/dates";
import { useApp } from "@/lib/store";

export default function Rooms() {
  const app = useApp();
  if (!app) return <Loading />;
  const lmtlss = app.settings.lmtlssMode;
  const today = todayIn(app.settings.timeZone);
  if (!lmtlss)
    return (
      <Shell lmtlss={false}>
        <Empty title="My Rooms" body="Rooms are part of LMTLSS mode. Turn it on in Settings to tag goals with the Origins Rooms." href="/settings" cta="Settings" />
      </Shell>
    );
  return (
    <Shell lmtlss>
      <p className="eyebrow">Origins</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">My Rooms</h1>
      <p className="mt-3 text-sm text-bone-mute">What you&apos;ve committed to in each room. Counts are a record, not a score.</p>
      <ul className="mt-6 space-y-3">
        {visible(ROOMS, true).map((r, i) => {
          const goals = app.goals.filter((g) => g.roomIds.includes(r.id));
          const active = goals.filter((g) => g.lifecycle === "active");
          const done = goals.filter((g) => g.lifecycle === "completed");
          const last = goals
            .flatMap((g) => g.timeline.filter((e) => e.kind === "checkin"))
            .sort((a, b) => b.at.localeCompare(a.at))[0];
          return (
            <li key={r.id} className="card animate-rise p-5" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-bold text-gold">{String(r.order).padStart(2, "0")}</span>
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">{r.name}</h2>
              </div>
              <p className="mt-1 text-sm italic text-bone-mute">“{r.must}”</p>
              {goals.length === 0 ? (
                <Link href="/new" className="mt-3 inline-block text-sm text-gold hover:underline">
                  Nothing here yet. Make a commitment →
                </Link>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-bone-dim">
                    {active.length} active · {done.length} completed
                    {last && <> · last check-in {friendly(todayIn(app.settings.timeZone, new Date(last.at)), today)}</>}
                  </p>
                  <ul className="space-y-1">
                    {[...active, ...done].map((g) => (
                      <li key={g.id}>
                        <Link href={`/goals/${g.id}`} className="flex items-center gap-2 hover:text-gold">
                          <span aria-hidden className={g.lifecycle === "completed" ? "text-gold" : "text-bone-mute"}>
                            {g.lifecycle === "completed" ? "✓" : "•"}
                          </span>
                          <span className="truncate">{g.commitment}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
