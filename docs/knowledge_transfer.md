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
