-- MiniTrello multi-workspace schema v8 (Supabase Google Auth + global Super Admin)
-- WARNING: running this file deletes all existing MiniTrello data.
-- Enable the Google provider in Supabase Authentication before signing in.

create extension if not exists pgcrypto;

drop table if exists public.account_login_transfers cascade;
drop table if exists public.task_labels cascade;
drop table if exists public.tasks cascade;
drop table if exists public.labels cascade;
drop table if exists public.columns cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.roles cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.users cascade;

drop function if exists public.is_valid_firebase_jwt() cascade;
drop function if exists public.current_firebase_uid() cascade;
drop function if exists public.begin_login_email_change(text) cascade;
drop function if exists public.claim_login_email_change(text) cascade;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  avatar_url text,
  global_role text not null default 'user' check (global_role in ('user', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  key text primary key check (key in ('admin', 'member')),
  name text not null unique
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role_key text not null references public.roles(key),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  color text not null default '#64748b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  column_id uuid references public.columns(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  priority text check (priority in ('low', 'medium', 'high') or priority is null),
  due_date date,
  position bigint not null default 0,
  deleted_at timestamptz,
  trashed_from_column_id uuid,
  trashed_from_column_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, label_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create unique index users_email_lower_idx on public.users(lower(email));
create index columns_workspace_position_idx on public.columns(workspace_id, position);
create index tasks_workspace_column_position_idx on public.tasks(workspace_id, column_id, position);
create index labels_workspace_name_idx on public.labels(workspace_id, name);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch_updated_at before update on public.users
for each row execute function public.touch_updated_at();
create trigger workspaces_touch_updated_at before update on public.workspaces
for each row execute function public.touch_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks
for each row execute function public.touch_updated_at();

-- Database invariant: a workspace can never lose its final admin.
create or replace function public.protect_last_workspace_admin()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE'
    and current_setting('minitrello.deleting_workspace', true) = old.workspace_id::text then
    return old;
  end if;
  if old.role_key = 'admin' and tg_op = 'UPDATE' and new.role_key <> 'admin' and not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id
        and role_key = 'admin'
        and user_id <> old.user_id
    ) then
    raise exception 'A workspace must keep at least one admin';
  end if;
  if old.role_key = 'admin' and tg_op = 'DELETE' and not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id
        and role_key = 'admin'
        and user_id <> old.user_id
    ) then
    raise exception 'A workspace must keep at least one admin';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger protect_last_workspace_admin_trigger
before update of role_key or delete on public.workspace_members
for each row execute function public.protect_last_workspace_admin();

create or replace function public.validate_task_workspace()
returns trigger language plpgsql as $$
begin
  if new.column_id is not null and not exists (
    select 1 from public.columns c
    where c.id = new.column_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'Task and column must belong to the same workspace';
  end if;
  return new;
end;
$$;

create trigger validate_task_workspace_trigger
before insert or update of workspace_id, column_id on public.tasks
for each row execute function public.validate_task_workspace();

create or replace function public.validate_task_label_workspace()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.tasks t
    join public.labels l on l.workspace_id = t.workspace_id
    where t.id = new.task_id and l.id = new.label_id
  ) then
    raise exception 'Task and label must belong to the same workspace';
  end if;
  return new;
end;
$$;

create trigger validate_task_label_workspace_trigger
before insert or update on public.task_labels
for each row execute function public.validate_task_label_workspace();

create or replace function public.generate_workspace_code()
returns text language plpgsql as $$
declare candidate text;
begin
  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.workspaces where join_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.current_app_user()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare result uuid;
begin
  result := auth.uid();
  if result is null then raise exception 'Authentication required'; end if;
  perform 1 from public.users where id = result;
  if not found then raise exception 'User profile not found'; end if;
  return result;
end;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and global_role = 'super_admin');
$$;

create or replace function public.can_access_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists(
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = public.current_app_user()
  );
$$;

