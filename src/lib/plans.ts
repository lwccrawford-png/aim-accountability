// Pricing lives here and only here. Change a number, a label or a feature line
// and every screen that shows plans picks it up. Nothing charges a card yet:
// checkout stays off until Larry approves live Stripe.

export type Interval = "month" | "year";

export interface PlanPrice {
  interval: Interval;
  amount: number; // in dollars
  label: string; // shown on the toggle
  note?: string; // small line under the price
  /** Stripe Price id, from env so test/live ids can change without a code edit. */
  stripePriceId?: string;
}

export const PRICES: Record<Interval, PlanPrice> = {
  month: {
    interval: "month",
    amount: 2.99,
    label: "Monthly",
    note: "Cancel anytime",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
  },
  year: {
    interval: "year",
    amount: 20,
    label: "Yearly",
    note: "One payment a year",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY
  }
};

export const PLAN = {
  name: "Accountability",
  free: ["Unlimited private goals", "Quick Goal and guided goals", "Check-ins and reminders in the app", "LMTLSS mode and Rooms", "Your goals on every device"],
  paid: ["Invite a brother to any goal", "Partner check-ins and suggestions", "Brotherhood feed (LMTLSS mode)", "Plan a New Season"],
  /** Flip to true only after live Stripe is approved and wired. */
  checkoutEnabled: false
};

export const formatPrice = (p: PlanPrice) =>
  `$${Number.isInteger(p.amount) ? p.amount : p.amount.toFixed(2)}/${p.interval === "month" ? "mo" : "yr"}`;

/** What the yearly plan saves over twelve monthly payments, rounded to whole dollars. */
export const yearlySavings = () => Math.max(0, Math.round(PRICES.month.amount * 12 - PRICES.year.amount));
