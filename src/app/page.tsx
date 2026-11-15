"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalForm } from "@/components/goal-form";
import { GoalCard } from "@/components/goal-card";
import { Empty, Loading, Shell } from "@/components/ui";
import { compare, friendly, todayIn } from "@/lib/dates";
import { importPrototype, readPrototype, useApp } from "@/lib/store";
import type { Goal } from "@/lib/types";

interface Due {
  key: string;
  goal: Goal;
  kind: "action" | "checkin";
  date: string;
  title: string;
  href: string;
}

export default function Home() {
  const app = useApp();
  const router = useRouter();
  const [importDismissed, setImportDismissed] = useState(false);

  const today = app ? todayIn(app.settings.timeZone) : "";
  const proto = useMemo(() => (app ? readPrototype() : null), [app]);

  if (!app) return <Loading />;
  const lmtlss = app.settings.lmtlssMode;
  const active = app.goals.filter((g) => g.lifecycle === "active");
  const drafts = app.goals.filter((g) => g.lifecycle === "draft");

  // First visit: the Quick Goal is the whole screen.
  if (app.goals.length === 0 && !(proto && proto.fresh.length > 0)) {
    return (
      <Shell lmtlss={lmtlss} hideNav>
        <GoalForm welcome lmtlss={lmtlss} today={today} onDone={(g) => router.push(`/goals/${g.id}?new=1`)} />
      </Shell>
    );
  }

  const due: Due[] = active.flatMap((g) => {
    const out: Due[] = [];
    if (g.nextAction && g.nextActionDate)
      out.push({ key: g.id + "a", goal: g, kind: "action", date: g.nextActionDate, title: g.nextAction, href: `/goals/${g.id}` });
    if (g.cadence)
      out.push({ key: g.id + "c", goal: g, kind: "checkin", date: g.cadence.nextDue, title: "Report your progress", href: `/goals/${g.id}/check-in` });
    return out;
  });
  const sort = (a: Due, b: Due) => compare(a.date, b.date);
  const actions = due.filter((d) => d.kind === "action").sort(sort);
  const checkins = due.filter((d) => d.kind === "checkin").sort(sort);

  return (
    <Shell lmtlss={lmtlss}>
      {proto && proto.fresh.length > 0 && !importDismissed && (
        <div className="card mb-6 border-gold/40 p-5">
          <p className="eyebrow">From the earlier version</p>
          <p className="mt-2 text-bone-dim">
            We found {proto.fresh.length} goal{proto.fresh.length === 1 ? "" : "s"} saved on this device. Bring them in? They stay private, and the
            originals stay where they are.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {proto.fresh.slice(0, 5).map((g) => (
              <li key={g.id} className="truncate">
                · {g.title} {g.archivedAt && <span className="text-bone-mute">(archived)</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3">
            <button className="btn-gold flex-1" onClick={() => importPrototype(proto.fresh)}>
              Bring Them In
            </button>
            <button className="btn-ghost" onClick={() => setImportDismissed(true)}>
              Not Now
            </button>
          </div>
        </div>
      )}

      <h1 className="sr-only">Home</h1>
      <div className="space-y-8">
        <DueBlock label="My next action" items={actions} today={today} empty="Give each goal one next step and it shows up here." />
        <DueBlock label="My next check-in" items={checkins} today={today} empty="Set a check-in rhythm on a goal to see it here." />
        <section>
          <p className="eyebrow mb-3">Partner check-ins I owe</p>
          <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">
            When a brother asks you to walk with him on a goal, the check-ins you owe him land here.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="eyebrow">Active goals</p>
            <Link href="/goals" className="text-sm text-bone-mute hover:text-gold">
              See all
            </Link>
          </div>
          {active.length === 0 ? (
            <Empty title="Nothing active" body="Pick one thing worth doing and name the first step." href="/new" cta="Set a Goal" />
          ) : (
            <ul className="space-y-3">
              {active.map((g, i) => (
                <GoalCard key={g.id} goal={g} today={today} delay={i} />
              ))}
            </ul>
          )}
        </section>

        {drafts.length > 0 && (
          <section>
            <p className="eyebrow mb-3 text-bone-mute">Drafts</p>
            <ul className="space-y-2">
              {drafts.map((g) => (
                <li key={g.id}>
                  <Link href={`/goals/${g.id}/edit`} className="card flex min-h-[52px] items-center justify-between border-dashed px-4">
                    <span className="truncate">{g.commitment || g.nextAction || "Untitled draft"}</span>
                    <span className="text-sm text-gold">Finish</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}

function DueBlock({ label, items, today, empty }: { label: string; items: Due[]; today: string; empty: string }) {
  const [first, ...rest] = items;
  return (
    <section>
      <p className="eyebrow mb-3">{label}</p>
      {!first ? (
        <p className="rounded-2xl border border-dashed border-ink-600 px-5 py-4 text-sm text-bone-mute">{empty}</p>
      ) : (
        <div className="space-y-2">
          <DueRow item={first} today={today} big />
          {rest.slice(0, 3).map((d) => (
            <DueRow key={d.key} item={d} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

function DueRow({ item, today, big }: { item: Due; today: string; big?: boolean }) {
  const overdue = compare(item.date, today) < 0;
  const isToday = item.date === today;
  return (
    <Link
      href={item.href}
      className={`card flex items-center gap-4 px-4 transition hover:border-gold/50 ${big ? "min-h-[84px] py-4" : "min-h-[56px] py-3"} ${
        overdue ? "border-bad/50" : ""
      }`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-xl font-display font-bold uppercase leading-none ${
          big ? "h-14 w-14 text-sm" : "h-10 w-10 text-[10px]"
        } ${overdue ? "bg-bad/15 text-bad" : isToday ? "bg-gold text-ink" : "bg-ink-700 text-bone-dim"}`}
      >
        {overdue ? "Late" : isToday ? "Today" : friendly(item.date, today).replace("Tomorrow", "Tmrw")}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${big ? "text-lg font-semibold" : "font-medium"}`}>{item.title}</span>
        <span className="block truncate text-sm text-bone-mute">
          {item.goal.commitment}
          {overdue && <span className="text-bad"> · due {friendly(item.date, today)}</span>}
        </span>
      </span>
      <span aria-hidden className="text-gold">
        →
      </span>
    </Link>
  );
}