create or replace function public.assert_workspace_member_or_super_admin(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() and not exists (
    select 1 from public.workspace_members where user_id = public.current_app_user() and workspace_id = p_workspace_id
  ) then raise exception 'You do not have access to this workspace'; end if;
end;
$$;

create or replace function public.assert_workspace_admin_or_super_admin(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_workspace_member_or_super_admin(p_workspace_id);
  if not public.is_super_admin() and not exists (
    select 1 from public.workspace_members where user_id = public.current_app_user() and workspace_id = p_workspace_id and role_key = 'admin'
  ) then raise exception 'Admin permission required'; end if;
end;
$$;

create or replace function public.ensure_current_user()
returns public.users language plpgsql security definer set search_path = public as $$
declare claims jsonb := auth.jwt(); result public.users; uid uuid := auth.uid(); user_email text; user_name text; picture text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  user_email := lower(nullif(trim(claims->>'email'), ''));
  user_name := coalesce(nullif(trim(claims->'user_metadata'->>'full_name'), ''), nullif(trim(claims->'user_metadata'->>'name'), ''), split_part(user_email, '@', 1));
  picture := coalesce(nullif(claims->'user_metadata'->>'avatar_url', ''), nullif(claims->'user_metadata'->>'picture', ''));
  if user_email is null then raise exception 'A verified Google email is required'; end if;
  insert into public.users(id, email, display_name, avatar_url)
  values (uid, user_email, left(user_name, 80), picture)
  on conflict (id) do update set avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url)
  returning * into result;
  return result;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users(id, email, display_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)), 80),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_url', ''), nullif(new.raw_user_meta_data->>'picture', ''))
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_minitrello_profile on auth.users;
create trigger create_minitrello_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.select_google_login_identity(p_identity_id text)
returns public.users language plpgsql security definer set search_path = public, auth as $$
declare selected_identity auth.identities; updated_user public.users; selected_email text; selected_avatar text;
begin
  select * into selected_identity from auth.identities
  where id::text = p_identity_id and user_id = auth.uid() and provider = 'google';
  if selected_identity.id is null then raise exception 'That Google identity is not linked to your account'; end if;
  selected_email := lower(nullif(trim(selected_identity.identity_data->>'email'), ''));
  selected_avatar := coalesce(nullif(selected_identity.identity_data->>'avatar_url', ''), nullif(selected_identity.identity_data->>'picture', ''));
  if selected_email is null then raise exception 'The selected Google identity has no verified email'; end if;
  if exists(select 1 from public.users where lower(email) = selected_email and id <> auth.uid()) then
    raise exception 'That Gmail is already used by another MiniTrello account';
  end if;
  update public.users set email = selected_email, avatar_url = coalesce(selected_avatar, avatar_url)
  where id = auth.uid() returning * into updated_user;
  return updated_user;
end;
$$;

create or replace function public.get_user_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.current_app_user(); actor_is_super boolean := public.is_super_admin(); result jsonb;
begin
  select jsonb_build_object('user', to_jsonb(u), 'workspaces', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.name) from (
      select w.id, w.name, w.join_code, w.created_by, w.created_at,
        case when actor_is_super then 'super_admin' else wm.role_key end as effective_role,
        (select count(*) from public.workspace_members m where m.workspace_id = w.id) as member_count
      from public.workspaces w left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = actor
      where actor_is_super or wm.user_id is not null
    ) x
  ), '[]'::jsonb)) into result from public.users u where u.id = actor;
  return result;
end;
$$;

