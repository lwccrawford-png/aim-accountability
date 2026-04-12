import { v4 as uuidv4 } from "uuid";
import { GoalMilestone, GoalTask } from "@/lib/types";

const toIsoDate = (date: Date): string => date.toISOString().split("T")[0];

export function generateSprintTasks(startDate = new Date()): GoalTask[] {
  return Array.from({ length: 7 }, (_, index) => {
    const due = new Date(startDate);
    due.setDate(startDate.getDate() + index);

    return {
      id: uuidv4(),
      title: `Day ${index + 1} task`,
      completed: false,
      dueDate: toIsoDate(due)
    };
  });
}

export function generate30DayMilestones(
  count: 4 | 6,
  startDate = new Date()
): GoalMilestone[] {
  const step = Math.floor(30 / count);

  return Array.from({ length: count }, (_, index) => {
    const due = new Date(startDate);
    due.setDate(startDate.getDate() + step * (index + 1));

    return {
      id: uuidv4(),
      title: `Milestone ${index + 1}`,
      completed: false,
      dueDate: toIsoDate(due)
    };
  });
}
