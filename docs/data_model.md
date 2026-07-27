# MiniTrello v16 data model

Supabase Auth owns login identity. The application profile uses the same UUID.

```text
auth.users.id ──1:1── public.users.id
                          │
                          ├──< workspace_members >── workspaces
                          │                            ├── columns
                          │                            ├── tasks ──< task_assignees >── workspace_members
                          │                            ├── workspace_member_departures
                          │                            └── labels
                          └── global_role
```

| Table | Important fields | Purpose |
|---|---|---|
| `auth.users` / `auth.identities` | Supabase UUID, Google identities | Login session and linked Google accounts |
| `public.users` | `id`, `email`, `display_name`, `avatar_url`, `global_role` | App profile and global authorization |
| `roles` | `key` | Workspace roles: `admin`, `member` |
| `workspaces` | `id`, `created_by`, `join_code` | Workspace identity and creator |
| `workspace_members` | `workspace_id`, `user_id`, `role_key` | Per-workspace membership |
| `workspace_member_departures` | member snapshot, old role, `departure_reason`, successor, `left_at` | Persistent leave/account-deletion activity for admins |
| `workspace_departure_reads` | `departure_id`, `user_id`, nullable `read_at` | Fixed recipient inbox and per-admin dismissal state |
| `columns`, `tasks`, `labels`, `task_labels` | Workspace-scoped foreign keys | Kanban data |
| `task_assignees` | `workspace_id`, `task_id`, `user_id`, `assigned_at` | Many-to-many assignment between tasks and real workspace members |

The old `firebase_uid` and `account_login_transfers` model no longer exists.
Selecting a linked Google identity updates only `public.users.email` and avatar.
The primary UUID and every foreign key remain unchanged.

`global_role=super_admin` grants access through authorization helpers and does not
require workspace membership. Public RPCs accept no browser-supplied actor ID.

## Account deletion integrity

`auth.users.id` owns `public.users.id` through `on delete cascade`. The
server-only `delete-account` Edge Function deletes the authenticated Auth UUID;
it never accepts a target UUID from React.

Before the public profile is removed, `prepare_user_account_deletion` enforces:

- delete workspaces where the user is the only member;
- preserve shared workspaces and reassign `workspaces.created_by` to another
  real admin;
- reject deletion when the user is the last admin and other members remain;
- reject global Super Admin deletion until a database operator demotes it.

For each preserved shared workspace in which the deleted user had a real
membership, the trigger also records an `account_deleted` departure event and
freezes its recipients to the admins and global Super Admins present at that
moment. The event snapshots the user's name, Gmail and old role before
`public.users` is removed. Personal workspaces that are deleted do not create an
event because no workspace admin remains.

After those checks, existing cascading foreign keys remove the user's
`workspace_members` and `task_assignees` rows.

## Leaving a workspace

`leave_workspace(workspace_id, successor_user_id)` is separate from workspace
deletion. Members delete only their own membership. Admins choose another
real member only when no other real admin remains. If another admin already
exists, no explicit handoff is required. PostgreSQL locks the workspace,
promotes a successor when necessary, transfers `created_by` to an existing or
new admin, records a departure event and only then removes the departing
membership. A failed step rolls back the whole operation.

Removing the membership cascades through `task_assignees`, but the workspace,
tasks, labels and columns remain. Departure events store name, Gmail and role
snapshots so the activity remains understandable if the departed profile later
changes or is deleted. Each admin acknowledges events independently through
`workspace_departure_reads`. Recipient rows are created when the departure
happens, with `read_at = null`; later promotions or re-invitations do not inherit
old events. Dismiss sets `read_at` instead of creating a new row.

## Task assignee integrity

`task_assignees` has primary key `(task_id, user_id)` so the same member cannot be
assigned twice. Its two composite foreign keys guarantee that both the task and
the assignee belong to `workspace_id`:

```sql
foreign key (workspace_id, task_id)
  references tasks(workspace_id, id) on delete cascade;

foreign key (workspace_id, user_id)
  references workspace_members(workspace_id, user_id) on delete cascade;
```

This rejects users outside the workspace and the virtual Super Admin presence,
because neither has a matching real membership row. Deleting a task or removing a
member cascades to assignments. Moving a task to Trash does not delete the task,
so its assignments remain and return when the task is restored.

`workspace_board_command` validates `assignee_ids` again before writing.
`update_task` synchronizes the task row, labels and assignees in one PostgreSQL
transaction. Any validation or write error rolls back all three parts.

## UUID identity and Gmail lookup

`public.users.id` remains the primary key because it is stable when a user changes
their login Gmail. Workspace ownership and membership always store this UUID.
Email is a mutable lookup attribute rather than a foreign-key identity.

Case-insensitive Gmail lookup is still indexed and unique:

```sql
create unique index users_email_lower_idx
on public.users(lower(email));
```

Admin member lookup uses:

```sql
select id
from public.users
where lower(email) = lower(trim(p_target_email));
```

The functional B-tree index makes this lookup `O(log n)` instead of a table scan
`O(n)`, while preventing case-only duplicates. Making email the primary key would
still use a B-tree rather than guarantee `O(1)`, would enlarge joins, and would
force relationship updates whenever the login Gmail changes.

## Realtime publication

All application tables use RLS and `REPLICA IDENTITY FULL`, then are added to the
`supabase_realtime` publication. PostgreSQL remains the source of truth; Realtime
only transports authorized row-change events to connected clients.

`task_assignees` is published too. Insert/update listeners are filtered by
workspace; delete listeners are intentionally unfiltered because Postgres Changes
does not support filters on delete events. RLS and the subsequent board RPC still
control which rows become visible in React.
