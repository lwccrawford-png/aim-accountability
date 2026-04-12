"use client";

import { FormEvent, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { generate30DayMilestones, generateSprintTasks } from "@/lib/goal-utils";
import { Goal, GoalStructure } from "@/lib/types";

interface GoalFormProps {
  onCreate: (goal: Goal) => void;
}

export function GoalForm({ onCreate }: GoalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [structure, setStructure] = useState<GoalStructure>("7-Day Sprint");
  const [milestoneCount, setMilestoneCount] = useState<4 | 6>(4);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const goal: Goal = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim() || undefined,
      structure,
      milestoneCount: structure === "30-Day Goal" ? milestoneCount : undefined,
      status: "On Track",
      tasks: structure === "7-Day Sprint" ? generateSprintTasks() : [],
      milestones:
        structure === "30-Day Goal" ? generate30DayMilestones(milestoneCount) : [],
      updates: [],
      createdAt: new Date().toISOString()
    };

    onCreate(goal);
    setTitle("");
    setDescription("");
    setStructure("7-Day Sprint");
    setMilestoneCount(4);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4 bg-white">
      <h2 className="text-lg font-semibold">Create Goal</h2>

      <div>
        <label className="mb-1 block text-sm font-medium">Title *</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="e.g. Ship v1 landing page"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border px-3 py-2"
          rows={3}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Structure</label>
        <select
          value={structure}
          onChange={(e) => setStructure(e.target.value as GoalStructure)}
          className="w-full rounded border px-3 py-2"
        >
          <option>7-Day Sprint</option>
          <option>30-Day Goal</option>
          <option>Custom</option>
        </select>
      </div>

      {structure === "30-Day Goal" && (
        <div>
          <label className="mb-1 block text-sm font-medium">Milestones</label>
          <select
            value={milestoneCount}
            onChange={(e) => setMilestoneCount(Number(e.target.value) as 4 | 6)}
            className="w-full rounded border px-3 py-2"
          >
            <option value={4}>4 milestones</option>
            <option value={6}>6 milestones</option>
          </select>
        </div>
      )}

      <button className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700" type="submit">
        Add Goal
      </button>
    </form>
  );
}
