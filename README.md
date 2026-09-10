# Albion Regear

Guild quartermaster dashboard for Albion Online. This is a responsive React/Vite admin workspace for tracking member deaths and guild regears.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Import the repository into Vercel. Vercel will detect Vite automatically; the build command is `npm run build` and the output directory is `dist`.

When Supabase is ready, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables. The starter schema is in [`supabase/schema.sql`](supabase/schema.sql).

For the CTA composition sheets feature, run [`supabase/cta_composition_sheets.sql`](supabase/cta_composition_sheets.sql) after `schema.sql` and `policies.sql`. Public CTA share links use the server-side [`api/cta-sheet.js`](api/cta-sheet.js) endpoint, so Vercel also needs a private `SUPABASE_SERVICE_ROLE_KEY` environment variable. Never expose that key as a `VITE_` variable. `PUBLIC_APP_URL` and `VITE_PUBLIC_APP_URL` may be set to the public app domain when using a custom domain; they default to `https://albion-regear.vercel.app`.

## Current prototype behavior

- Admin dashboard with attention queue, plans, activity, and armory health.
- Daily regear workflow grouped by UTC date, then CTA/event tabs.
- Death-to-regear workflow: report a casualty, add multiple replacement item lines with quantities, then mark the request regeared.
- Global search for member IGNs, CTA/event names, and armory items. Member results open paginated, calendar-based regear history.
- Regear records can be edited after completion and audited by administrator name; admins can delete an entire daily date or CTA/event when needed.
- Member roster with search, add member, and mark-ready interactions.
- Role classification and filtering for Tank, Support, Healer, DPS, Bomb, and Caller.
- Plan budgets, issuing-admin history, and role-based kit template scaffolding.
- Armory inventory with stock health.
- Free-text chest locations that admins can update inline.
- Supabase-backed item catalog shape with autocomplete-ready names and admin add-item flow.
- Member default issue chests are reused automatically when creating a death request, while the CTA role can be overridden per request.
- Read-only member board showing assigned chest and regear history without member accounts.
- Closed admin access: the first admin is bootstrapped by Gmail, then existing admins invite additional Gmail addresses.
- Settings screen and responsive layout for smaller screens.
- CTA composition sheets with admin-managed parties, exact role slots, gear requirements, lock state, attendance, audit history, and secure public signup links for registered members.
- Supabase is used for the live workspace; local mock state remains available when environment variables are absent.

## Suggested next backend steps

1. Run `supabase/schema.sql` in the Supabase SQL editor and set your private bootstrap Gmail on the guild row.
2. Run `supabase/policies.sql` to allow linked administrators to access the private workspace through the browser client.
3. Add the first Gmail admin in Supabase Auth, then link that Auth user in `public.guild_admins`.
4. The app now loads members, items, and regear requests through Supabase and saves member chests, catalog items, and death reports.
5. For an existing project, run [`supabase/daily_regear_upgrade.sql`](supabase/daily_regear_upgrade.sql) after `policies.sql`. This adds CTA/event tabs, flexible item quantities, and migrates old one-item-per-slot records. Then run [`supabase/regear_event_time_upgrade.sql`](supabase/regear_event_time_upgrade.sql) to add UTC event times, followed by [`supabase/admin_notifications.sql`](supabase/admin_notifications.sql) to audit admin activity, including CTA changes and whole-date deletion.
6. The public member view reads the same flexible item lines and has no write permissions.
7. CTA sheets are managed from the `CTA Sheets` admin section. An admin creates a sheet, adds parties and exact role slots, then generates a secure `/cta/<token>` share link. Members can use that link without an account, choose only their registered IGN, claim one empty slot, and use the one-time private edit code to move or release their own signup while the sheet is open.

For local admin testing, use `npm run dev`. Vite serves the admin SPA, but it does not run Vercel API functions; testing the public CTA share-link flow locally requires `vercel dev` with `SUPABASE_SERVICE_ROLE_KEY` configured. The CTA composition feature is deployed from `main` to the production Vercel project.

The safest member flow is one public guild link with a private, expiring member invite code for personal kit details. Admins use Supabase Auth with the bootstrap Gmail address and invitation-only admin access; there is no public admin self-registration.
