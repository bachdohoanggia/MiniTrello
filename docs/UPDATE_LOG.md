# MiniTrello - Feature and Bug Fix Log

## v12 stabilization - production auth, Realtime and session UX

- Added a neutral, responsive login experience for both new and returning users,
  including a board preview and automatic-account-creation explanation.
- Configured the desktop login view as one fixed viewport without scrolling while
  retaining safe vertical scrolling on mobile.
- Fixed Google login Gmail replacement by sending Supabase
  `UserIdentity.identity_id` and comparing `auth.identities.id::text` in the RPC;
  this resolves both `uuid = text` and false “identity not linked” failures.
- Account Settings now hides the connection button after a second Gmail is linked
  and explains the final selection step.
- Added clear identity-linking errors for selecting the current Gmail, selecting a
  Gmail owned by another MiniTrello account, and disabled manual linking.
- Made repeated Supabase `SIGNED_IN`/`TOKEN_REFRESHED` events for the same UUID
  update the session silently instead of rebuilding the public profile.
- Changed workspace loader and Realtime-channel dependencies from session objects
  to stable user/profile/workspace IDs. Returning to a tab no longer clears the
  board or shows **Loading MiniTrello**.
- Preserved full-screen loading for initial workspace entry, actual workspace
  changes and real account changes. Realtime subscriptions remain event-driven and
  no polling fallback was reintroduced.
- Added Vercel production Site URL, Redirect URL, Google origin and environment
  configuration guidance. A rejected production redirect no longer needs to fall
  back to localhost once the allow-list is configured.
- Consolidated documentation to one canonical file per topic and removed stale
  ` 2.md` duplicates.

## v12 - Supabase Google Auth migration

- Replaced Firebase Authentication and Third-Party JWTs with Supabase Google Auth.
- `public.users.id` now equals `auth.users.id`; RPCs and RLS derive identity from
  `auth.uid()` and use the native `authenticated` database role.
- Added an `auth.users` trigger and idempotent bootstrap RPC for application profiles.
- Replaced hashed Gmail transfer codes with Supabase manual Google identity linking.
- Removed Firebase environment variables, SDK package, client code, `firebase_uid`,
  transfer table, anonymous auth workaround, Broadcast workaround and interval polling.
- Restored authenticated Postgres Changes as the only cross-session board sync path.

## Realtime filtering fix

- Split filtered `INSERT`/`UPDATE` subscriptions from unfiltered `DELETE`
  subscriptions because Supabase Postgres Changes does not support filtering
  delete events.
- Added `REPLICA IDENTITY FULL`, subscription status refreshes and channel-error
  diagnostics for board, workspace context and dashboard Realtime.
- Board synchronization relies on event-driven Realtime only; no interval polling
  repeatedly downloads the complete board as task volume grows.
- The temporary Broadcast fallback was removed in v8 after authentication moved to
  native Supabase sessions.

## v12 Login Gmail transfer (replaced in v8)

- Added hashed, expiring one-time transfer codes to the unified reset schema.
- Account Settings can re-authenticate the current Google user, sign out, and let
  the target Gmail claim the retained MiniTrello UUID.
- Active target accounts, Super Admin profiles, workspace owners and members are
  rejected instead of merging data.
- Requires JWT `auth_time` within five minutes; the secret expires after ten
  minutes, allows five failures and is row-locked during claim.
- Retains `users.id`, display name, workspaces, memberships and roles while replacing
  only Firebase UID, email and avatar.

## v12 authentication and global Super Admin

- Replaced URL-selected fake users with Firebase Google Authentication.
- Added automatic Supabase profile creation from verified Firebase JWT claims.
- Removed actor IDs from public RPC signatures and enforced authenticated RLS.
- Added a database-managed global `super_admin` role with access to every workspace.
- Added Gmail-based member management, authenticated Realtime, and auth-only routes.

**Project name:** MiniTrello  
**Current stack:** React + Vite + Supabase Auth/Postgres/Realtime
**Purpose:** Document each major version, the features added, the bugs found, and the concrete implementation fixes used while building MiniTrello.

---

## v11 - Multi-user Draft Safety, Request Locking, Task Ordering, and UI Consistency

### Problems fixed

