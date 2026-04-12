export type GoalStatus = "On Track" | "At Risk" | "Off Track";
export type GoalStructure = "7-Day Sprint" | "30-Day Goal" | "Custom";

export interface GoalTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
}

export interface GoalUpdate {
  id: string;
  status: GoalStatus;
  note: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  structure: GoalStructure;
  milestoneCount?: 4 | 6;
  status: GoalStatus;
  tasks: GoalTask[];
  milestones: GoalMilestone[];
  updates: GoalUpdate[];
  createdAt: string;
  archivedAt?: string;
}
