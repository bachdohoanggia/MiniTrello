# System Design

## Overview

TaskFlow Board is a React + Supabase Kanban app. It is deployed as a static React site and uses Supabase as the cloud database/API layer.

```text
Browser
  ↓
React + Vite app
  ↓
Supabase JavaScript client
  ↓
Supabase Postgres database
```

## Main components

- `App.jsx`: app state, Supabase loading, realtime listeners, handlers
- `Board.jsx`: horizontal board layout
- `Column.jsx`: column UI, column drag/drop, task drop area
- `TaskCard.jsx`: small card preview and task drag source
- `TaskDetailModal.jsx`: full task detail view, description, labels, save/delete
- `TrashDrawer.jsx`: Trash UI, restore, empty Trash
- `boardService.js`: all Supabase queries

## Core flows

### Move a task

1. User drags a task card.
2. Browser stores drag data with the task ID.
3. User drops it on a column.
4. React calls `moveTask(taskId, columnId)`.
5. Supabase updates `tasks.column_id`.
6. Realtime reloads the board on all open devices.

### Move a column

1. User drags the column handle.
2. User drops on another column.
3. React reorders the columns array.
4. Supabase updates `columns.position`.
5. Realtime reloads the board.

### Delete a task

1. User clicks Move to Trash in the task detail modal.
2. React updates the task with `deleted_at`.
3. Active board hides tasks with `deleted_at`.
4. Trash drawer shows tasks with `deleted_at`.

### Delete a column

1. User deletes a column.
2. All active tasks in that column are moved to Trash.
3. The column is removed.
4. Trash can restore those tasks into any remaining column.
