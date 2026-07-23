import { useEffect, useMemo, useState } from 'react';
import { getLabelStyle } from '../utils/labelStyles.js';

function formatDate(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getLabelsForTask(task, labels, taskLabels) {
  const assignedLabelIds = new Set(
    taskLabels
      .filter((item) => item.task_id === task.id)
      .map((item) => item.label_id)
  );

  return labels.filter((label) => assignedLabelIds.has(label.id));
}

export default function TrashDrawer({
  isOpen,
  tasks,
  columns,
  labels,
  taskLabels,
  onClose,
  onRestore,
  onEmptyTrash,
  isBusy,
}) {
  const [restoreTargets, setRestoreTargets] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    const nextTargets = {};
    tasks.forEach((task) => {
      const originalColumnStillExists = columns.some((column) => column.id === task.trashed_from_column_id);
      nextTargets[task.id] = originalColumnStillExists ? task.trashed_from_column_id : columns[0]?.id || '';
    });
    setRestoreTargets(nextTargets);
  }, [isOpen, tasks, columns]);

  const taskCount = tasks.length;
  const hasColumns = columns.length > 0;

  const groupedTasks = useMemo(() => tasks, [tasks]);

  if (!isOpen) return null;

  return (
    <div className="trash-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <aside className="trash-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="trash-header">
          <div>
            <p className="modal-kicker">Recover deleted work</p>
            <h2>Trash</h2>
            <p>{taskCount} task{taskCount === 1 ? '' : 's'} in Trash. Tasks that have been in Trash more than 30 days will be automatically deleted.</p>
          </div>
          <button className="modal-close-button trash-close" type="button" onClick={onClose} aria-label="Close trash" disabled={isBusy}>
            ×
          </button>
        </div>

        <div className="trash-actions">
          <button type="button" className="danger" onClick={onEmptyTrash} disabled={taskCount === 0 || isBusy}>
            {isBusy ? 'Working…' : 'Empty Trash'}
          </button>
        </div>

        {!hasColumns && taskCount > 0 && (
          <div className="trash-warning">
            Create at least one column before restoring tasks.
          </div>
        )}

        <div className="trash-list">
          {taskCount === 0 ? (
            <div className="empty-trash">
              <h3>Trash is empty</h3>
              <p>Deleted tasks will show up here so you can restore them later.</p>
            </div>
          ) : (
            groupedTasks.map((task) => {
              const assignedLabels = getLabelsForTask(task, labels, taskLabels);
              const targetColumnId = restoreTargets[task.id] || columns[0]?.id || '';

              return (
                <article key={task.id} className="trash-card">
                  <div>
                    <h3>{task.title}</h3>
                    <p>
                      Deleted {formatDate(task.deleted_at)}
                      {task.trashed_from_column_name ? ` from ${task.trashed_from_column_name}` : ''}
                    </p>
                    {assignedLabels.length > 0 && (
                      <div className="task-label-row">
                        {assignedLabels.map((label) => (
                          <span key={label.id} className="task-label-pill" style={getLabelStyle(label.color)}>
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="restore-controls">
                    <select
                      value={targetColumnId}
                      onChange={(event) => setRestoreTargets((current) => ({ ...current, [task.id]: event.target.value }))}
                      disabled={!hasColumns || isBusy}
                    >
                      {columns.map((column) => (
                        <option key={column.id} value={column.id}>
                          {column.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => onRestore(task.id, targetColumnId)} disabled={!targetColumnId || isBusy}>
                      {isBusy ? 'Working…' : 'Restore'}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
