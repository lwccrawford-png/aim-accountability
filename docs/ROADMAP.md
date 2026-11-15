# Accountability roadmap

Decisions (Larry, 2026-11-15): the product is named "Accountability," built by LMTLSS. It serves men in general, with LMTLSS mode as an opt-in toggle. Volunteer Brothers / Goal Mover matching is shelved. The price is $20/year. Build order is below.

| Step | Scope | Status |
|---|---|---|
| 1 | Quick Goal, My Goals, goal detail, owner check-ins, LMTLSS mode + Room tags, prototype import | **Done** |
| 2 | Accounts + Supabase storage, Row Level Security, move device goals into the account | **Done** (email-link sign-in not yet tested with a real inbox) |
| 3 | Partner invites (one per goal, scoped link, expiry/revoke, partner cadence + check-ins, suggestions) | **Done** |
| 3b | Mobile tabs + 3-step Quick Goal, blockers (perceived/real, brother's read), AI help with copy-prompt fallback | **Done**, AI live since 2026-11-15 |
| 4 | Brotherhood feed (LMTLSS mode), celebrations, reactions, comments, reports, admin hide | **Done** |
| 5 | Plan a New Season (bulk entry) | **Done** (ungated for now; listed as paid in `plans.ts`) |

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

## Step 3b: layout, blockers, AI help

- Goal page: a pinned header (commitment, status, Rooms) with tabs **Plan · Check-ins · Blockers · Brother · History**. The tab is kept in the address. The brother's page has **His Goal · Blockers · Talk**.
- New goals ask one question per screen (3 steps). Editing still shows the full form.
- Blockers: name it, call it Perceived or Real, and track it Named → Tested → Cleared. Perceived asks "What's the smallest test that would prove it wrong?" and Real asks "What's one way around it?" Check-ins can add the blocker in one tap. The brother adds his read and a note, and the owner can go with it. Migration 0005.
- AI help (Supabase function `ai-assist`): **Help Me Start** suggests 4 first steps, and **Ideas for this** gives 3 moves for a blocker. **Live** on Groq's free tier with `openai/gpt-oss-120b` (answers in about a second). If Groq retires it, the function falls back to `openai/gpt-oss-20b`, then `qwen/qwen3.8-27b`. `llama-3.1-8b-instant` is no longer offered. Override with a `GROQ_MODEL` secret.
- The key is the Supabase secret **`Groq API Key`** (the function also accepts `GROQ_API_KEY`). It never reaches the browser.
- Caps: 20 a day signed in, 5 a day per IP signed out (migration 0006). A failed model call gives the use back (migration 0007). Crisis words skip the AI and show 988/911. Without a key, offline, or past the cap, the app shows a copyable prompt for any AI.
- The prompt asks the model to work out what the man is really after before suggesting steps. Without that, "home for dinner" got grocery lists.
- Before launch: check Groq's data terms for the free tier (personal goals go through it). Delete the retired `ai-diag` function from the dashboard (it only answers 410 now).

## Step 4: Brotherhood

- `/brotherhood` (Brothers tab, LMTLSS mode only). Signed-in men with LMTLSS mode on can read and post. Posts are a Win, Step of Faith, Milestone or Finished, each with an optional headline and the text he writes. Before sharing he sees a preview, labeled as everything brothers will see. A post never links to a goal; from a goal, **Share a Win** carries over only an editable headline, through tab storage, never the URL.
- Reactions: Amen, Proud of you, Keep going. Comments. Authors can edit or remove their own posts and comments. Posts show the name he chose, never part of his email, and he has to set a name first. Max 10 posts a day.
- Report on any post or comment. Three reports from different men hide it until review. `/brotherhood/reports` is for moderators: **Hide** or **Keep**.
- **To make Larry admin:** after he signs in, run `update public.members set community_role = 'admin' where id = (select id from auth.users where email = '<his email>');` in the SQL editor, or ask Claude to run it.
- Migration 0008. Members have no table access; every read and write goes through functions that check LMTLSS mode and role. Tested with 6 accounts: double posts, edit/remove by others, LMTLSS-off access, the auto-hide threshold, moderator-only queue, Keep restoring a post, and author removal.

## Step 5: Plan a New Season

- `/season`, linked from My Goals. Three tabs, so it never becomes one long scroll on a phone: **Look back · New goals · Launch**. The tab is kept in the address.
- **Look back** lists the goals that are live. Each one can be carried forward, revised, completed or archived. Revise keeps the same goal, so check-ins, blockers, the brother and the history all stay, and the change is logged as a revision. Complete and Archive leave the card in place with an Undo.
- **New goals** is the bulk entry. Each row is a commitment, a first step, a date (Today / Tomorrow / In a week, or any date), an area of life, and Rooms in LMTLSS mode. Rows fold into a one-line summary that says Ready, or what's missing. A row that repeats another row or a live goal gets a heads-up, not a block. **Save drafts** writes the rows to My Goals as drafts, which sync to the account.
- **Launch** sets check-ins for the new goals (default weekly) and an optional season end date, used as the finish date for any goal without one. Only ready rows can be picked. **Make N goals live** activates them one at a time through `saveGoal`.
- No duplicate goals on retry: each row's id is made when the row is added and becomes the goal id, so saving or activating again updates the same goal. Rows that are already live drop out of the workspace, even if an older copy of it is reloaded. A row that fails stays on the list with the reason.
- Nothing is shared automatically. The success screen links to each goal; invites and Brotherhood posts are still started from the goal.
- The workspace is kept on the device (`accountability_season_v1`) while he works and cleared on sign-out. Drafts saved on another device show up as rows.
- Tested at phone width on 127.0.0.1: all four Look back actions plus Undo, past-date validation, the repeat warning, Save drafts plus reload, launching two goals (check-in rhythm and season end date applied), a stale workspace replay (no second copy), drafts returning to an empty workspace, and removing a saved draft. Logic tests are in `tests/season.test.ts`.
- `saveGoal` writes locally and syncs in the background, so a sync failure shows up later as the app's usual sync error, not on the Launch tab.

## Paywall — planned, not wired

- Prices are editable in `src/lib/plans.ts`: monthly ($2.99 placeholder) and yearly ($20). The `/plans` page shows both.

- Two Stripe Prices (monthly + yearly), ids via `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `_YEARLY`. The free tier: one active goal, Quick Goal, check-ins. Paid unlocks unlimited goals, partner invites, and the Brotherhood feed (to be confirmed).
- Checkout runs through a Supabase edge function. A webhook sets `members.plan`, and RLS or the server enforces limits, not the UI.
- **Live payments wait for Larry's OK.** Build against Stripe test mode until he approves.

## Open items

- `lmtlss-website/START_HERE.md` still says "nine-room framework," but the live v8 homepage lists ten Rooms. The app uses ten. The site copy should be reconciled.
- What the free tier includes vs. the paid tier (above is a proposal).
- The production domain and hosting (Vercel, or the droplet as with other products).
- Two older local checkouts exist: `~/Documents/GitHub/aim-accountability` (7 commits behind) and `~/Developer/aim-accountability`. This copy (`Claude Cowork/accountability`) is the working one.
