# Accountability roadmap

Decisions (Larry, 2026-11-15): the product is named "Accountability," built by LMTLSS. It serves men in general, with LMTLSS mode as an opt-in toggle. Volunteer Brothers / Goal Mover matching is shelved. The price is $20/year. Build order is below.

| Step | Scope | Status |
|---|---|---|
| 1 | Quick Goal, My Goals, goal detail, owner check-ins, LMTLSS mode + Room tags, prototype import | **Done** |
| 2 | Accounts + Supabase storage, Row Level Security, move device goals into the account | **Done** (email-link sign-in not yet tested with a real inbox) |
| 3 ← next | Partner invites (one per goal, scoped link, expiry/revoke, partner cadence + check-ins, suggestions) | |
| 4 | Brotherhood feed (LMTLSS mode), celebrations, reactions, comments, reports, admin hide | |
| 5 | Plan a New Season (bulk entry) | Last |

## Step 2: what was built

- Supabase project **Accountability** (`cgajwxzovorjekcjehay`, us-east-2, $0/month), in the Evolve and Advance Consulting org. Migrations are in `supabase/migrations/` (0001 schema, 0002 advisor fixes, 0003 members policy fix).
- Sign-in uses an email link, with no passwords. Signing in is optional, and it's offered after the first goal ("Keep it") and on `/account`.
- On the first sign-in on a device, goals made before signing in upload once (matched by goal id), and a backup stays at `accountability_v2_device_backup`. A different account signing in on the same phone never gets the previous man's cached goals. Device settings seed a brand-new account only; after that, the account's settings win.
- Every change saves through `save_goal` (one transaction per goal). The client sends the whole timeline, and the server skips entries it already has. A new check-in for a date that's already recorded is refused by a unique index, and the schedule stays put.
- Row Level Security on every table. Tested with two accounts in SQL and in the browser: the second account can't read, change, add to, or delete the first one's goals; signed-out callers can't call the functions; a member can't make himself an admin. The Supabase security advisor is clean apart from "leaked password protection," which doesn't apply (no passwords).
- Sync across two "devices" (localhost and 127.0.0.1, which have separate storage) was checked: a goal made on one shows up on the other, an archive on device 2 reaches device 1, and sign-out removes the device copy.

### Before real users sign in

- In Supabase → Authentication → URL Configuration, set the **Site URL** to the production domain and add `http://localhost:3457/**` (dev) to **Redirect URLs**. Without this, sign-in emails send people to the default `localhost:3000`.
- The built-in Supabase email sender only allows a few emails per hour. Set up custom SMTP before launch.
- `.env.local` (gitignored) holds the project URL and publishable key. `.env.example` shows the shape.

## Paywall ($20/year) — planned, not wired

- One Stripe Price: $20/year recurring. The free tier: one active goal, Quick Goal, check-ins. Paid unlocks unlimited goals, partner invites, and the Brotherhood feed (to be confirmed).
- Checkout runs through a Supabase edge function. A webhook sets `members.plan`, and RLS or the server enforces limits, not the UI.
- **Live payments wait for Larry's OK.** Build against Stripe test mode until he approves.

## Open items

- `lmtlss-website/START_HERE.md` still says "nine-room framework," but the live v8 homepage lists ten Rooms. The app uses ten. The site copy should be reconciled.
- What the free tier includes vs. the paid tier (above is a proposal).
- The production domain and hosting (Vercel, or the droplet as with other products).
- Two older local checkouts exist: `~/Documents/GitHub/aim-accountability` (7 commits behind) and `~/Developer/aim-accountability`. This copy (`Claude Cowork/accountability`) is the working one.
