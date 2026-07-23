# TaskFlow Board

TaskFlow Board is a multi-workspace Trello-style Kanban app built with React and Supabase.

## Features

- React + Vite frontend
- Supabase Postgres database
- Dynamic columns
- Drag columns to reorder them
- Drag tasks between columns
- Touch/mobile drag support for columns and tasks
- Search tasks by title/name
- Add, edit, and delete columns
- Add, edit, and delete tasks
- Optional task priority and due date
- Mail-style labels for tasks
- Multi-label filtering: select more than one label to show tasks that have all selected labels
- Trash drawer for deleted tasks
- Restore tasks from Trash
- Empty Trash button
- App-level cleanup for Trash items older than 30 days
- Supabase Realtime updates across devices
- Google sign-in through Supabase Auth
- Workspace admin/member roles and a global Super Admin role
- Change the Google login Gmail while retaining the same MiniTrello UUID, workspaces and roles

## Important note about Trash

Deleting a task moves it to Trash instead of permanently deleting it.

Deleting a column also moves all tasks from that column to Trash before the column is removed.

Inside Trash, you can restore a task into any existing column or empty the Trash permanently.

## Supabase setup

Create a Supabase project. Then open:

```text
SQL Editor → New Query
```

Paste and run the full SQL file from:

```text
supabase/schema.sql
```

This destructive v8 schema resets existing MiniTrello data and creates the authenticated workspace model, RPCs, RLS policies, and Realtime publication.

- `columns`
- `tasks`
- `labels`
- `task_labels`
In Supabase, enable Google under **Authentication → Sign In / Providers → Supabase Auth** and configure the Google OAuth Client ID and Client Secret. Also enable manual identity linking so users can replace their login Gmail without changing their MiniTrello UUID. See `docs/AUTH_SUPER_ADMIN.md` for the complete order.

## Environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

Use the Supabase publishable/anon key. Never put a Supabase secret/service-role key in frontend variables.

## Run locally

Install dependencies once:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the Vite link, usually:

```text
http://localhost:5173
```

After the first install, future runs usually only need:

```bash
npm run dev
```

## Deploy

Deploy the React app with Vercel.

In Vercel project settings, add the same environment variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

## Auto-delete Trash after 30 days

The app already runs a cleanup query when somebody opens the board. This deletes tasks that have been in Trash for more than 30 days.

For true scheduled cleanup even when nobody opens the app, use Supabase Cron / pg_cron and schedule:

```sql
select public.empty_taskflow_trash_older_than_30_days();
```

The optional cron example is included as a comment at the bottom of `supabase/schema.sql`.


## Version notes

This version uses a compact professional workspace header. Search, Trash, and Add Column are grouped into a toolbar so the board starts closer to the top of the page.

### v7 label management update

This version supports deleting custom labels and creating labels with any custom color through a color picker. Label colors are stored as hex values in Supabase.

### v12 filtering and mobile drag update

This version lets you select multiple label filters at the same time. Label filtering uses AND logic: if you select `Work` and `Urgent`, the board shows tasks that have both labels.

It also adds pointer/touch drag support so tasks and columns can be moved on phones and tablets, not only desktop browsers.


## v13 Update: Custom Confirmation Dialogs

This version replaces browser-native `confirm()` popups with an in-app confirmation dialog. Actions such as deleting a column, moving a task to Trash, deleting a label, or emptying Trash now open a centered popup with a blurred background and clear Confirm/Cancel buttons.
