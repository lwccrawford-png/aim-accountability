import { addDays } from "./dates.ts";
import type { CalDate, PlanItem } from "@/lib/types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Seven daily tasks, day 1 = start date.
export function sprintTasks(start: CalDate): PlanItem[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: uid(),
    title: `Day ${i + 1}`,
    dueDate: addDays(start, i),
    completed: false,
    order: i
  }));
}

// Four or six milestones spread across 30 days; the last one lands on day 30.
export function thirtyDayMilestones(start: CalDate, count: 4 | 6): PlanItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: uid(),
    title: i === count - 1 ? "Finish line" : `Milestone ${i + 1}`,
    dueDate: addDays(start, Math.round((30 * (i + 1)) / count) - 1),
    completed: false,
    order: i
  }));
}
