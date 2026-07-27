# MiniTrello v16 knowledge transfer

MiniTrello uses Supabase Google Auth, Postgres, RPCs, RLS and Realtime. Run the
destructive `supabase/schema.sql` once for a fresh v16 database, enable the Google
provider and manual identity linking in Supabase, and configure only the two
variables in `.env.example` locally and in Vercel.

Key files:

- `src/AuthContext.jsx`: Supabase OAuth/session/profile bootstrap and identity APIs.
- `src/RootApp.jsx`: authenticated routing.
- `src/services/`: authenticated RPC calls without actor IDs.
- `supabase/schema.sql`: v16 profile trigger, authorization, RPCs, RLS, task
  assignees, workspace departure activity and Realtime.
- `supabase/functions/delete-account/index.ts`: authenticated server-only Auth
  account deletion.
- `docs/AUTH_SUPER_ADMIN.md`: setup, Firebase shutdown and promotion instructions.

A Gmail must sign in once before an admin can add it by email. Promote the first
Super Admin only with privileged SQL. Never expose the Supabase service-role key in
frontend or Vercel `VITE_*` variables.

Deploy `delete-account` to the same Supabase project after applying the schema.
Git/Vercel deploy only the React frontend; they do not deploy
`supabase/functions/`. For a new checkout, run `npx supabase@latest init` if
`supabase/config.toml` is missing, then:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref kzettvldsabiekawcryj
npx supabase@latest functions deploy delete-account
```

Supabase injects its URL, anon key and service-role key into the hosted function.
The function verifies the caller, compares the confirmation Gmail and deletes
only the UUID contained in that caller's token. The database trigger protects
shared workspaces, final admins and Super Admin accounts. Before a shared
membership cascades away, the trigger records an `account_deleted` departure and
freezes the current admin/Super Admin recipient list, so admins receive the same
persistent Realtime activity as a normal workspace leave. Personal workspaces
that are deleted produce no departure event. Deploy the function
again only when its server code changes; UI-only changes continue through
Git/Vercel.

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

Task assignees live in `task_assignees`. The composite foreign key to
`workspace_members` is the security invariant: only a real member of that exact
workspace can be assigned, and kicking the member cascades the assignment away.
Do not replace it with a plain `users.id` foreign key or virtual Super Admin could
be assignable without membership.

Both Add Task and Task Detail use `MemberPicker.jsx`. Add Task starts with no
assignee and resets after close/create. Task Detail initializes
`draftAssigneeIds` from board state; only Save sends them to
`workspace_board_command`. Task cards join the returned assignment links to
workspace context in React and render at most three avatars plus a `+N` badge.

Leaving and deleting a workspace are intentionally different operations.
`leave_workspace` removes only the caller's real membership. An admin supplies a
real successor only when no other real admin remains; otherwise an existing
admin keeps control. A required successor is promoted before the departing admin
row is deleted, and creator ownership is transferred when necessary.
`workspace_member_departures` keeps an
offline-safe event snapshot, while `workspace_departure_reads` snapshots the
admins who should receive that event. `read_at = null` means unread and Dismiss
sets the timestamp. Never derive recipients from the current admin list:
otherwise a user re-added and promoted later can see their own old departure.
Do not turn Leave into a client-side role update plus delete: the single RPC
transaction is what preserves the final-admin invariant.

When the browser returns to a tab, Supabase may refresh its token. Do not use whole
session/user/route objects as workspace loader dependencies. `AuthContext` treats
the same UUID as a silent session update, while `RootApp` depends on primitive
user/profile/workspace IDs. Full loading should occur only on initial workspace
entry, workspace switch or account switch.

Closing a browser tab does not sign the user out; Supabase restores its persisted
session on the next visit. `AuthContext` sets a one-use local account-chooser flag
only after explicit sign-out or successful account deletion. The next Google
OAuth request consumes it through `prompt=select_account`, so Chrome cannot
silently reuse the previous Gmail when the user is intentionally switching
accounts.

For Vercel, configure the exact production Site URL and both local/production
Redirect URLs in Supabase. Add the production origin to Google OAuth, keep the
Supabase callback URI unchanged, and add only `VITE_SUPABASE_URL` plus
`VITE_SUPABASE_ANON_KEY` to Vercel. Environment changes require a new deployment.