- Repeated clicks could send duplicate Supabase write requests before the first request completed.
- Realtime updates replaced task objects and column arrays, which reset open forms while another user was typing.
- Long columns could extend beyond the usable viewport instead of scrolling their own card list.
- Tasks could move between columns but could not be reordered relative to other task cards.
- The Add Task form used a white modal while Task Details used the dark workspace style.
- Renaming a column still used the native browser `prompt()` UI.

### Implementation

- Added a shared mutation lock in `App.jsx`. All Supabase mutations now wait for the active mutation to finish, while related buttons, drag controls, confirmations, Trash actions, and label actions are disabled.
- Debounced Supabase Realtime refresh events so a batch of row updates results in one board reload instead of a fetch storm.
- Changed task form initialization so drafts reset only when a form is opened or a different task is selected. Normal Realtime refreshes no longer overwrite title, description, priority, due date, column, or new-label drafts.
- Added `updateTaskPositions()` and drag/drop targets for ordering tasks within the same column or directly into a position in another column. Desktop and touch interactions use the same persisted `position` field.
- Constrained each Kanban column to the current viewport and moved vertical scrolling into `.task-list`, keeping the column header and Add Task action visible.
- Restyled the Add Task modal with the same dark palette and controls used by Task Details.
- Added `ColumnEditModal.jsx` and removed the native column rename prompt.

### Verification

- Production Vite build completes successfully.
- No application code uses `window.prompt()`, `window.alert()`, or `window.confirm()`.
- Request controls expose disabled/loading states while Supabase writes are pending.

---


## v10 - Replaced Browser Alerts with Custom Confirmation Modals

### Features added

- Replaced `alert()` and `confirm()` browser dialogs.
- Added custom in-app confirmation modal.
- Added background blur/dim overlay.
- Added clear Cancel and Confirm buttons.
- Applied custom confirmation to destructive actions:
  - Move task to Trash
  - Delete column
  - Delete label
  - Empty Trash

### Problem: Browser alerts looked unprofessional

Browser `alert()` and `confirm()` boxes did not match the app's design and felt jarring.

### Concrete fix

Created a reusable confirmation modal component.

```jsx
export default function ConfirmDialog({ open, title, message, confirmText, cancelText, danger, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <section className="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>

        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel}>{cancelText || 'Cancel'}</button>
          <button className={danger ? 'danger' : ''} onClick={onConfirm}>
            {confirmText || 'Confirm'}
          </button>
        </div>
      </section>
    </div>
  );
}
```

Then destructive actions called a reusable confirm helper instead of browser `confirm()`.

Before:

```js
if (!window.confirm('Delete this column?')) return;
await deleteColumnSafely(column.id);
```

After:

```js
const confirmed = await confirm({
  title: 'Delete column?',
  message: 'Tasks inside this column will be moved to Trash first.',
  confirmText: 'Delete Column',
  danger: true
});

if (!confirmed) return;
await deleteColumnSafely(column.id);
```

The overlay used CSS blur/dimming:

```css
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 1000;
}
```

### Result

Confirmation dialogs became consistent with the MiniTrello design and destructive actions felt safer.

---

## Current MiniTrello Feature Set

- React + Vite frontend.
- Supabase Postgres database.
- Supabase Realtime updates.
- Dynamic custom columns.
- Movable/reorderable columns.
- Draggable tasks.
- Mobile/touch drag support.
- Task detail modal.
- Optional priority.
- Due dates.
- Custom labels.
- Custom label colors.
- Delete labels.
- Search by task title.
- Multi-label filtering.
- Trash/Bin system.
- Restore from Trash.
- Empty Trash.
- App-side cleanup for Trash items older than 30 days.
- Optional Supabase Cron setup for scheduled cleanup.
- Custom confirmation modals.

---

## Important Technical Decisions

### 1. Use `column_id`, not hard-coded status

Instead of:

```sql
status text default 'todo'
```

MiniTrello uses:

```sql
column_id uuid references public.columns(id)
```

This allows unlimited custom columns.

### 2. Use `position` fields for ordering

Columns and tasks both need explicit order fields:

```sql
position integer not null default 0
```

Without this, the app cannot reliably remember the user's custom order.

### 3. Use soft delete for tasks

Instead of deleting immediately:

```sql
delete from public.tasks where id = '...';
```

MiniTrello moves tasks to Trash:

```sql
update public.tasks
set deleted_at = now()
where id = '...';
```

This makes deletion recoverable.

### 4. Keep board cards compact

Board cards should only show preview-level information:

```text
Title
Priority badge
Label chips
Due date
Description indicator
```

Full details belong in the modal.

### 5. Use custom modals for destructive actions

Custom modals keep the app professional and prevent the jarring default browser popup style.

---

## Suggested Future Improvements

- Supabase Auth login.
- Multiple boards.
- Board members and sharing permissions.
- Comments on tasks.
- Activity history.
- File attachments.
- Drag task ordering inside a column.
- Due date reminders.
- Archive columns.
- Dark mode.
- Role-based permissions.

---

## Recommended File Location

Place this file in the project as:

```text
docs/BUG_FIX_LOG.md
```

The document title and project references should use **MiniTrello**.

---


## v9 - Multi-Label Filtering and Mobile Drag Support

### Features added

- Multi-label filtering.
- Mobile/touch drag support for tasks.
- Mobile/touch drag support for columns.

### Problem: Label filter only supported one label

The app could only filter by one label at a time. The user wanted to select multiple labels such as `Work + Urgent`.

### Concrete fix

Changed state from one selected label to an array:

```js
// Before
const [selectedLabelId, setSelectedLabelId] = useState(null);

// After
const [selectedLabelIds, setSelectedLabelIds] = useState([]);
```

Added toggle logic:

```js
function toggleLabelFilter(labelId) {
  setSelectedLabelIds((current) =>
    current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId]
  );
}
```

Filtering used AND logic. A task must contain every selected label.

```js
const matchesSelectedLabels = selectedLabelIds.length === 0
  ? true
  : selectedLabelIds.every((labelId) =>
      task.labels?.some((label) => label.id === labelId)
    );
```

Final filtering combined search and labels:

```js
return matchesSearch && matchesSelectedLabels;
```

### Problem: Drag-and-drop did not work on phones

HTML5 drag events work reasonably on desktop but often fail on mobile Safari/Chrome.

### Concrete fix

Added pointer-based drag handling. Pointer events work across mouse, touch, and stylus.

Simplified pattern:

```jsx
<div
  onPointerDown={(event) => startTouchDrag(event, task)}
  onPointerMove={handleTouchDragMove}
  onPointerUp={finishTouchDrag}
>
  {task.title}
</div>
```

During pointer movement, the app tracked where the user was dragging and detected the column under the finger:

```js
const element = document.elementFromPoint(event.clientX, event.clientY);
const columnElement = element?.closest('[data-column-id]');
const targetColumnId = columnElement?.dataset.columnId;
```

On pointer release, the task or column was moved if the target was valid:

```js
if (targetColumnId && targetColumnId !== draggedTask.column_id) {
  await moveTask(draggedTask.id, targetColumnId);
}
```

### Result

Users could drag tasks and columns on both desktop and mobile.

---


## v8 - Board-Level Label Filter Bar

### Features added

- Added a label filter bar under the toolbar.
- Displayed all labels outside task cards.
- Added `All tasks` filter.
- Allowed search and label filtering to work together.

### Problem: Labels existed but could not filter the board

Labels were useful inside tasks, but there was no board-level way to quickly show only tasks with a specific label.

### Concrete fix

Added selected label state:

```js
const [selectedLabelId, setSelectedLabelId] = useState(null);
```

Rendered a filter bar:

```jsx
<button
  className={!selectedLabelId ? 'label-filter-chip is-active' : 'label-filter-chip'}
  onClick={() => setSelectedLabelId(null)}
>
  All tasks
</button>

{labels.map((label) => (
  <button
    key={label.id}
    className={selectedLabelId === label.id ? 'label-filter-chip is-active' : 'label-filter-chip'}
    onClick={() => setSelectedLabelId(label.id)}
  >
    {label.name}
  </button>
))}
```

Filtering logic combined search and label:

```js
const visibleTasks = tasks.filter((task) => {
  const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesLabel = selectedLabelId
    ? task.labels?.some((label) => label.id === selectedLabelId)
    : true;

  return matchesSearch && matchesLabel;
});
```

### Result

Users could quickly filter by labels such as `Work`, `School`, or `Urgent` without opening individual tasks.

---


## v1 - Initial React + Supabase Kanban MVP

### Features added

- Created the first React + Vite frontend.
- Connected the app to Supabase using `@supabase/supabase-js`.
- Created the first Supabase schema with two core tables:
  - `columns`
  - `tasks`