create or replace function public.get_workspace_context(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.current_app_user(); actor_is_super boolean := public.is_super_admin(); result jsonb; members jsonb;
begin
  perform public.assert_workspace_member_or_super_admin(p_workspace_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id, 'email', u.email, 'display_name', u.display_name,
    'role_key', case when u.id = actor and actor_is_super then 'super_admin' else m.role_key end,
    'workspace_role_key', m.role_key,
    'global_role', u.global_role, 'joined_at', m.joined_at, 'is_virtual', false, 'is_current_user', u.id = actor
  ) order by case when m.role_key = 'admin' then 0 else 1 end, u.display_name), '[]'::jsonb)
  into members from public.workspace_members m join public.users u on u.id = m.user_id where m.workspace_id = p_workspace_id;
  if actor_is_super and not exists(select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = actor) then
    select members || jsonb_build_array(jsonb_build_object('user_id', u.id, 'email', u.email, 'display_name', u.display_name,
      'role_key', 'super_admin', 'workspace_role_key', null, 'global_role', 'super_admin', 'joined_at', null, 'is_virtual', true, 'is_current_user', true))
    into members from public.users u where u.id = actor;
  end if;
  select jsonb_build_object('workspace', to_jsonb(w), 'current_role', case when actor_is_super then 'super_admin' else wm.role_key end,
    'is_super_admin', actor_is_super, 'members', members, 'user_workspaces', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'role_key', x.effective_role) order by x.name) from (
        select uw.id, uw.name, case when actor_is_super then 'super_admin' else um.role_key end effective_role
        from public.workspaces uw left join public.workspace_members um on um.workspace_id = uw.id and um.user_id = actor
        where actor_is_super or um.user_id is not null
      ) x
    ), '[]'::jsonb)) into result from public.workspaces w
    left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = actor where w.id = p_workspace_id;
  return result;
end;
$$;

