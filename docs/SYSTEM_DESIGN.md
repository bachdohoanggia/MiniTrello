# MiniTrello v8 system design

```text
Google OAuth → Supabase Auth session
                         ├── authenticated RPCs
                         ├── auth.uid()-protected reads
                         └── authorized Postgres Changes
```

`AuthContext.jsx` restores the Supabase session and idempotently creates the
application profile. Routes never contain a user ID: `/` is the dashboard,
`/account` is the current account, and `/workspace/:workspaceId` opens a board.

`public.users.id` is exactly `auth.users.id`. All RPCs derive the caller from
`auth.uid()`; the browser never supplies an actor ID. Regular access requires a
`workspace_members` row. `global_role=super_admin` bypasses workspace membership
checks while the database still guarantees that every workspace has a real admin.

Changing login Gmail uses Supabase manual identity linking. The user links another
Google identity to the existing `auth.users.id`, selects it in Account Settings,
then the old Google identity is unlinked. `select_google_login_identity` verifies
the selected identity belongs to `auth.uid()` before updating the public email and
avatar. UUID, workspaces, memberships, display name and global role never move.

Board synchronization is event-driven with no interval polling. Authenticated
Postgres Changes trigger a debounced board fetch. `INSERT` and `UPDATE` listeners
are workspace-filtered; `DELETE` listeners are unfiltered because Supabase does not
support filters on delete events.
