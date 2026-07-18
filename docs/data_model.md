# Data Model

TaskFlow Board uses Supabase Postgres.

## Tables

### `columns`

Stores Kanban columns.

| Column | Purpose |
|---|---|
| `id` | Unique column ID |
| `name` | Column name, such as To Do or Review |
| `position` | Column order on the board |
| `created_at` | Creation timestamp |

### `tasks`

Stores cards/tasks.

| Column | Purpose |
|---|---|
| `id` | Unique task ID |
| `column_id` | Current column while active |
| `title` | Task name |
| `description` | Detailed description shown in the modal |
| `priority` | Optional low, medium, or high priority |
| `due_date` | Optional due date |
| `position` | Task order/move timestamp |
| `deleted_at` | If set, the task is in Trash |
| `trashed_from_column_id` | Original column ID before Trash |
| `trashed_from_column_name` | Original column name before Trash |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

### `labels`

Stores reusable labels like email labels.

| Column | Purpose |
|---|---|
| `id` | Unique label ID |
| `name` | Label name |
| `color` | Label color |
| `created_at` | Creation timestamp |

### `task_labels`

Many-to-many join table between tasks and labels.

| Column | Purpose |
|---|---|
| `task_id` | Task ID |
| `label_id` | Label ID |
| `created_at` | Assignment timestamp |

## Relationships

```text
columns 1 ─── many tasks

tasks many ─── many labels
```

## Trash design

Trash is implemented as a soft delete. A task is in Trash when `deleted_at` is not null.

When a task is deleted, it is not removed from the database. The app sets `deleted_at` and remembers the original column.

When a column is deleted, tasks in that column are moved to Trash first, then the column is deleted.
