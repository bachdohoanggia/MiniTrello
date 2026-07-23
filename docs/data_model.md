# MiniTrello v8 data model

Supabase Auth owns login identity. The application profile uses the same UUID.

```text
auth.users.id ──1:1── public.users.id
                          │
                          ├──< workspace_members >── workspaces
                          │                            ├── columns
                          │                            ├── tasks
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

The old `firebase_uid` and `account_login_transfers` model no longer exists.
Selecting a linked Google identity updates only `public.users.email` and avatar.
The primary UUID and every foreign key remain unchanged.

`global_role=super_admin` grants access through authorization helpers and does not
require workspace membership. Public RPCs accept no browser-supplied actor ID.

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
