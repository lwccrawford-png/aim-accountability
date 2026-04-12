"use client";

import { useEffect, useMemo, useState } from "react";
import { GoalDetail } from "@/components/goal-detail";
import { GoalForm } from "@/components/goal-form";
import {
  loadArchivedGoals,
  loadGoals,
  saveArchivedGoals,
  saveGoals
} from "@/lib/storage";
import { Goal } from "@/lib/types";

export default function Home() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  useEffect(() => {
    const loadedGoals = loadGoals();
    const loadedArchivedGoals = loadArchivedGoals();
    setGoals(loadedGoals);
    setArchivedGoals(loadedArchivedGoals);
    if (loadedGoals.length > 0) {
      setSelectedGoalId(loadedGoals[0].id);
    }
  }, []);

  useEffect(() => {
    saveGoals(goals);
  }, [goals]);

  useEffect(() => {
    saveArchivedGoals(archivedGoals);
  }, [archivedGoals]);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId]
  );

  const upsertGoal = (updated: Goal) => {
    setGoals((current) =>
      current.map((goal) => (goal.id === updated.id ? updated : goal))
    );
  };

  const addGoal = (goal: Goal) => {
    setGoals((current) => [goal, ...current]);
    setSelectedGoalId(goal.id);
  };

  const archiveGoal = (goalId: string) => {
    setGoals((current) => {
      const goal = current.find((item) => item.id === goalId);
      if (!goal) return current;

      setArchivedGoals((archive) => [
        { ...goal, archivedAt: new Date().toISOString() },
        ...archive
      ]);

      const next = current.filter((item) => item.id !== goalId);
      if (selectedGoalId === goalId) {
        setSelectedGoalId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Accountability Dashboard</h1>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <GoalForm onCreate={addGoal} />

          <section className="rounded-lg border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Goals</h2>
            <ul className="space-y-2">
              {goals.length === 0 && (
                <li className="text-sm text-slate-500">No goals yet.</li>
              )}
              {goals.map((goal) => (
                <li key={goal.id}>
                  <button
                    onClick={() => setSelectedGoalId(goal.id)}
                    className={`w-full rounded border p-2 text-left text-sm ${
                      selectedGoalId === goal.id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-xs text-slate-500">{goal.structure}</p>
                    <p className="text-xs">Status: {goal.status}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Archived Goals</h2>
            <ul className="space-y-2 text-sm">
              {archivedGoals.length === 0 && (
                <li className="text-slate-500">No archived goals.</li>
              )}
              {archivedGoals.map((goal) => (
                <li key={goal.id} className="rounded border p-2">
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-xs text-slate-500">{goal.structure}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div>
          {selectedGoal ? (
            <GoalDetail goal={selectedGoal} onChange={upsertGoal} onArchive={archiveGoal} />
          ) : (
            <div className="rounded-lg border bg-white p-6 text-slate-500">
              Select a goal to view details.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
