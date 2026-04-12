# Accountability v1 (Next.js)

A local-first accountability dashboard built with Next.js + TypeScript + Tailwind CSS (App Router).

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - build app
- `npm run start` - run production server
- `npm run lint` - run Next.js ESLint checks
- `npm run typecheck` - run TypeScript no-emit type check

## Features

- Dashboard listing active goals
- Create Goal flow
  - Title required
  - Description optional
  - Structures:
    - 7-Day Sprint (auto-generates 7 daily tasks)
    - 30-Day Goal (choose 4 or 6 milestones auto-generated across 30 days)
    - Custom
- Goal detail view
  - Status editing: On Track / At Risk / Off Track
  - Task CRUD
  - Milestone CRUD
  - Update feed with status + note + timestamp
- Archive goals and view archived goals
- Persistence via `localStorage` (data survives refresh)

## Notes

- This app intentionally uses no database and no authentication.
- Local storage access is wrapped to avoid SSR access issues.
