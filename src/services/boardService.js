import { supabase } from '../supabaseClient';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  }
  return supabase;
}

function throwIfError(error) {
  if (error) {
    throw error;
  }
}

export async function fetchBoard() {
  const client = requireSupabase();

  const [columnsResult, activeTasksResult, trashTasksResult, labelsResult, taskLabelsResult] = await Promise.all([
    client.from('columns').select('*').order('position', { ascending: true }),
    client.from('tasks').select('*').is('deleted_at', null).order('position', { ascending: true }),
    client.from('tasks').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    client.from('labels').select('*').order('name', { ascending: true }),
    client.from('task_labels').select('*'),
  ]);

  throwIfError(columnsResult.error);
  throwIfError(activeTasksResult.error);
  throwIfError(trashTasksResult.error);
  throwIfError(labelsResult.error);
  throwIfError(taskLabelsResult.error);

  return {
    columns: columnsResult.data ?? [],
    tasks: activeTasksResult.data ?? [],
    trashTasks: trashTasksResult.data ?? [],
    labels: labelsResult.data ?? [],
    taskLabels: taskLabelsResult.data ?? [],
  };
}

export async function deleteExpiredTrashTasks(days = 30) {
  const client = requireSupabase();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await client
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  throwIfError(error);
}

export async function createColumn(name) {
  const client = requireSupabase();

  const { error } = await client.from('columns').insert({
    name,
    position: Date.now(),
  });

  throwIfError(error);
}

export async function updateColumn(columnId, updates) {
  const client = requireSupabase();

  const { error } = await client
    .from('columns')
    .update(updates)
    .eq('id', columnId);

  throwIfError(error);
}

export async function updateColumnPositions(columns) {
  const client = requireSupabase();

  const updates = columns.map((column, index) =>
    client
      .from('columns')
      .update({ position: index + 1 })
      .eq('id', column.id)
  );

  const results = await Promise.all(updates);
  results.forEach((result) => throwIfError(result.error));
}

export async function deleteColumnAndTrashTasks(column) {
  const client = requireSupabase();
  const deletedAt = new Date().toISOString();

  const trashResult = await client
    .from('tasks')
    .update({
      deleted_at: deletedAt,
      trashed_from_column_id: column.id,
      trashed_from_column_name: column.name,
    })
    .eq('column_id', column.id)
    .is('deleted_at', null);

  throwIfError(trashResult.error);

  const deleteResult = await client
    .from('columns')
    .delete()
    .eq('id', column.id);

  throwIfError(deleteResult.error);
}

export async function createTask(task) {
  const client = requireSupabase();

  const { error } = await client.from('tasks').insert({
    column_id: task.column_id,
    title: task.title,
    description: task.description,
    priority: task.priority || null,
    due_date: task.due_date || null,
    position: Date.now(),
  });

  throwIfError(error);
}

export async function updateTask(taskId, updates) {
  const client = requireSupabase();

  const { error } = await client
    .from('tasks')
    .update({
      ...updates,
      priority: updates.priority || null,
      due_date: updates.due_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  throwIfError(error);
}

export async function moveTask(taskId, newColumnId) {
  const client = requireSupabase();

  const { error } = await client
    .from('tasks')
    .update({
      column_id: newColumnId,
      position: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  throwIfError(error);
}

export async function updateTaskPositions(tasks) {
  const client = requireSupabase();

  const updates = tasks.map((task, index) =>
    client
      .from('tasks')
      .update({
        column_id: task.column_id,
        position: index + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
  );

  const results = await Promise.all(updates);
  results.forEach((result) => throwIfError(result.error));
}

export async function trashTask(task, column) {
  const client = requireSupabase();

  const { error } = await client
    .from('tasks')
    .update({
      deleted_at: new Date().toISOString(),
      trashed_from_column_id: column?.id || task.column_id || null,
      trashed_from_column_name: column?.name || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id);

  throwIfError(error);
}

export async function restoreTask(taskId, columnId) {
  const client = requireSupabase();

  const { error } = await client
    .from('tasks')
    .update({
      column_id: columnId,
      deleted_at: null,
      trashed_from_column_id: null,
      trashed_from_column_name: null,
      position: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  throwIfError(error);
}

export async function emptyTrash() {
  const client = requireSupabase();

  const { error } = await client
    .from('tasks')
    .delete()
    .not('deleted_at', 'is', null);

  throwIfError(error);
}

export async function createLabel(label) {
  const client = requireSupabase();

  const { error } = await client.from('labels').insert({
    name: label.name,
    color: label.color || '#64748b',
  });

  throwIfError(error);
}

export async function deleteLabel(labelId) {
  const client = requireSupabase();

  const { error } = await client
    .from('labels')
    .delete()
    .eq('id', labelId);

  throwIfError(error);
}

export async function toggleTaskLabel(taskId, labelId, isAssigned) {
  const client = requireSupabase();

  if (isAssigned) {
    const { error } = await client
      .from('task_labels')
      .delete()
      .eq('task_id', taskId)
      .eq('label_id', labelId);

    throwIfError(error);
    return;
  }

  const { error } = await client.from('task_labels').insert({
    task_id: taskId,
    label_id: labelId,
  });

  throwIfError(error);
}
