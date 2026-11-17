import type { CalDate, Frequency } from "@/lib/types";

// All recurrence math runs on calendar dates (no clock time), so daylight
// saving shifts can't push a due date onto the wrong day.

export function todayIn(timeZone: string, now = new Date()): CalDate {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

function parts(d: CalDate) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

function fmt(y: number, m: number, day: number): CalDate {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(d: CalDate, n: number): CalDate {
  const { y, m, day } = parts(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Add months but keep the anchor's day; clamp to month end when it's missing.
export function addMonthsAnchored(anchor: CalDate, n: number): CalDate {
  const { y, m, day } = parts(anchor);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

export function compare(a: CalDate, b: CalDate) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(a: CalDate, b: CalDate) {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.day) - Date.UTC(pa.y, pa.m - 1, pa.day)) / 86400000
  );
}

export function occurrence(anchor: CalDate, f: Frequency, k: number): CalDate {
  switch (f) {
    case "daily":
      return addDays(anchor, k);
    case "weekly":
      return addDays(anchor, 7 * k);
    case "biweekly":
      return addDays(anchor, 14 * k);
    case "monthly":
      return addMonthsAnchored(anchor, k);
  }
}

// First scheduled occurrence strictly after `after`.
export function nextOccurrenceAfter(anchor: CalDate, f: Frequency, after: CalDate): CalDate {
  if (compare(anchor, after) > 0) return anchor;
  const gap = daysBetween(anchor, after);
  const approx =
    f === "daily" ? gap : f === "weekly" ? Math.floor(gap / 7) : f === "biweekly" ? Math.floor(gap / 14) : Math.floor(gap / 31);
  let k = Math.max(0, approx - 1);
  while (compare(occurrence(anchor, f, k), after) <= 0) k++;
  return occurrence(anchor, f, k);
}

export function friendly(d?: CalDate, today?: CalDate): string {
  if (!d) return "";
  if (today) {
    const diff = daysBetween(today, d);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
  }
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: today && today.slice(0, 4) !== String(y) ? "numeric" : undefined
  });
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every two weeks",
  monthly: "Every month"
};
