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
- CTA event list with upcoming/in-progress/complete states.
- Death-to-regear workflow: report a CTA casualty, select needed pieces, then mark the request issued/regeared.
- Member roster with search, add member, and mark-ready interactions.
- Role classification and filtering for Tank, Support, Healer, DPS, Bomb, and Caller.
- Plan budgets, issuing-admin history, and role-based kit template scaffolding.
- Armory inventory with chest location and stock health.
- Free-text chest locations that admins can update inline.
- Supabase-backed item catalog shape with autocomplete-ready names and admin add-item flow.
- Member default issue chests are reused automatically when creating a death request, while the CTA role can be overridden per request.
- Read-only member board showing the next CTA, assigned chest, and kit slots without member accounts.
- Closed admin access: the first admin is bootstrapped by Gmail, then existing admins invite additional Gmail addresses.
- Settings screen and responsive layout for smaller screens.
- Mock state is intentionally in-memory until Supabase is connected.

## Suggested next backend steps

1. Run `supabase/schema.sql` in the Supabase SQL editor and set your private bootstrap Gmail on the guild row.
2. Run `supabase/policies.sql` to allow linked administrators to access the private workspace through the browser client.
3. Add the first Gmail admin in Supabase Auth, then link that Auth user in `public.guild_admins`.
4. The app now loads members, items, and regear requests through Supabase and saves member chests, catalog items, and death reports.
5. Add a public member view keyed by a one-time invite code, with no write permissions.

The safest member flow is one public guild link with a private, expiring member invite code for personal kit details. Admins use Supabase Auth with the bootstrap Gmail address and invitation-only admin access; there is no public admin self-registration.
