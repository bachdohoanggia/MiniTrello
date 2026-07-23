import { supabase } from '../supabaseClient';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  }
  return supabase;
}

function throwIfError(error) {
  if (error) throw error;
}

async function boardCommand(workspaceId, action, payload = {}) {
  const { data, error } = await requireSupabase().rpc('workspace_board_command', {
    p_workspace_id: workspaceId,
    p_action: action,
    p_payload: payload,
  });
  throwIfError(error);
  return data;
}

export async function fetchBoard(workspaceId) {
  const { data, error } = await requireSupabase().rpc('get_workspace_board', {
    p_workspace_id: workspaceId,
  });
  throwIfError(error);
  return {
    columns: data?.columns ?? [],
    tasks: data?.tasks ?? [],
    trashTasks: data?.trashTasks ?? [],
    labels: data?.labels ?? [],
    taskLabels: data?.taskLabels ?? [],
  };
}

export const deleteExpiredTrashTasks = (workspaceId, days = 30) =>
  boardCommand(workspaceId, 'cleanup_trash', { days });

export const createColumn = (workspaceId, name) =>
  boardCommand(workspaceId, 'create_column', { name, position: Date.now() });

export const updateColumn = (workspaceId, columnId, updates) =>
  boardCommand(workspaceId, 'update_column', { id: columnId, ...updates });

export const updateColumnPositions = (workspaceId, columns) =>
  boardCommand(workspaceId, 'reorder_columns', {
    items: columns.map((column, index) => ({ id: column.id, position: index + 1 })),
  });

export const deleteColumnAndTrashTasks = (workspaceId, column) =>
  boardCommand(workspaceId, 'delete_column', { id: column.id });

export const createTask = (workspaceId, task) =>
  boardCommand(workspaceId, 'create_task', { ...task, position: Date.now() });

export const updateTask = (workspaceId, taskId, updates) =>
  boardCommand(workspaceId, 'update_task', { id: taskId, ...updates });

export const moveTask = (workspaceId, taskId, newColumnId) =>
  boardCommand(workspaceId, 'move_task', { id: taskId, column_id: newColumnId });

export const updateTaskPositions = (workspaceId, tasks) =>
  boardCommand(workspaceId, 'reorder_tasks', {
    items: tasks.map((task, index) => ({ id: task.id, column_id: task.column_id, position: index + 1 })),
  });

export const trashTask = (workspaceId, task) =>
  boardCommand(workspaceId, 'trash_task', { id: task.id });

export const restoreTask = (workspaceId, taskId, columnId) =>
  boardCommand(workspaceId, 'restore_task', { id: taskId, column_id: columnId });

export const emptyTrash = (workspaceId) => boardCommand(workspaceId, 'empty_trash');

export const createLabel = (workspaceId, label) => boardCommand(workspaceId, 'create_label', label);

export const deleteLabel = (workspaceId, labelId) => boardCommand(workspaceId, 'delete_label', { id: labelId });
