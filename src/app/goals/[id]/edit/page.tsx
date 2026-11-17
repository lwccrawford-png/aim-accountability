"use client";

import { useParams, useRouter } from "next/navigation";
import { GoalForm } from "@/components/goal-form";
import { Empty, Loading, Shell } from "@/components/ui";
import { todayIn } from "@/lib/dates";
import { deleteDraft, useApp } from "@/lib/store";

export default function EditGoal() {
  const { id } = useParams<{ id: string }>();
  const app = useApp();
  const router = useRouter();
  if (!app) return <Loading />;
  const goal = app.goals.find((g) => g.id === id);
  const lmtlss = app.settings.lmtlssMode;
  if (!goal)
    return (
      <Shell lmtlss={lmtlss}>
        <Empty title="Goal not found" body="It may have been removed on this device." href="/goals" cta="My Goals" />
      </Shell>
    );
  return (
    <Shell lmtlss={lmtlss}>
      <p className="eyebrow">{goal.lifecycle === "draft" ? "Finish your draft" : "Edit the plan"}</p>
      <h1 className="mb-8 mt-2 font-display text-4xl font-extrabold uppercase leading-none">
        {goal.lifecycle === "draft" ? "Set a Goal" : "Revise"}
      </h1>
      <GoalForm
        key={goal.id}
        goal={goal}
        lmtlss={lmtlss}
        today={todayIn(app.settings.timeZone)}
        onDone={(g) => router.push(g.lifecycle === "draft" ? "/" : `/goals/${g.id}`)}
      />
      {goal.lifecycle === "draft" && (
        <button
          className="mt-6 w-full py-3 text-sm text-bone-mute hover:text-bad"
          onClick={() => {
            if (confirm("Delete this draft?")) {
              deleteDraft(goal.id);
              router.push("/");
            }
          }}
        >
          Delete draft
        </button>
      )}
    </Shell>
  );
}
