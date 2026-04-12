import { Goal } from "@/lib/types";

const ACTIVE_KEY = "accountability_goals_v1";
const ARCHIVE_KEY = "accountability_goals_archive_v1";

const inBrowser = () => typeof window !== "undefined";

export function loadGoals(): Goal[] {
  if (!inBrowser()) return [];

  const raw = window.localStorage.getItem(ACTIVE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Goal[];
  } catch {
    return [];
  }
}

export function saveGoals(goals: Goal[]): void {
  if (!inBrowser()) return;
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(goals));
}

export function loadArchivedGoals(): Goal[] {
  if (!inBrowser()) return [];

  const raw = window.localStorage.getItem(ARCHIVE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Goal[];
  } catch {
    return [];
  }
}

export function saveArchivedGoals(goals: Goal[]): void {
  if (!inBrowser()) return;
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(goals));
}
