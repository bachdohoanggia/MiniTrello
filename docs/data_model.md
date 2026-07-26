# MiniTrello v9 data model

Supabase Auth owns login identity. The application profile uses the same UUID.

```text
auth.users.id ──1:1── public.users.id
                          │
                          ├──< workspace_members >── workspaces
                          │                            ├── columns
                          │                            ├── tasks ──< task_assignees >── workspace_members
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
| `columns`, `tasks`, `labels`, `task_labels` | Workspace-scoped foreign keys | Kanban data |
| `task_assignees` | `workspace_id`, `task_id`, `user_id`, `assigned_at` | Many-to-many assignment between tasks and real workspace members |

The old `firebase_uid` and `account_login_transfers` model no longer exists.
Selecting a linked Google identity updates only `public.users.email` and avatar.
The primary UUID and every foreign key remain unchanged.

`global_role=super_admin` grants access through authorization helpers and does not
require workspace membership. Public RPCs accept no browser-supplied actor ID.

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
