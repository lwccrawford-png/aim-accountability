// In-app notifications (the bell). Pure helpers only, so they can be tested
// without the browser. Fetching lives in notice-store.ts.

export type NoticeKind =
  | "checkin"
  | "completed"
  | "question"
  | "reply"
  | "partner_checkin"
  | "suggestion"
  | "partner_joined"
  | "left"
  | "removed"
  | "blocker_read";

export interface Notice {
  id: string;
  kind: NoticeKind;
  /** Which side of the goal the reader is on. */
  side: "owner" | "partner";
  goalId?: string;
  actor?: string;
  goal?: string;
  body?: string;
  at: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: Notice[];
}

/** One line saying what happened, and where a tap should go. */
export function noticeLine(n: Notice): { title: string; href: string } {
  const who = n.actor || (n.side === "owner" ? "Your brother" : "He");
  const mine = n.goalId ? `/goals/${n.goalId}` : "/";
  const his = n.goalId ? `/brother/${n.goalId}` : "/";
  switch (n.kind) {
    case "partner_checkin":
      return { title: `${who} checked in with you`, href: `${mine}?tab=brother` };
    case "suggestion":
      return { title: `${who} sent a suggestion`, href: `${mine}?tab=brother` };
    case "partner_joined":
      return { title: `${who} is walking with you`, href: `${mine}?tab=brother` };
    case "left":
      return { title: `${who} stepped back from your goal`, href: `${mine}?tab=brother` };
    case "blocker_read":
      return { title: `${who} gave his read on a blocker`, href: `${mine}?tab=blockers` };
    case "checkin":
      return { title: `${who} checked in on his goal`, href: his };
    case "completed":
      return { title: `${who} finished his goal`, href: his };
    case "removed":
      return { title: `${who} ended the partnership`, href: "/" };
    case "question":
      return { title: `${who} asked a question`, href: n.side === "owner" ? `${mine}?tab=brother` : his };
    case "reply":
      return { title: `${who} replied`, href: n.side === "owner" ? `${mine}?tab=brother` : his };
  }
}

/** "Just now", "12 min ago", "3 hr ago", "Yesterday", "Nov 3". */
export function ago(at: string, now = new Date()): string {
  const then = new Date(at);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  if (hrs < 48) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const badge = (n: number) => (n > 9 ? "9+" : String(n));