create or replace function public.get_workspace_board(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_workspace_member_or_super_admin(p_workspace_id);
  return jsonb_build_object(
    'columns', coalesce((select jsonb_agg(to_jsonb(c) order by c.position) from public.columns c where c.workspace_id = p_workspace_id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.tasks t where t.workspace_id = p_workspace_id and t.deleted_at is null), '[]'::jsonb),
    'trashTasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.deleted_at desc) from public.tasks t where t.workspace_id = p_workspace_id and t.deleted_at is not null), '[]'::jsonb),
    'labels', coalesce((select jsonb_agg(to_jsonb(l) order by l.name) from public.labels l where l.workspace_id = p_workspace_id), '[]'::jsonb),
    'taskLabels', coalesce((
      select jsonb_agg(to_jsonb(tl)) from public.task_labels tl
      join public.tasks t on t.id = tl.task_id where t.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_workspace(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := public.current_app_user(); new_workspace public.workspaces;
begin
  if length(trim(p_name)) = 0 then raise exception 'Workspace name is required'; end if;
  if length(trim(p_name)) > 100 then raise exception 'Workspace name must be 100 characters or fewer'; end if;
  insert into public.workspaces(name, join_code, created_by)
  values (trim(p_name), public.generate_workspace_code(), actor) returning * into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role_key)
  values (new_workspace.id, actor, 'admin');
  insert into public.columns(workspace_id, name, position) values
    (new_workspace.id, 'To Do', 1), (new_workspace.id, 'In Progress', 2), (new_workspace.id, 'Done', 3);
  insert into public.labels(workspace_id, name, color) values
    (new_workspace.id, 'School', '#2563eb'), (new_workspace.id, 'Work', '#7c3aed'),
    (new_workspace.id, 'Urgent', '#e11d48'), (new_workspace.id, 'Personal', '#16a34a');
  return to_jsonb(new_workspace);
end;
$$;

create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare updated_workspace public.workspaces;
begin
  perform public.assert_workspace_admin_or_super_admin(p_workspace_id);
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Workspace name is required'; end if;
  if length(trim(p_name)) > 100 then raise exception 'Workspace name must be 100 characters or fewer'; end if;

  update public.workspaces
  set name = trim(p_name)
  where id = p_workspace_id
  returning * into updated_workspace;

  if updated_workspace.id is null then raise exception 'Workspace not found'; end if;
  return to_jsonb(updated_workspace);
end;
$$;

create or replace function public.join_workspace(p_join_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare actor uuid := public.current_app_user(); target_id uuid;
begin
  select id into target_id from public.workspaces where join_code = upper(trim(p_join_code));
  if target_id is null then raise exception 'Workspace code not found'; end if;
  insert into public.workspace_members(workspace_id, user_id, role_key)
  values (target_id, actor, 'member') on conflict (workspace_id, user_id) do nothing;
  return target_id;
end;
$$;

create or replace function public.add_workspace_member(p_workspace_id uuid, p_target_email text, p_role text default 'member')
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  perform public.assert_workspace_admin_or_super_admin(p_workspace_id);
  if p_role not in ('admin', 'member') then raise exception 'Invalid workspace role'; end if;
  select id into target from public.users where lower(email) = lower(trim(p_target_email));
  if target is null then raise exception 'This Gmail has not signed in yet'; end if;
  if exists(select 1 from public.users where id = target and global_role = 'super_admin') then
    raise exception 'Super Admin does not need workspace membership';
  end if;
  insert into public.workspace_members(workspace_id, user_id, role_key)
  values (p_workspace_id, target, p_role)
  on conflict (workspace_id, user_id) do nothing;
end;
$$;

create or replace function public.change_workspace_member_role(p_workspace_id uuid, p_target_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare current_role text;
begin
  perform public.assert_workspace_admin_or_super_admin(p_workspace_id);
  if exists(select 1 from public.users where id = p_target_user_id and global_role = 'super_admin') then raise exception 'Super Admin role cannot be changed here'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid workspace role'; end if;
  perform 1 from public.workspaces where id = p_workspace_id for update;
  select role_key into current_role from public.workspace_members where workspace_id = p_workspace_id and user_id = p_target_user_id;
  if current_role is null then raise exception 'Workspace member not found'; end if;
  if current_role = 'admin' and p_role = 'member' and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and role_key = 'admin' and user_id <> p_target_user_id
  ) then
    raise exception 'A workspace must keep at least one admin';
  end if;
  update public.workspace_members set role_key = p_role where workspace_id = p_workspace_id and user_id = p_target_user_id;
end;
$$;

create or replace function public.remove_workspace_member(p_workspace_id uuid, p_target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  perform public.assert_workspace_admin_or_super_admin(p_workspace_id);
  if public.current_app_user() = p_target_user_id then raise exception 'You cannot kick yourself'; end if;
  if exists(select 1 from public.users where id = p_target_user_id and global_role = 'super_admin') then raise exception 'Super Admin cannot be removed'; end if;
  perform 1 from public.workspaces where id = p_workspace_id for update;
  select role_key into target_role from public.workspace_members where workspace_id = p_workspace_id and user_id = p_target_user_id;
  if target_role is null then raise exception 'Workspace member not found'; end if;
  if target_role = 'admin' and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and role_key = 'admin' and user_id <> p_target_user_id
  ) then
    raise exception 'A workspace must keep at least one admin';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace_id and user_id = p_target_user_id;
end;
$$;

create or replace function public.delete_workspace(p_workspace_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_workspace_admin_or_super_admin(p_workspace_id);
  perform set_config('minitrello.deleting_workspace', p_workspace_id::text, true);
  delete from public.workspaces where id = p_workspace_id;
end;
$$;

create or replace function public.update_user_profile(p_display_name text)
returns public.users language plpgsql security definer set search_path = public as $$
declare updated_user public.users;
begin
  if length(trim(p_display_name)) = 0 then raise exception 'Display name is required'; end if;
  update public.users set display_name = trim(p_display_name) where id = public.current_app_user() returning * into updated_user;
  return updated_user;
end;
$$;

-- All board writes pass through one transactional command endpoint.
create or replace function public.workspace_board_command(p_workspace_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  target_task public.tasks;
  target_column public.columns;
  target_label public.labels;
  requested_label_ids uuid[];
  result_row jsonb;
begin
  perform public.assert_workspace_member_or_super_admin(p_workspace_id);

  case p_action
    when 'create_column' then
      insert into public.columns(workspace_id, name, position)
      values (p_workspace_id, trim(p_payload->>'name'), coalesce((p_payload->>'position')::bigint, extract(epoch from clock_timestamp()) * 1000))
      returning * into target_column;
      result_row := to_jsonb(target_column);
    when 'update_column' then
      update public.columns set name = trim(p_payload->>'name')
      where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id returning * into target_column;
      result_row := to_jsonb(target_column);
    when 'reorder_columns' then
      for item in select * from jsonb_array_elements(p_payload->'items') loop
        update public.columns set position = (item->>'position')::bigint
        where id = (item->>'id')::uuid and workspace_id = p_workspace_id;
      end loop;
    when 'delete_column' then
      select * into target_column from public.columns where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id;
      if not found then raise exception 'Column not found'; end if;
      update public.tasks set deleted_at = now(), trashed_from_column_id = target_column.id,
        trashed_from_column_name = target_column.name, updated_at = now()
      where workspace_id = p_workspace_id and column_id = target_column.id and deleted_at is null;
      delete from public.columns where id = target_column.id;
    when 'create_task' then
      insert into public.tasks(workspace_id, column_id, title, description, priority, due_date, position)
      values (p_workspace_id, (p_payload->>'column_id')::uuid, trim(p_payload->>'title'), nullif(trim(p_payload->>'description'), ''),
        nullif(p_payload->>'priority', ''), nullif(p_payload->>'due_date', '')::date,
        coalesce((p_payload->>'position')::bigint, extract(epoch from clock_timestamp()) * 1000))
      returning * into target_task;
      result_row := to_jsonb(target_task);
    when 'update_task' then
      select coalesce(array_agg(value::uuid), array[]::uuid[])
      into requested_label_ids
      from jsonb_array_elements_text(coalesce(p_payload->'label_ids', '[]'::jsonb)) selected(value);

      if exists (
        select 1
        from unnest(requested_label_ids) requested(label_id)
        left join public.labels l on l.id = requested.label_id and l.workspace_id = p_workspace_id
        where l.id is null
      ) then
        raise exception 'One or more selected labels do not belong to this workspace';
      end if;

      update public.tasks set column_id = (p_payload->>'column_id')::uuid, title = trim(p_payload->>'title'),
        description = nullif(trim(p_payload->>'description'), ''), priority = nullif(p_payload->>'priority', ''),
        due_date = nullif(p_payload->>'due_date', '')::date, updated_at = now()
      where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id returning * into target_task;

      if target_task.id is null then raise exception 'Task not found'; end if;

      delete from public.task_labels
      where task_id = target_task.id and not (label_id = any(requested_label_ids));

      insert into public.task_labels(task_id, label_id)
      select target_task.id, selected.label_id
      from unnest(requested_label_ids) selected(label_id)
      on conflict (task_id, label_id) do nothing;

      result_row := to_jsonb(target_task);
    when 'move_task' then
      update public.tasks set column_id = (p_payload->>'column_id')::uuid,
        position = extract(epoch from clock_timestamp()) * 1000, updated_at = now()
      where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id returning * into target_task;
      result_row := to_jsonb(target_task);
    when 'reorder_tasks' then
      for item in select * from jsonb_array_elements(p_payload->'items') loop
        update public.tasks set column_id = (item->>'column_id')::uuid, position = (item->>'position')::bigint, updated_at = now()
        where id = (item->>'id')::uuid and workspace_id = p_workspace_id;
      end loop;
    when 'trash_task' then
      select * into target_task from public.tasks where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id;
      if not found then raise exception 'Task not found'; end if;
      select * into target_column from public.columns where id = target_task.column_id and workspace_id = p_workspace_id;
      update public.tasks set deleted_at = now(), trashed_from_column_id = target_task.column_id,
        trashed_from_column_name = target_column.name, updated_at = now() where id = target_task.id;
    when 'restore_task' then
      update public.tasks set column_id = (p_payload->>'column_id')::uuid, deleted_at = null,
        trashed_from_column_id = null, trashed_from_column_name = null,
        position = extract(epoch from clock_timestamp()) * 1000, updated_at = now()
      where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id;
    when 'empty_trash' then
      delete from public.tasks where workspace_id = p_workspace_id and deleted_at is not null;
    when 'cleanup_trash' then
      delete from public.tasks where workspace_id = p_workspace_id and deleted_at < now() - make_interval(days => coalesce((p_payload->>'days')::integer, 30));
    when 'create_label' then
      insert into public.labels(workspace_id, name, color)
      values (p_workspace_id, trim(p_payload->>'name'), coalesce(nullif(p_payload->>'color', ''), '#64748b'))
      returning * into target_label;
      result_row := to_jsonb(target_label);
    when 'delete_label' then
      delete from public.labels where id = (p_payload->>'id')::uuid and workspace_id = p_workspace_id;
    else raise exception 'Unknown board action: %', p_action;
  end case;
  return coalesce(result_row, jsonb_build_object('ok', true));
end;
$$;

insert into public.roles(key, name) values ('admin', 'Admin'), ('member', 'Member');

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

-- Realtime needs complete old rows for reliable UPDATE/DELETE replication.
alter table public.users replica identity full;
alter table public.workspaces replica identity full;
alter table public.workspace_members replica identity full;
alter table public.columns replica identity full;
alter table public.tasks replica identity full;
alter table public.labels replica identity full;
alter table public.task_labels replica identity full;

create policy "Read own user profile" on public.users for select to authenticated
  using (id = auth.uid() or public.is_super_admin()
    or exists(select 1 from public.workspace_members mine join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid() and theirs.user_id = users.id));
create policy "Read roles" on public.roles for select to authenticated using (true);
create policy "Read accessible workspaces" on public.workspaces for select to authenticated
  using (public.can_access_workspace(id));
create policy "Read accessible memberships" on public.workspace_members for select to authenticated
  using (public.can_access_workspace(workspace_id));
create policy "Read accessible columns" on public.columns for select to authenticated
  using (public.can_access_workspace(workspace_id));
create policy "Read accessible tasks" on public.tasks for select to authenticated
  using (public.can_access_workspace(workspace_id));
create policy "Read accessible labels" on public.labels for select to authenticated
  using (public.can_access_workspace(workspace_id));
create policy "Read accessible task labels" on public.task_labels for select to authenticated
  using (public.is_super_admin() or exists(select 1 from public.tasks t join public.workspace_members wm on wm.workspace_id = t.workspace_id where t.id = task_labels.task_id and wm.user_id = auth.uid()));

revoke insert, update, delete on public.users, public.roles, public.workspaces, public.workspace_members, public.columns, public.tasks, public.labels, public.task_labels from anon, authenticated;
revoke all on public.users, public.roles, public.workspaces, public.workspace_members, public.columns, public.tasks, public.labels, public.task_labels from anon;
grant select on public.users, public.roles, public.workspaces, public.workspace_members, public.columns, public.tasks, public.labels, public.task_labels to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.ensure_current_user(), public.get_user_dashboard(),
  public.select_google_login_identity(text),
  public.get_workspace_context(uuid), public.get_workspace_board(uuid), public.create_workspace(text),
  public.rename_workspace(uuid, text), public.join_workspace(text), public.add_workspace_member(uuid, text, text),
  public.change_workspace_member_role(uuid, uuid, text), public.remove_workspace_member(uuid, uuid),
  public.delete_workspace(uuid), public.update_user_profile(text), public.workspace_board_command(uuid, text, jsonb)
  to authenticated;
grant execute on function public.current_app_user(), public.is_super_admin(), public.can_access_workspace(uuid)
  to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['users','workspaces','workspace_members','columns','tasks','labels','task_labels'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- OPTIONAL: Grant global Super Admin after this Gmail has signed in once.
-- Replace the example Gmail, remove the leading `--`, then run the UPDATE separately.
-- update public.users
-- set global_role = 'super_admin'
-- where lower(email) = lower('your-admin@gmail.com');
