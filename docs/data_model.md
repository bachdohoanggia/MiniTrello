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
