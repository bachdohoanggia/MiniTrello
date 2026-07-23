import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient';
import Board from './components/Board.jsx';
import ColumnForm from './components/ColumnForm.jsx';
import TaskForm from './components/TaskForm.jsx';
import TaskDetailModal from './components/TaskDetailModal.jsx';
import TrashDrawer from './components/TrashDrawer.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ColumnEditModal from './components/ColumnEditModal.jsx';
import {
  createColumn,
  createLabel,
  createTask,
  deleteLabel,
  deleteColumnAndTrashTasks,
  deleteExpiredTrashTasks,
  emptyTrash,
  fetchBoard,
  moveTask,
  restoreTask,
  toggleTaskLabel,
  trashTask,
  updateColumn,
  updateColumnPositions,
  updateTask,
  updateTaskPositions,
} from './services/boardService.js';

function reorderItems(items, draggedId, targetId) {
  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return items;
  }

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  nextItems.splice(targetIndex, 0, draggedItem);
  return nextItems;
}

export default function App({ workspaceId, workspaceContext, onNavigate, onOpenSettings }) {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [trashTasks, setTrashTasks] = useState([]);
  const [labels, setLabels] = useState([]);
  const [taskLabels, setTaskLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingColumn, setEditingColumn] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const mutationLockRef = useRef(false);
  const messageTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  const [taskForm, setTaskForm] = useState({
    isOpen: false,
    defaultColumnId: null,
  });

  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const labelTaskCounts = useMemo(() => {
    const activeTaskIds = new Set(tasks.map((task) => task.id));
    const counts = {};

    taskLabels.forEach((item) => {
      if (!activeTaskIds.has(item.task_id)) return;
      counts[item.label_id] = (counts[item.label_id] || 0) + 1;
    });

    return counts;
  }, [tasks, taskLabels]);

  const selectedLabels = useMemo(
    () => labels.filter((label) => selectedLabelIds.includes(label.id)),
    [labels, selectedLabelIds]
  );

  const visibleTasks = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesName = !cleanQuery || task.title.toLowerCase().includes(cleanQuery);

      const matchesLabels =
        selectedLabelIds.length === 0 ||
        selectedLabelIds.every((labelId) =>
          taskLabels.some((item) => item.task_id === task.id && item.label_id === labelId)
        );

      return matchesName && matchesLabels;
    });
  }, [tasks, taskLabels, searchQuery, selectedLabelIds]);

  useEffect(() => {
    setSelectedLabelIds((current) => current.filter((labelId) => labels.some((label) => label.id === labelId)));
  }, [labels]);

  function toggleSelectedLabel(labelId) {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    );
  }

  const showMessage = (text) => {
    window.clearTimeout(messageTimerRef.current);
    window.clearTimeout(errorTimerRef.current);
    setError('');
    setMessage(text);
    messageTimerRef.current = window.setTimeout(() => setMessage(''), 2500);
  };

  const showError = (err) => {
    console.error(err);
    window.clearTimeout(messageTimerRef.current);
    window.clearTimeout(errorTimerRef.current);
    setMessage('');
    setError(err.message || 'Something went wrong. Check the browser console.');
    errorTimerRef.current = window.setTimeout(() => setError(''), 4500);
  };

  function requestConfirm(options) {
    return new Promise((resolve) => {
      setConfirmDialog({
        title: options.title || 'Are you sure?',
        message: options.message || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        resolve,
      });
    });
  }

  function closeConfirmDialog(result) {
    if (confirmDialog?.resolve) {
      confirmDialog.resolve(result);
    }
    setConfirmDialog(null);
  }

  const loadBoard = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      const board = await fetchBoard(workspaceId);
      setColumns(board.columns);
      setTasks(board.tasks);
      setTrashTasks(board.trashTasks);
      setLabels(board.labels);
      setTaskLabels(board.taskLabels);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  async function runMutation(action) {
    if (mutationLockRef.current) return false;

    mutationLockRef.current = true;
    setIsMutating(true);
    setError('');

    try {
      await action();
      return true;
    } catch (err) {
      showError(err);
      await loadBoard();
      return false;
    } finally {
      mutationLockRef.current = false;
      setIsMutating(false);
    }
  }

  useEffect(() => {
    async function initializeBoard() {
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }

      try {
        await deleteExpiredTrashTasks(workspaceId, 30);
      } catch (err) {
        console.warn('Could not clean old trash tasks:', err);
      }

      await loadBoard();
    }

    initializeBoard();
  }, [loadBoard, workspaceId]);

  useEffect(() => {
    if (!supabase) return undefined;

    let refreshTimer;
    const scheduleBoardRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadBoard(), 120);
    };

    const channel = supabase
      .channel(`taskflow-board-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'columns', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'columns', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'columns' }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'labels', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'labels', filter: `workspace_id=eq.${workspaceId}` }, scheduleBoardRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'labels' }, scheduleBoardRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, scheduleBoardRefresh)
      .subscribe((status, channelError) => {
        if (status === 'SUBSCRIBED') scheduleBoardRefresh();
        console.info('Board Realtime status:', status, channelError || '');
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          console.error('Board Realtime channel failed:', status, channelError);
        }
      });

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [loadBoard, workspaceId]);

  async function handleCreateColumn(name) {
    return runMutation(async () => {
      await createColumn(workspaceId, name);
      showMessage('Column added.');
      await loadBoard();
    });
  }

  function handleEditColumn(column) {
    if (!mutationLockRef.current) setEditingColumn(column);
  }

  async function handleSaveColumn(column, newName) {
    return runMutation(async () => {
      await updateColumn(workspaceId, column.id, { name: newName });
      showMessage('Column updated.');
      setEditingColumn(null);
      await loadBoard();
    });
  }

  async function handleDeleteColumn(column) {
    const confirmed = await requestConfirm({
      title: 'Delete this column?',
      message: `Tasks inside "${column.name}" will move to Trash instead of being permanently deleted.`,
      confirmText: 'Delete column',
      variant: 'danger',
    });
    if (!confirmed) return;

    return runMutation(async () => {
      await deleteColumnAndTrashTasks(workspaceId, column);
      showMessage('Column deleted. Its tasks moved to Trash.');
      if (selectedTask && selectedTask.column_id === column.id) {
        setSelectedTaskId(null);
      }
      await loadBoard();
    });
  }

  async function handleMoveColumn(draggedColumnId, targetColumnId) {
    if (draggedColumnId === targetColumnId) return;

    const nextColumns = reorderItems(columns, draggedColumnId, targetColumnId);
    if (nextColumns === columns) return;

    return runMutation(async () => {
      setColumns(nextColumns);
      await updateColumnPositions(workspaceId, nextColumns);
      showMessage('Column moved.');
      await loadBoard();
    });
  }

  function openCreateTaskForm(columnId) {
    if (mutationLockRef.current) return;
    setTaskForm({
      isOpen: true,
      defaultColumnId: columnId,
    });
  }

  function closeTaskForm() {
    setTaskForm({
      isOpen: false,
      defaultColumnId: null,
    });
  }

  function openTaskDetails(task) {
    setSelectedTaskId(task.id);
  }

  function closeTaskDetails() {
    setSelectedTaskId(null);
  }

  async function handleSubmitTask(formData) {
    return runMutation(async () => {
      await createTask(workspaceId, formData);
      showMessage('Task added.');
      closeTaskForm();
      await loadBoard();
    });
  }

  async function handleSaveTask(taskId, formData) {
    return runMutation(async () => {
      await updateTask(workspaceId, taskId, formData);
      showMessage('Task updated.');
      setSelectedTaskId(null);
      await loadBoard();
    });
  }

  async function handleMoveTask(taskId, newColumnId) {
    return runMutation(async () => {
      await moveTask(workspaceId, taskId, newColumnId);
      showMessage('Task moved.');
      await loadBoard();
    });
  }

  async function handleReorderTask(draggedTaskId, targetTaskId, targetColumnId) {
    if (draggedTaskId === targetTaskId) return false;

    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    const targetTask = tasks.find((task) => task.id === targetTaskId);
    if (!draggedTask || !targetTask) return false;

    const destinationTasks = tasks.filter(
      (task) => task.column_id === targetColumnId && task.id !== draggedTaskId
    );
    const targetIndex = destinationTasks.findIndex((task) => task.id === targetTaskId);
    if (targetIndex === -1) return false;

    const movedTask = { ...draggedTask, column_id: targetColumnId };
    destinationTasks.splice(targetIndex, 0, movedTask);

    const sourceTasks = draggedTask.column_id === targetColumnId
      ? []
      : tasks.filter((task) => task.column_id === draggedTask.column_id && task.id !== draggedTaskId);

    return runMutation(async () => {
      setTasks((current) => current.map((task) => task.id === draggedTaskId ? movedTask : task));
      await Promise.all([
        updateTaskPositions(workspaceId, destinationTasks),
        sourceTasks.length > 0 ? updateTaskPositions(workspaceId, sourceTasks) : Promise.resolve(),
      ]);
      showMessage('Task order updated.');
      await loadBoard();
    });
  }

  async function handleTrashTask(task) {
    const confirmed = await requestConfirm({
      title: 'Move task to Trash?',
      message: `"${task.title}" will leave the board, but you can restore it from Trash later.`,
      confirmText: 'Move to Trash',
      variant: 'danger',
    });
    if (!confirmed) return;

    return runMutation(async () => {
      await trashTask(workspaceId, task);
      showMessage('Task moved to Trash.');
      if (selectedTaskId === task.id) {
        setSelectedTaskId(null);
      }
      await loadBoard();
    });
  }

  async function handleRestoreTask(taskId, columnId) {
    if (!columnId) {
      showError(new Error('Please create a column before restoring tasks.'));
      return;
    }

    return runMutation(async () => {
      await restoreTask(workspaceId, taskId, columnId);
      showMessage('Task restored.');
      await loadBoard();
    });
  }

  async function handleEmptyTrash() {
    const confirmed = await requestConfirm({
      title: 'Empty Trash?',
      message: 'Every task in Trash will be permanently deleted. This cannot be undone.',
      confirmText: 'Empty Trash',
      variant: 'danger',
    });
    if (!confirmed) return;

    return runMutation(async () => {
      await emptyTrash(workspaceId);
      showMessage('Trash emptied.');
      await loadBoard();
    });
  }

  async function handleCreateLabel(label) {
    return runMutation(async () => {
      await createLabel(workspaceId, label);
      showMessage('Label added.');
      await loadBoard();
    });
  }

  async function handleDeleteLabel(label) {
    const labelId = typeof label === 'string' ? label : label.id;
    const labelName = typeof label === 'string' ? 'this label' : `"${label.name}"`;

    const confirmed = await requestConfirm({
      title: 'Delete label?',
      message: `${labelName} will be removed from every task that uses it.`,
      confirmText: 'Delete label',
      variant: 'danger',
    });
    if (!confirmed) return;

    return runMutation(async () => {
      await deleteLabel(workspaceId, labelId);
      showMessage('Label deleted.');
      await loadBoard();
    });
  }

  async function handleToggleTaskLabel(taskId, labelId, isAssigned) {
    return runMutation(async () => {
      await toggleTaskLabel(workspaceId, taskId, labelId, isAssigned);
      await loadBoard();
    });
  }

  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div className="brand-block" aria-label="TaskFlow Board">
          <div className="brand-mark">MT</div>
          <div>
            <p className="eyebrow">{workspaceContext?.current_role || 'member'} workspace</p>
            <h1>{workspaceContext?.workspace?.name || 'MiniTrello'}</h1>
          </div>
        </div>

        <div className="workspace-tools">
          <button type="button" className="workspace-nav-button" onClick={() => onNavigate('/')} title="Back to dashboard">←</button>
          <select
            className="workspace-switcher"
            value={workspaceId}
            onChange={(event) => onNavigate(`/workspace/${event.target.value}`)}
            aria-label="Switch workspace"
          >
            {(workspaceContext?.user_workspaces || []).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <div className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks by name..."
              aria-label="Search tasks by name"
            />
            {(searchQuery || selectedLabelIds.length > 0) && (
              <button
                type="button"
                className="clear-search"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLabelIds([]);
                }}
              >
                Clear
              </button>
            )}
          </div>

          <button type="button" className="trash-button" onClick={() => setIsTrashOpen(true)}>
            <span className="trash-icon" aria-hidden="true">⌫</span>
            <span>Trash</span>
            <strong>{trashTasks.length}</strong>
          </button>

          <button type="button" className="workspace-nav-button" onClick={onOpenSettings}>
            Settings
          </button>

          <ColumnForm onCreateColumn={handleCreateColumn} isBusy={isMutating} />
        </div>
      </header>

      {labels.length > 0 && (
        <section className="label-filter-bar" aria-label="Filter tasks by label">
          <div className="label-filter-title">
            <span>Labels</span>
            {selectedLabels.length > 0 && (
              <strong>Filtering by {selectedLabels.length} label{selectedLabels.length === 1 ? '' : 's'}</strong>
            )}
          </div>

          <div className="label-filter-chips">
            <button
              type="button"
              className={`label-filter-chip ${selectedLabelIds.length === 0 ? 'is-active' : ''}`}
              onClick={() => setSelectedLabelIds([])}
              title="Show all tasks and clear label filters"
            >
              All tasks
              <small>{tasks.length}</small>
            </button>

            {labels.map((label) => {
              const isSelected = selectedLabelIds.includes(label.id);

              return (
                <button
                  key={label.id}
                  type="button"
                  className={`label-filter-chip ${isSelected ? 'is-active' : ''}`}
                  style={{ '--label-color': label.color }}
                  onClick={() => toggleSelectedLabel(label.id)}
                  title={isSelected ? `Remove ${label.name} filter` : `Add ${label.name} filter`}
                >
                  <span className="label-filter-swatch" style={{ backgroundColor: label.color }} />
                  {label.name}
                  <small>{labelTaskCounts[label.id] || 0}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!hasSupabaseConfig && (
        <section className="setup-warning">
          <h2>Supabase config missing</h2>
          <p>
            Create a <code>.env.local</code> file and add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>. Use <code>.env.example</code> as a template.
          </p>
        </section>
      )}

      {message && <div className="toast success">{message}</div>}
      {error && <div className="toast error">{error}</div>}

      {loading ? (
        <div className="loading-card">Loading board...</div>
      ) : (
        <Board
          columns={columns}
          tasks={visibleTasks}
          labels={labels}
          taskLabels={taskLabels}
          hasActiveFilters={Boolean(searchQuery.trim() || selectedLabelIds.length > 0)}
          onAddTask={openCreateTaskForm}
          onOpenTask={openTaskDetails}
          onMoveTask={handleMoveTask}
          onReorderTask={handleReorderTask}
          onMoveColumn={handleMoveColumn}
          onEditColumn={handleEditColumn}
          onDeleteColumn={handleDeleteColumn}
          isBusy={isMutating}
        />
      )}

      <TaskForm
        isOpen={taskForm.isOpen}
        columns={columns}
        defaultColumnId={taskForm.defaultColumnId}
        onClose={closeTaskForm}
        onSubmit={handleSubmitTask}
        isBusy={isMutating}
      />

      <TaskDetailModal
        task={selectedTask}
        columns={columns}
        labels={labels}
        taskLabels={taskLabels}
        onClose={closeTaskDetails}
        onSave={handleSaveTask}
        onDelete={handleTrashTask}
        onCreateLabel={handleCreateLabel}
        onDeleteLabel={handleDeleteLabel}
        onToggleTaskLabel={handleToggleTaskLabel}
        isBusy={isMutating}
      />

      <TrashDrawer
        isOpen={isTrashOpen}
        tasks={trashTasks}
        columns={columns}
        labels={labels}
        taskLabels={taskLabels}
        onClose={() => setIsTrashOpen(false)}
        onRestore={handleRestoreTask}
        onEmptyTrash={handleEmptyTrash}
        isBusy={isMutating}
      />

      <ColumnEditModal
        column={editingColumn}
        isBusy={isMutating}
        onClose={() => setEditingColumn(null)}
        onSave={handleSaveColumn}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        cancelText={confirmDialog?.cancelText}
        variant={confirmDialog?.variant}
        isBusy={isMutating}
        onCancel={() => closeConfirmDialog(false)}
        onConfirm={() => closeConfirmDialog(true)}
      />
    </main>
  );
}
