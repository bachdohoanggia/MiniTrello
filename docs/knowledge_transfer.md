# Knowledge Transfer

## Project summary

TaskFlow Board is a mini Trello-style app built with React, Vite, and Supabase. It has dynamic columns, draggable tasks, draggable columns, search, labels, and Trash.

## Important files

| File | Purpose |
|---|---|
| `src/App.jsx` | Main app state and handlers |
| `src/services/boardService.js` | Supabase CRUD/query functions |
| `src/components/Board.jsx` | Renders the board |
| `src/components/Column.jsx` | Renders columns and handles drop events |
| `src/components/TaskCard.jsx` | Renders draggable task cards |
| `src/components/TaskDetailModal.jsx` | Edits task details and labels |
| `src/components/TrashDrawer.jsx` | Trash, restore, and empty Trash |
| `src/styles.css` | Main styling |
| `supabase/schema.sql` | Complete reset/setup SQL |

## How to run

```bash
npm install
npm run dev
```

## Supabase setup

Run the complete SQL file:

```text
supabase/schema.sql
```

Then add `.env.local`:

```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Known limitations

- This is a public shared board.
- There is no login yet.
- Anyone with the link can modify data.
- Drag-and-drop uses native browser drag events, so mobile behavior may be limited.

## Good next upgrades

1. Supabase Auth
2. Private boards
3. Board members
4. Comments/activity history
5. Better drag ordering for tasks inside the same column
6. Label management page
