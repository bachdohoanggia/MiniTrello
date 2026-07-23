# MiniTrello v8 knowledge transfer

MiniTrello uses Supabase Google Auth, Postgres, RPCs, RLS and Realtime. Run the
destructive `supabase/schema.sql` once for a fresh v8 database, enable the Google
provider and manual identity linking in Supabase, and configure only the two
variables in `.env.example` locally and in Vercel.

Key files:

- `src/AuthContext.jsx`: Supabase OAuth/session/profile bootstrap and identity APIs.
- `src/RootApp.jsx`: authenticated routing.
- `src/services/`: authenticated RPC calls without actor IDs.
- `supabase/schema.sql`: v8 profile trigger, authorization, RPCs, RLS and Realtime.
- `docs/AUTH_SUPER_ADMIN.md`: setup, Firebase shutdown and promotion instructions.

A Gmail must sign in once before an admin can add it by email. Promote the first
Super Admin only with privileged SQL. Never expose the Supabase service-role key in
frontend or Vercel `VITE_*` variables.

Changing login Gmail uses Supabase manual Google identity linking. The linked
identity stays attached to the same `auth.users.id`, so no transfer code, profile
merge or foreign-key migration is required.

Use `identity.identity_id` when calling `select_google_login_identity`; the SDK's
provider-facing `identity.id` is not the database identity UUID on every Supabase
version. The SQL comparison intentionally uses `auth.identities.id::text`.

Realtime comes from PostgreSQL tables published through `supabase_realtime`, not
from React itself. Board, workspace-context and dashboard channels listen for
Postgres Changes and debounce the corresponding RPC fetch by 120 ms. There is no
interval polling.

When the browser returns to a tab, Supabase may refresh its token. Do not use whole
session/user/route objects as workspace loader dependencies. `AuthContext` treats
the same UUID as a silent session update, while `RootApp` depends on primitive
user/profile/workspace IDs. Full loading should occur only on initial workspace
entry, workspace switch or account switch.

For Vercel, configure the exact production Site URL and both local/production
Redirect URLs in Supabase. Add the production origin to Google OAuth, keep the
Supabase callback URI unchanged, and add only `VITE_SUPABASE_URL` plus
`VITE_SUPABASE_ANON_KEY` to Vercel. Environment changes require a new deployment.
