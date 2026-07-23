# MiniTrello v8 system design

```text
Google OAuth → Supabase Auth session
                         ├── authenticated RPCs
                         ├── auth.uid()-protected reads
                         └── authorized Postgres Changes → Realtime WebSocket
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
the selected Supabase `identity_id` belongs to `auth.uid()` before updating the
public email and avatar. UUID, workspaces, memberships, display name and global
role never move. A Gmail already owned by a different Supabase user is rejected;
active accounts are never merged.

Board synchronization is event-driven with no interval polling. Authenticated
Postgres Changes trigger a debounced board fetch. `INSERT` and `UPDATE` listeners
are workspace-filtered; `DELETE` listeners are unfiltered because Supabase does not
support filters on delete events.

```text
Board mutation
  → workspace_board_command RPC
  → PostgreSQL row change
  → supabase_realtime publication
  → postgres_changes WebSocket event
  → 120 ms debounced get_workspace_board fetch
  → React state update
```

Realtime responsibilities are split into three channels:

- `App.jsx`: columns, tasks, labels and task-label links for the open board.
- `RootApp.jsx`: workspace metadata, members and public user context.
- `UserDashboard.jsx`: visible workspaces, memberships and profile role changes.

Supabase can emit `SIGNED_IN` or `TOKEN_REFRESHED` when a tab regains focus. The
auth layer compares the stable Supabase UUID and updates the token silently for the
same user. Workspace loading and context subscriptions use primitive UUID/route
dependencies, so equivalent session objects do not clear the board or recreate
channels. This optimization does not disable or bypass Realtime.

The login page is intentionally neutral for both first-time and returning users.
The same **Continue with Google** action either restores an existing Supabase user
or creates `auth.users` and `public.users` rows on first sign-in.
