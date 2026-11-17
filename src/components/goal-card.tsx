"use client";

import Link from "next/link";
import { HealthBadge } from "@/components/ui";
import { categoryName } from "@/lib/catalog";
import { friendly } from "@/lib/dates";
import type { Goal } from "@/lib/types";

export function GoalCard({ goal, today, delay = 0 }: { goal: Goal; today: string; delay?: number }) {
  const items = [...goal.tasks, ...goal.milestones];
  const done = items.filter((i) => i.completed).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <li className="animate-rise" style={{ animationDelay: `${delay * 50}ms` }}>
      <Link href={`/goals/${goal.id}`} className="card block p-4 transition hover:border-gold/50">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-xl font-bold uppercase leading-tight tracking-wide">{goal.commitment}</p>
          <HealthBadge health={goal.health} />
        </div>
        <p className="mt-2 text-sm text-bone-mute">
          {[categoryName(goal.category), goal.nextActionDate && `Next: ${friendly(goal.nextActionDate, today)}`].filter(Boolean).join(" · ") ||
            "No next step yet"}
        </p>
        {items.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Plan progress">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-bone-mute">
              {done}/{items.length}
            </span>
          </div>
        )}
      </Link>
    </li>
  );
}
