"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Health, Lifecycle } from "@/lib/types";

export function Wordmark({ lmtlss }: { lmtlss?: boolean }) {
  return (
    <Link href="/" className="group inline-flex flex-col leading-none" aria-label="Accountability home">
      <span className="font-display text-[22px] font-extrabold uppercase tracking-[0.12em] text-bone">
        Account<span className="text-gold">ability</span>
      </span>
      <span className="mt-1 font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-bone-mute">
        {lmtlss ? "LMTLSS mode" : "built by LMTLSS"}
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Home", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/goals", label: "Goals", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" },
  { href: "/rooms", label: "Rooms", icon: "M4 21V8l8-5 8 5v13M9 21v-7h6v7", lmtlss: true },
  { href: "/brotherhood", label: "Brothers", icon: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3.3 0 6 2 6 5", lmtlss: true },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" }
];

export function Shell({ children, lmtlss, hideNav }: { children: React.ReactNode; lmtlss: boolean; hideNav?: boolean }) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Wordmark lmtlss={lmtlss} />
        {!hideNav && (
          <Link href="/new" className="btn-gold min-h-[42px] px-4 text-sm">
            <span aria-hidden className="text-lg leading-none">+</span> New Goal
          </Link>
        )}
      </header>
      <main className="flex-1 px-5 pb-32 pt-4">{children}</main>
      {!hideNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        >
          <ul className="mx-auto flex max-w-xl">
            {NAV.filter((n) => lmtlss || !n.lmtlss).map((n) => {
              const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <li key={n.href} className="flex-1">
                  <Link
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      on ? "text-gold" : "text-bone-mute hover:text-bone"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
                      <path d={n.icon} />
                    </svg>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

const HEALTH_UI: Record<Health, { label: string; cls: string; glyph: string }> = {
  on_track: { label: "On Track", cls: "text-ok border-ok/40 bg-ok/10", glyph: "▲" },
  at_risk: { label: "At Risk", cls: "text-warn border-warn/40 bg-warn/10", glyph: "◆" },
  off_track: { label: "Off Track", cls: "text-bad border-bad/40 bg-bad/10", glyph: "▼" }
};

export const healthLabel = (h: Health) => HEALTH_UI[h].label;

export function HealthBadge({ health }: { health: Health }) {
  const h = HEALTH_UI[health];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${h.cls}`}>
      <span aria-hidden className="text-[9px]">{h.glyph}</span>
      {h.label}
    </span>
  );
}

export function HealthPicker({ value, onChange }: { value: Health; onChange: (h: Health) => void }) {
  return (
    <div role="radiogroup" aria-label="How's it going" className="grid grid-cols-3 gap-2">
      {(Object.keys(HEALTH_UI) as Health[]).map((h) => (
        <button
          key={h}
          type="button"
          role="radio"
          aria-checked={value === h}
          onClick={() => onChange(h)}
          className={`min-h-[48px] rounded-xl border text-sm font-semibold transition ${
            value === h ? HEALTH_UI[h].cls : "border-ink-600 text-bone-mute hover:text-bone"
          }`}
        >
          <span aria-hidden className="mr-1 text-[9px]">{HEALTH_UI[h].glyph}</span>
          {HEALTH_UI[h].label}
        </button>
      ))}
    </div>
  );
}

const LIFE: Record<Lifecycle, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived"
};

export function LifecycleTag({ value }: { value: Lifecycle }) {
  const cls =
    value === "completed"
      ? "bg-gold/15 text-gold-soft border-gold/40"
      : value === "draft"
        ? "border-dashed border-bone-mute/50 text-bone-dim"
        : value === "archived"
          ? "border-ink-600 text-bone-mute"
          : "border-ink-600 text-bone";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${cls}`}>
      {value === "completed" && <span aria-hidden className="mr-1">✓</span>}
      {LIFE[value]}
    </span>
  );
}

export function Chip({
  on,
  onClick,
  children,
  gold
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition ${
        on
          ? gold
            ? "border-gold bg-gold text-ink"
            : "border-bone bg-bone text-ink"
          : "border-ink-600 text-bone-dim hover:border-bone-mute hover:text-bone"
      }`}
    >
      {children}
    </button>
  );
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="card px-5 py-8 text-center">
      <p className="font-display text-xl font-bold uppercase tracking-wide">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-bone-dim">{body}</p>
      <Link href={href} className="btn-ghost mt-5">
        {cta}
      </Link>
    </div>
  );
}

export function Loading() {
  return <div className="mx-auto mt-24 h-1 w-16 animate-glint rounded-full bg-gold" aria-label="Loading" />;
}
