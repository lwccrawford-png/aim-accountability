"use client";

import { FormEvent, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Goal, GoalMilestone, GoalStatus, GoalTask } from "@/lib/types";

interface GoalDetailProps {
  goal: Goal;
  onChange: (goal: Goal) => void;
  onArchive: (goalId: string) => void;
}

export function GoalDetail({ goal, onChange, onArchive }: GoalDetailProps) {
  const [newTask, setNewTask] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [updateStatus, setUpdateStatus] = useState<GoalStatus>(goal.status);

  const setTasks = (tasks: GoalTask[]) => onChange({ ...goal, tasks });
  const setMilestones = (milestones: GoalMilestone[]) => onChange({ ...goal, milestones });

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([
      ...goal.tasks,
      { id: uuidv4(), title: newTask.trim(), completed: false, dueDate: undefined }
    ]);
    setNewTask("");
  };

  const addMilestone = (e: FormEvent) => {
    e.preventDefault();
    if (!newMilestone.trim()) return;
    setMilestones([
      ...goal.milestones,
      { id: uuidv4(), title: newMilestone.trim(), completed: false, dueDate: undefined }
    ]);
    setNewMilestone("");
  };

  const postUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!updateNote.trim()) return;

    onChange({
      ...goal,
      status: updateStatus,
      updates: [
        {
          id: uuidv4(),
          status: updateStatus,
          note: updateNote.trim(),
          createdAt: new Date().toISOString()
        },
        ...goal.updates
      ]
    });
    setUpdateNote("");
  };

  return (
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{goal.title}</h2>
          {goal.description && <p className="text-sm text-slate-600">{goal.description}</p>}
        </div>
        <button
          onClick={() => onArchive(goal.id)}
          className="rounded border px-3 py-1 text-sm hover:bg-slate-100"
        >
          Archive Goal
        </button>
      </header>

      <div className="rounded border p-3">
        <label className="mb-1 block text-sm font-medium">Status</label>
        <select
          value={goal.status}
          onChange={(e) => onChange({ ...goal, status: e.target.value as GoalStatus })}
          className="rounded border px-2 py-1"
        >
          <option>On Track</option>
          <option>At Risk</option>
          <option>Off Track</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-3">
          <h3 className="mb-2 font-medium">Tasks</h3>
          <form onSubmit={addTask} className="mb-2 flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="flex-1 rounded border px-2 py-1"
              placeholder="New task"
            />
            <button className="rounded bg-slate-900 px-3 py-1 text-white">Add</button>
          </form>
          <ul className="space-y-2">
            {goal.tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() =>
                    setTasks(
                      goal.tasks.map((t) =>
                        t.id === task.id ? { ...t, completed: !t.completed } : t
                      )
                    )
                  }
                />
                <input
                  value={task.title}
                  onChange={(e) =>
                    setTasks(
                      goal.tasks.map((t) =>
                        t.id === task.id ? { ...t, title: e.target.value } : t
                      )
                    )
                  }
                  className="flex-1 rounded border px-2 py-1"
                />
                <button
                  onClick={() => setTasks(goal.tasks.filter((t) => t.id !== task.id))}
                  className="text-sm text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border p-3">
          <h3 className="mb-2 font-medium">Milestones</h3>
          <form onSubmit={addMilestone} className="mb-2 flex gap-2">
            <input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              className="flex-1 rounded border px-2 py-1"
              placeholder="New milestone"
            />
            <button className="rounded bg-slate-900 px-3 py-1 text-white">Add</button>
          </form>
          <ul className="space-y-2">
            {goal.milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={milestone.completed}
                  onChange={() =>
                    setMilestones(
                      goal.milestones.map((m) =>
                        m.id === milestone.id ? { ...m, completed: !m.completed } : m
                      )
                    )
                  }
                />
                <input
                  value={milestone.title}
                  onChange={(e) =>
                    setMilestones(
                      goal.milestones.map((m) =>
                        m.id === milestone.id ? { ...m, title: e.target.value } : m
                      )
                    )
                  }
                  className="flex-1 rounded border px-2 py-1"
                />
                <button
                  onClick={() =>
                    setMilestones(goal.milestones.filter((m) => m.id !== milestone.id))
                  }
                  className="text-sm text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded border p-3">
        <h3 className="mb-2 font-medium">Update Feed</h3>
        <form onSubmit={postUpdate} className="mb-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
          <select
            value={updateStatus}
            onChange={(e) => setUpdateStatus(e.target.value as GoalStatus)}
            className="rounded border px-2 py-1"
          >
            <option>On Track</option>
            <option>At Risk</option>
            <option>Off Track</option>
          </select>
          <input
            value={updateNote}
            onChange={(e) => setUpdateNote(e.target.value)}
            className="rounded border px-2 py-1"
            placeholder="What changed?"
          />
          <button className="rounded bg-slate-900 px-3 py-1 text-white">Post</button>
        </form>

        <ul className="space-y-2">
          {goal.updates.map((update) => (
            <li key={update.id} className="rounded border bg-slate-50 p-2 text-sm">
              <p className="font-medium">{update.status}</p>
              <p>{update.note}</p>
              <p className="text-xs text-slate-500">
                {new Date(update.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
