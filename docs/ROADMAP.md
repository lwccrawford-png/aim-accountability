# Accountability roadmap

Decisions (Larry, 2026-11-15): the product is named "Accountability," built by LMTLSS. It serves men in general, with LMTLSS mode as an opt-in toggle. Volunteer Brothers / Goal Mover matching is shelved. The price is $20/year. Build order is below.

| Step | Scope | Status |
|---|---|---|
| 1 | Quick Goal, My Goals, goal detail, owner check-ins, LMTLSS mode + Room tags, prototype import | **Done** (device storage only) |
| 2 | Accounts + Supabase storage, Row Level Security, move device goals into the account | Next |
| 3 | Partner invites (one per goal, scoped link, expiry/revoke, partner cadence + check-ins, suggestions) | |
| 4 | Brotherhood feed (LMTLSS mode), celebrations, reactions, comments, reports, admin hide | |
| 5 | Plan a New Season (bulk entry) | Last |

## Step 2 plan

- Base it on `template-library/saas-blackbox-backend/` (Supabase Auth + Stripe).
- Sign-up comes *after* the first goal: "Save this goal to your account" on the goal page. Device goals upload once, matched by goal id so a retry doesn't duplicate.
- Tables: `members`, `goals`, `plan_items`, `goal_rooms`, `timeline_entries`, `cadences`, `checkins` (unique on actor + goal + occurrence, plus a client submission id). Partner, feed and report tables come in steps 3–4.
- RLS: the owner can read and write his own goals and child rows. Partner policies come in step 3.
- `src/lib/store.ts` is the only place that reads or writes data. Swap its internals and keep the same action names.

## Paywall ($20/year) — planned, not wired

- One Stripe Price: $20/year recurring. The free tier: one active goal, Quick Goal, check-ins. Paid unlocks unlimited goals, partner invites, and the Brotherhood feed (to be confirmed).
- Checkout runs through a Supabase edge function. A webhook sets `members.plan`, and RLS or the server enforces limits, not the UI.
- **Live payments wait for Larry's OK.** Build against Stripe test mode until he approves.

## Open items

- `lmtlss-website/START_HERE.md` still says "nine-room framework," but the live v8 homepage lists ten Rooms. The app uses ten. The site copy should be reconciled.
- What the free tier includes vs. the paid tier (above is a proposal).
- The production domain and hosting (Vercel, or the droplet as with other products).
- Two older local checkouts exist: `~/Documents/GitHub/aim-accountability` (7 commits behind) and `~/Developer/aim-accountability`. This copy (`Claude Cowork/accountability`) is the working one.
