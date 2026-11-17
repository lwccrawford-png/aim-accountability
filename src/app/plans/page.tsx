"use client";

import { useState } from "react";
import { Loading, Shell } from "@/components/ui";
import { PLAN, PRICES, formatPrice, yearlySavings, type Interval } from "@/lib/plans";
import { useApp } from "@/lib/store";

export default function Plans() {
  const app = useApp();
  const [interval, setBilling] = useState<Interval>("year");
  if (!app) return <Loading />;
  const price = PRICES[interval];
  const save = yearlySavings();
  return (
    <Shell lmtlss={app.settings.lmtlssMode}>
      <p className="eyebrow">Plans</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">Bring a brother in</h1>
      <p className="mt-3 text-bone-dim">Your goals are free. Accountability with another man is where the plan comes in.</p>

      <div role="radiogroup" aria-label="Billing" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-ink-700 bg-ink-900 p-1">
        {(Object.keys(PRICES) as Interval[]).map((i) => (
          <button
            key={i}
            role="radio"
            aria-checked={interval === i}
            onClick={() => setBilling(i)}
            className={`min-h-[48px] rounded-xl font-display text-sm font-bold uppercase tracking-[0.12em] transition ${
              interval === i ? "bg-gold text-ink" : "text-bone-mute hover:text-bone"
            }`}
          >
            {PRICES[i].label}
            {i === "year" && save > 0 && <span className="ml-1.5 text-[11px] normal-case tracking-normal opacity-80">save ${save}</span>}
          </button>
        ))}
      </div>

      <section className="card mt-4 border-gold/40 p-6">
        <p className="font-display text-5xl font-extrabold">{formatPrice(price)}</p>
        {price.note && <p className="mt-1 text-sm text-bone-mute">{price.note}</p>}
        <ul className="mt-5 space-y-2">
          {PLAN.paid.map((f) => (
            <li key={f} className="flex gap-3">
              <span aria-hidden className="text-gold">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <button className="btn-gold mt-6 w-full" disabled={!PLAN.checkoutEnabled}>
          {PLAN.checkoutEnabled ? `Start ${price.label}` : "Checkout opens soon"}
        </button>
      </section>

      <section className="card mt-4 p-6">
        <p className="font-display text-xl font-bold uppercase tracking-wide">Free</p>
        <ul className="mt-3 space-y-2 text-bone-dim">
          {PLAN.free.map((f) => (
            <li key={f} className="flex gap-3">
              <span aria-hidden className="text-bone-mute">·</span>
              {f}
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
