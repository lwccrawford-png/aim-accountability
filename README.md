# Accountability

*Built by LMTLSS.* Make the commitment, take the first step, bring a brother.

A mobile-first web app (Next.js 16 App Router, TypeScript, Tailwind 3). Step 1 of the build is done: Quick Goal, My Goals, goal detail, owner check-ins, LMTLSS mode with Origins Room tags, and import from the AIM prototype. For now, data is saved in the browser on the device (`localStorage` key `accountability_v2`). Accounts and Supabase come in step 2. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # lint + typecheck + date tests + production build
```

## What's in step 1

- **Quick Goal first screen.** A new visitor sees three questions (what, first step, when). There's no account yet. A goal needs all three to activate; anything less can be saved as a draft.
- **Make it stronger** (optional, same form): guided fields (outcome, measure, plan, why, finish date), area of life, tags, plan template, check-in rhythm.
- **Templates.** Custom starts empty. 7-Day Sprint makes seven daily tasks from the start date. 30-Day Goal makes 4 or 6 milestones, and the last one is always on day 30. You preview and edit the items before activating.
- **Home** shows My next action, My next check-in and Partner check-ins I owe, sorted with overdue first, then active goals and drafts.
- **Goal detail.** Next action (Done moves to the next open task), check-in card, health status (icon + label, not just color), quick updates, task and milestone add/edit/complete/remove, guided details, Complete with an optional note, Archive/Restore, and a timeline.
- **Check-ins.** You pick daily, weekly, every two weeks or monthly, plus a first date. Dates are calendar dates in your chosen time zone. Monthly keeps the anchor day and uses the month's last day when that day doesn't exist. An overdue check-in clears once and jumps to the next future date. An early post adds to the timeline without moving the schedule. Each form has a submission key, so a double tap counts once.
- **LMTLSS mode** (Settings toggle) adds the Steps of Faith category, the **LMTLSS Room** tag (choosing it opens the ten-Room picker), My Rooms, and a verse at check-in.
- **Prototype import.** If the old AIM keys (`accountability_goals_v1`, `accountability_goals_archive_v1`) are on the device, Home offers a preview and an opt-in import. Settings also takes a JSON file. Goals are matched by source id, so re-importing adds nothing, and the originals are never touched.

## Catalogs

`src/lib/catalog.ts` holds categories, tag labels and Rooms, each with a stable id, name, order and availability flag. Rename or reorder freely; stored goals keep only ids. The Room names were checked against the v8 homepage (`lmtlss-website/dist/index.html`) on 2026-11-15: Sonship, Leadership, Purpose, Teacher, Namer, Protector, Ruler, Image-bearer, Awareness, Cultivator.
