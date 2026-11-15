// Calendar date in the member's time zone, "YYYY-MM-DD".
export type CalDate = string;

export type Health = "on_track" | "at_risk" | "off_track";
export type Lifecycle = "draft" | "active" | "completed" | "archived";
export type Template = "sprint7" | "goal30" | "custom";
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface PlanItem {
  id: string;
  title: string;
  dueDate?: CalDate;
  completed: boolean;
  completedAt?: string;
  order: number;
}

export type TimelineKind =
  | "created"
  | "activated"
  | "update"
  | "checkin"
  | "status"
  | "revision"
  | "completed"
  | "archived"
  | "restored"
  | "imported";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  at: string; // ISO timestamp
  text?: string;
  health?: Health;
  responses?: { did: string; blocker: string; next: string };
  occurrence?: CalDate; // the due date a check-in cleared
}

export interface Cadence {
  frequency: Frequency;
  anchorDate: CalDate; // first due date; its day-of-month is kept for monthly
  nextDue: CalDate;
}

export interface GuidedFields {
  outcome?: string;
  measure?: string;
  plan?: string;
  why?: string;
  targetDate?: CalDate;
}

export interface Goal {
  id: string;
  sourceId?: string; // id from the AIM prototype, for safe re-import
  commitment: string;
  description?: string;
  nextAction?: string;
  nextActionDate?: CalDate;
  guided: GuidedFields;
  category?: string;
  tags: string[]; // tag label ids, e.g. "lmtlss_room"
  roomIds: string[];
  template: Template;
  milestoneCount?: 4 | 6;
  health: Health;
  lifecycle: Lifecycle;
  priorLifecycle?: Lifecycle; // restored to this when un-archiving
  tasks: PlanItem[];
  milestones: PlanItem[];
  timeline: TimelineEntry[];
  cadence?: Cadence;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface Settings {
  lmtlssMode: boolean;
  timeZone: string;
  displayName?: string;
}

export interface AppState {
  version: 2;
  goals: Goal[];
  settings: Settings;
  submissionIds: string[]; // idempotency keys already applied
  importedFromV1?: string;
  /** Set once signed in. Goals then belong to this account; the local copy is a cache. */
  account?: { userId: string; email?: string };
  /** Goal ids changed on this device and not yet saved to the account. */
  pending?: string[];
  /** Goal ids removed on this device (drafts) not yet removed from the account. */
  pendingDeletes?: string[];
  sync?: { state: "idle" | "saving" | "error" | "offline"; at?: string; message?: string };
}
