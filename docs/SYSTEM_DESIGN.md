# MiniTrello v16 system design

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

- `App.jsx`: columns, tasks, labels, task-label links and task-assignee links for
  the open board. Assignee delete events use an unfiltered listener so unassign
  and member-removal changes are not missed.
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

Account deletion crosses the browser/server trust boundary:

```text
Account Settings + typed Gmail
  → authenticated delete-account Edge Function
  → verify bearer-token user
  → service-role Auth Admin deleteUser(token user ID)
  → auth.users cascade
  → prepare_user_account_deletion trigger
  → preserve shared workspaces or reject unsafe deletion
  → snapshot departure events and current admin recipients
  → clear the local browser session
```

The browser never receives a service-role key and cannot choose a different
target UUID. One-person workspaces are deleted. Shared workspaces remain when
another admin exists, with `created_by` reassigned if needed. Final shared admins
and global Super Admin accounts are blocked. When deletion removes a real
membership from a preserved shared workspace, the same transaction stores an
`account_deleted` departure event before the profile disappears. Remaining
admins receive it through the existing Realtime channel and can dismiss their
own copy independently.

Task assignment is a many-to-many relation, not an authorization boundary.
`get_workspace_board()` returns `taskAssignees`, while
`get_workspace_context()` supplies each real member's name, Gmail and avatar.
Add Task sends selected assignees on create. Task Detail keeps
`draftAssigneeIds` in local React state and writes them only with **Save
Changes**, atomically with task fields and label links. Cancelling or closing the
modal discards that draft, and every workspace member continues to see the task.

Workspace self-leaving is also an authenticated database transaction:

```text
Member leave
  → record departure snapshot
  → delete own membership
  → task assignments cascade; workspace data remains

Admin leave
  → lock workspace
  → reuse another existing admin, or validate and promote a selected member
  → transfer created_by when applicable
  → record departure snapshot
  → delete own membership
```

`RootApp.jsx` subscribes to `workspace_member_departures`. When an event is
created, `leave_workspace` also snapshots the current admin/Super Admin
recipients in `workspace_departure_reads` with `read_at = null`. The context RPC
returns only the actor's unread recipient rows, the board shows a notice, and
Workspace Settings lets each admin dismiss their own copy without clearing
another admin's notification. Later promotions and re-invitations never inherit
old departure events.