- Seeded default columns:
  - `To Do`
  - `In Progress`
  - `Done`
- Added basic task CRUD:
  - Add task
  - View task
  - Edit task
  - Delete task
- Added basic column CRUD:
  - Add column
  - Edit column name
  - Delete column
- Added a horizontal board layout so extra columns could scroll sideways.
- Added Supabase Realtime listener so different browser windows could update when the database changed.

### Core files involved

```text
src/App.jsx
src/components/Board.jsx
src/components/Column.jsx
src/components/TaskCard.jsx
src/components/TaskForm.jsx
src/services/boardService.js
src/supabaseClient.js
supabase/schema.sql
```

### Concrete implementation

The app used a Supabase client file so the rest of the React code did not need to manually initialize Supabase every time.

```js
// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

The first schema used `column_id` instead of a hard-coded `status` field. This was important because it allowed the app to support unlimited custom columns later.

```sql
create table public.columns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.columns(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium',
  due_date date,
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

The app loaded columns and tasks separately, then rendered tasks into the correct column by matching `task.column_id` to `column.id`.

```js
export async function fetchColumns() {
  return supabase
    .from('columns')
    .select('*')
    .order('position', { ascending: true });
}

export async function fetchTasks() {
  return supabase
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .order('position', { ascending: true });
}
```

### Problems found

- The UI worked but looked too much like a demo.
- Priority was always required, so every task showed a priority even when the user did not need it.
- Task cards could become visually crowded.
- Task movement initially needed a clearer UX pattern.

### Result

v1 created the foundation: React component structure, Supabase database connection, dynamic columns, task CRUD, and realtime updates.

---

## v2 - Cleaner UI, Optional Priority, and Better Task Movement

### Features / fixes added

- Improved card and column styling.
- Made task priority optional instead of required.
- Changed the default priority from `medium` to no priority.
- Hid priority badges when a task had no priority.
- Improved task movement behavior.

### Bug / issue: Priority was forced on every task

In v1, the database forced this behavior:

```sql
priority text not null default 'medium'
```

That meant every new task automatically had `medium` priority. The board became noisy because even normal tasks showed priority labels.

### Concrete fix

The schema was updated to allow `priority` to be `null`.

```sql
alter table public.tasks alter column priority drop not null;
alter table public.tasks alter column priority drop default;
```

The task form was also changed so the first option represented no priority.

```jsx
<select
  value={form.priority || ''}
  onChange={(event) => setForm({ ...form, priority: event.target.value || null })}
>
  <option value="">No priority</option>
  <option value="low">Low</option>
  <option value="medium">Medium</option>
  <option value="high">High</option>
</select>
```

Task card rendering became conditional:

```jsx
{task.priority && (
  <span className={`priority-pill priority-${task.priority}`}>
    {task.priority}
  </span>
)}
```

### Result

Task cards became cleaner because ordinary tasks no longer displayed unnecessary priority information.

---


## v4 - Trello-Style Task Detail Modal

### Features added

- Added a Trello-style task detail modal.
- Task cards no longer displayed full descriptions on the board.
- Clicking a task opened the detail modal.
- Dragging a task still moved it between columns.
- The detail modal allowed editing:
  - Title
  - Description
  - Column
  - Priority
  - Due date

### Bug / issue: Long descriptions broke the board layout

When a task had a very long description, the entire text appeared inside the card. This made the column extremely tall and difficult to scan.

### Concrete fix

The card preview was reduced to only the most important information:

```jsx
// src/components/TaskCard.jsx
<h3>{task.title}</h3>

{task.priority && <PriorityPill priority={task.priority} />}

{task.due_date && (
  <span className="task-meta-pill">Due {formatShortDate(task.due_date)}</span>
)}

{task.description && (
  <span className="task-meta-pill">Description</span>
)}
```

The full description moved into `TaskDetailModal.jsx`:

```jsx
<textarea
  value={form.description}
  onChange={(event) => setForm({ ...form, description: event.target.value })}
  placeholder="Add a more detailed description..."
/>
```

The interaction model became:

```text
Click task card        -> open task detail modal
Click and drag card    -> move task to another column
```

### Result

The board became a clean overview, while the modal handled full task details. This matched the Trello-style interaction more closely.

---

## v5 - Movable Columns, Search, Labels, and Trash System

### Features added

- Added column drag-and-drop to reorder columns.
- Added task search by title.
- Added task labels.
- Added Trash/Bin system for deleted tasks.
- Added Restore from Trash.
- Added Empty Trash.
- Added app-side cleanup for tasks in Trash for more than 30 days.
- Added optional Supabase Cron notes for true scheduled cleanup.

### Feature: Reorder columns

The `columns` table already had a `position` field. v5 used it to preserve custom column order.

```sql
position integer not null default 0
```

When columns were reordered, the app updated their positions:

```js
export async function reorderColumns(orderedColumns) {
  const updates = orderedColumns.map((column, index) =>
    supabase
      .from('columns')
      .update({ position: index + 1 })
      .eq('id', column.id)
  );

  return Promise.all(updates);
}
```

### Feature: Search by task title

Search state was added in `App.jsx`.

```js
const [searchQuery, setSearchQuery] = useState('');
```

Filtering happened before rendering:

```js
const normalizedSearch = searchQuery.trim().toLowerCase();

const visibleTasks = tasks.filter((task) => {
  if (!normalizedSearch) return true;
  return task.title.toLowerCase().includes(normalizedSearch);
});
```

### Feature: Labels

Two new tables were added:

```sql
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);
```

This allowed a many-to-many relationship:

```text
One task can have many labels.
One label can belong to many tasks.
```

### Feature: Trash / soft delete

The task table was updated with Trash-related fields:

```sql
deleted_at timestamptz,
deleted_from_column_id uuid references public.columns(id) on delete set null
```

Instead of permanently deleting a task, the app set `deleted_at`:

```js
export async function moveTaskToTrash(taskId) {
  return supabase
    .from('tasks')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);
}
```

Normal board queries ignored deleted tasks:

```js
export async function fetchActiveTasks() {
  return supabase
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .order('position', { ascending: true });
}
```

Trash queries only loaded deleted tasks:

```js
export async function fetchTrashedTasks() {
  return supabase
    .from('tasks')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
}
```

### Important fix: Deleting a column should not permanently destroy its tasks

Deleting a column originally risked deleting all tasks inside the column because of `on delete cascade`.

To avoid data loss, the app first moved tasks in that column into Trash, then deleted the column.

```js
export async function deleteColumnSafely(columnId) {
  await supabase
    .from('tasks')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_from_column_id: columnId,
      updated_at: new Date().toISOString()
    })
    .eq('column_id', columnId)
    .is('deleted_at', null);

  return supabase
    .from('columns')
    .delete()
    .eq('id', columnId);
}
```

### Feature: Empty Trash

```js
export async function emptyTrash() {
  return supabase
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null);
}
```

### Feature: Cleanup tasks older than 30 days

The app-side cleanup ran when someone opened the board:

```js
export async function cleanupOldTrash() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  return supabase
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff.toISOString());
}
```

An optional Supabase Cron version was documented:

```sql
select cron.schedule(
  'empty-minitrello-trash-30d',
  '0 3 * * *',
  $$select public.empty_minitrello_trash_older_than_30_days();$$
);
```

### Result

v5 was a major product upgrade. MiniTrello became safer and more useful because tasks could be recovered from Trash instead of being permanently deleted immediately.

---

## v6 - Label Management and Custom Label Colors

### Features added

- Added delete control for labels.
- Added color picker for custom label colors.
- Kept quick color presets for faster label creation.
- Updated label colors to store hex values.

### Bug / issue: Labels could be created but not deleted

Users could create labels but had no way to clean up unused labels.

### Concrete fix

A delete label function was added:

```js
export async function deleteLabel(labelId) {
  return supabase
    .from('labels')
    .delete()
    .eq('id', labelId);
}
```

Because `task_labels.label_id` used `on delete cascade`, deleting a label automatically removed its relationships from tasks:

```sql
label_id uuid not null references public.labels(id) on delete cascade
```

### Bug / issue: Label colors were too limited

Labels originally used only preset color names. That limited customization.

### Concrete fix

The label schema stored real hex colors:

```sql
color text not null default '#6366f1'
```

The form used a color input:

```jsx
<input
  type="color"
  value={newLabelColor}
  onChange={(event) => setNewLabelColor(event.target.value)}
/>
```

The label style helper converted the stored hex color into a readable pill style:

```js
export function getLabelStyle(color) {
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}55`,
    color
  };
}
```

### Result

Labels became manageable and customizable instead of being fixed to a small preset list.

---







