# Albion Regear

Guild quartermaster dashboard for Albion Online. This first pass is a responsive React/Vite prototype with mock data and working admin interactions.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Import the repository into Vercel. Vercel will detect Vite automatically; the build command is `npm run build` and the output directory is `dist`.

When Supabase is ready, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables. The starter schema is in [`supabase/schema.sql`](supabase/schema.sql).

## Current prototype behavior

- Admin dashboard with attention queue, plans, activity, and armory health.
- Regear plan list with upcoming/in-progress/complete states.
- Member roster with search, add member, and mark-ready interactions.
- Role classification and filtering for Tank, Support, Healer, DPS, Bomb, and Caller.
- Plan budgets, issuing-admin history, and role-based kit template scaffolding.
- Armory inventory with chest location and stock health.
- Read-only member board showing the next CTA, assigned chest, and kit slots without member accounts.
- Closed admin access: the first admin is bootstrapped by Gmail, then existing admins invite additional Gmail addresses.
- Settings screen and responsive layout for smaller screens.
- Mock state is intentionally in-memory until Supabase is connected.

## Suggested next backend steps

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Add Supabase Auth for admin accounts only.
3. Replace the mock arrays in `src/main.jsx` with queries/mutations through a small data service.
4. Add a public member view keyed by a one-time invite code, with no write permissions.

The safest member flow is one public guild link with a private, expiring member invite code for personal kit details. Admins use Supabase Auth with the bootstrap Gmail address and invitation-only admin access; there is no public admin self-registration.
