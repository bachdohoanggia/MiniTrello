-- TaskFlow Board Supabase schema v5
-- Run this entire file in Supabase SQL Editor.
-- This file resets the demo tables, so it will delete existing TaskFlow data.

-- Reset old demo tables.
drop table if exists public.task_labels cascade;
drop table if exists public.tasks cascade;
drop table if exists public.labels cascade;
drop table if exists public.columns cascade;

-- Columns are dynamic Kanban columns such as To Do, Review, Reminder, Done.
create table public.columns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position bigint not null default 0,
  created_at timestamptz default now()
);

-- Labels work like lightweight email labels/tags.
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#64748b',
  created_at timestamptz default now()
);

-- Tasks belong to one column while active. When trashed, column_id can become null.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references public.columns(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high') or priority is null),
  due_date date,
  position bigint not null default 0,
  deleted_at timestamptz,
  trashed_from_column_id uuid,
  trashed_from_column_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Many-to-many link between tasks and labels.
create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, label_id)
);

-- Keep updated_at fresh when a task changes.
create or replace function public.set_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_task_updated_at
before update on public.tasks
for each row
execute function public.set_task_updated_at();

-- Helper function for optional scheduled cleanup.
create or replace function public.empty_taskflow_trash_older_than_30_days()
returns void
language sql
as $$
  delete from public.tasks
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
$$;

-- Default starter columns.
insert into public.columns (name, position)
values
  ('To Do', 1),
  ('In Progress', 2),
  ('Done', 3);

-- Default starter labels.
insert into public.labels (name, color)
values
  ('School', '#2563eb'),
  ('Work', '#7c3aed'),
  ('Urgent', '#e11d48'),
  ('Personal', '#16a34a');

-- Row Level Security for public demo board.
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

create policy "Anyone can view columns"
on public.columns
for select
to anon
using (true);

create policy "Anyone can add columns"
on public.columns
for insert
to anon
with check (true);

create policy "Anyone can update columns"
on public.columns
for update
to anon
using (true)
with check (true);

create policy "Anyone can delete columns"
on public.columns
for delete
to anon
using (true);

create policy "Anyone can view tasks"
on public.tasks
for select
to anon
using (true);

create policy "Anyone can add tasks"
on public.tasks
for insert
to anon
with check (true);

create policy "Anyone can update tasks"
on public.tasks
for update
to anon
using (true)
with check (true);

create policy "Anyone can delete tasks"
on public.tasks
for delete
to anon
using (true);

create policy "Anyone can view labels"
on public.labels
for select
to anon
using (true);

create policy "Anyone can add labels"
on public.labels
for insert
to anon
with check (true);

create policy "Anyone can update labels"
on public.labels
for update
to anon
using (true)
with check (true);

create policy "Anyone can delete labels"
on public.labels
for delete
to anon
using (true);

create policy "Anyone can view task labels"
on public.task_labels
for select
to anon
using (true);

create policy "Anyone can add task labels"
on public.task_labels
for insert
to anon
with check (true);

create policy "Anyone can delete task labels"
on public.task_labels
for delete
to anon
using (true);

-- Enable realtime updates for all board tables.
do $$
begin
  alter publication supabase_realtime add table public.columns;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.labels;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.task_labels;
exception
  when duplicate_object then null;
end $$;

-- Optional true scheduled cleanup with Supabase Cron / pg_cron:
-- 1. Enable Cron in Supabase if your project has it available.
-- 2. Then run something like this manually:
-- select cron.schedule(
--   'empty-taskflow-trash-30d',
--   '0 3 * * *',
--   $$select public.empty_taskflow_trash_older_than_30_days();$$
-- );
--
-- The app also performs a simple free cleanup when somebody opens the board.
