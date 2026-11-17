"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalForm } from "@/components/goal-form";
import { GoalCard } from "@/components/goal-card";
import { TodayDashboard } from "@/components/today-dashboard";
import { Empty, Loading, Shell } from "@/components/ui";
import { todayIn } from "@/lib/dates";
import { importPrototype, readPrototype, useApp } from "@/lib/store";

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
  if (app.goals.length === 0 && !(app.partnerships?.length) && !(proto && proto.fresh.length > 0)) {
    return (
      <Shell lmtlss={lmtlss} hideNav>
        <GoalForm welcome lmtlss={lmtlss} today={today} onDone={(g) => router.push(`/goals/${g.id}?new=1`)} />
      </Shell>
    );
  }

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

      <TodayDashboard app={app} today={today} />

      <div className="mt-10 space-y-8">
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
