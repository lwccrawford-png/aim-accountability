"use client";

import { useRouter } from "next/navigation";
import { GoalForm } from "@/components/goal-form";
import { Loading, Shell } from "@/components/ui";
import { todayIn } from "@/lib/dates";
import { useApp } from "@/lib/store";

export default function NewGoal() {
  const app = useApp();
  const router = useRouter();
  if (!app) return <Loading />;
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <p className="eyebrow">New goal</p>
      <h1 className="mb-8 mt-2 font-display text-4xl font-extrabold uppercase leading-none">Set a Goal</h1>
      <GoalForm
        lmtlss={app.settings.lmtlssMode}
        today={todayIn(app.settings.timeZone)}
        onDone={(g) => router.push(g.lifecycle === "draft" ? "/" : `/goals/${g.id}?new=1`)}
      />
    </Shell>
  );
}
