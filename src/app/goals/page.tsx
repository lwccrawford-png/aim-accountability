"use client";

import Link from "next/link";
import { useState } from "react";
import { GoalCard } from "@/components/goal-card";
import { Chip, Empty, Loading, Shell } from "@/components/ui";
import { todayIn } from "@/lib/dates";
import { useApp } from "@/lib/store";
import type { Lifecycle } from "@/lib/types";

const TABS: { id: Lifecycle; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" }
];

export default function Goals() {
  const app = useApp();
  const [tab, setTab] = useState<Lifecycle>("active");
  if (!app) return <Loading />;
  const today = todayIn(app.settings.timeZone);
  const list = app.goals.filter((g) => g.lifecycle === tab);
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none">My Goals</h1>
      <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map((t) => (
          <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label} <span className="ml-1 opacity-60">{app.goals.filter((g) => g.lifecycle === t.id).length}</span>
          </Chip>
        ))}
      </div>
      <div className="mt-6">
        {list.length === 0 ? (
          <Empty
            title={tab === "completed" ? "No finished goals yet" : tab === "archived" ? "Nothing archived" : tab === "draft" ? "No drafts" : "Nothing active"}
            body={tab === "completed" ? "Finish one and it lives here for good." : "Name one commitment and a first step."}
            href="/new"
            cta="Set a Goal"
          />
        ) : tab === "draft" ? (
          <ul className="space-y-2">
            {list.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}/edit`} className="card flex min-h-[56px] items-center justify-between border-dashed px-4">
                  <span className="truncate">{g.commitment || g.nextAction || "Untitled draft"}</span>
                  <span className="text-sm text-gold">Finish</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {list.map((g, i) => (
              <GoalCard key={g.id} goal={g} today={today} delay={i} />
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
