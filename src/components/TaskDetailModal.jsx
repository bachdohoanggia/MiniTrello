import { useEffect, useMemo, useState } from 'react';
import { getLabelColorValue, getLabelStyle } from '../utils/labelStyles.js';

const emptyTask = {
  title: '',
  description: '',
  priority: '',
  due_date: '',
  column_id: '',
};

const starterLabelColors = [
  '#2563eb',
  '#16a34a',
  '#eab308',
  '#e11d48',
  '#7c3aed',
  '#64748b',
  '#0891b2',
  '#f97316',
];

function formatActivityDate(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPriorityLabel(priority) {
  if (!priority) return 'No priority';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export default function TaskDetailModal({
  task,
  columns,
  labels,
  taskLabels,
  onClose,
  onSave,
  onDelete,
  onCreateLabel,
  onDeleteLabel,
  isBusy,
}) {
  const [formData, setFormData] = useState(emptyTask);
  const [draftLabelIds, setDraftLabelIds] = useState([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#2563eb');

  useEffect(() => {
    if (!task) return;

    setFormData({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || '',
      due_date: task.due_date || '',
      column_id: task.column_id || columns[0]?.id || '',
    });
    setDraftLabelIds(
      taskLabels
        .filter((item) => item.task_id === task.id)
        .map((item) => item.label_id)
    );
    setNewLabelName('');
    setNewLabelColor('#2563eb');
  }, [task?.id]);

  useEffect(() => {
    const availableLabelIds = new Set(labels.map((label) => label.id));
    setDraftLabelIds((current) => current.filter((labelId) => availableLabelIds.has(labelId)));
  }, [labels]);

  const currentColumn = useMemo(
    () => columns.find((column) => column.id === formData.column_id),
    [columns, formData.column_id]
  );

  const assignedLabelIds = useMemo(() => new Set(draftLabelIds), [draftLabelIds]);

  if (!task) return null;

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const cleanTitle = formData.title.trim();
    if (!cleanTitle || !formData.column_id) return;

    onSave(task.id, {
      title: cleanTitle,
      description: formData.description.trim(),
      priority: formData.priority || null,
      due_date: formData.due_date || null,
      column_id: formData.column_id,
      label_ids: draftLabelIds,
    });
  }

  function handleToggleDraftLabel(labelId) {
    setDraftLabelIds((current) => (
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId]
    ));
  }

  async function handleCreateLabel(event) {
    event.preventDefault();
    const cleanName = newLabelName.trim();
    if (!cleanName) return;

    const created = await onCreateLabel({
      name: cleanName,
      color: getLabelColorValue(newLabelColor),
    });

    if (!created) return;

    setNewLabelName('');
    setNewLabelColor('#2563eb');
  }

  async function handleDeleteLabel(label) {
    await onDeleteLabel(label);
  }

  return (
    <div className="modal-backdrop task-detail-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <section className="task-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="task-detail-main">
          <div className="task-detail-title-line">
            <span className="task-status-circle" aria-hidden="true" />
            <div>
              <p className="modal-kicker">Task details</p>
              <input
                className="task-title-input"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Task title"
              />
              <p className="task-location-text">
                In column <strong>{currentColumn?.name || 'Unknown'}</strong>
              </p>
            </div>
          </div>

          <div className="detail-section quick-fields">
            <label>
              Column
              <select name="column_id" value={formData.column_id} onChange={handleChange}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority <span className="optional-text">optional</span>
              <select name="priority" value={formData.priority} onChange={handleChange}>
                <option value="">No priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              Due date <span className="optional-text">optional</span>
              <input name="due_date" type="date" value={formData.due_date || ''} onChange={handleChange} />
            </label>
          </div>

          <section className="detail-section labels-section">
            <div className="detail-section-heading">
              <span className="detail-icon">⌑</span>
              <h3>Labels</h3>
            </div>

            <div className="label-picker">
              {labels.length === 0 ? (
                <p className="empty-labels">No labels yet. Create one below.</p>
              ) : (
                labels.map((label) => {
                  const isAssigned = assignedLabelIds.has(label.id);
                  return (
                    <div className="label-management-row" key={label.id}>
                      <button
                        type="button"
                        className={`label-toggle ${isAssigned ? 'is-selected' : ''}`}
                        style={getLabelStyle(label.color)}
                        onClick={() => handleToggleDraftLabel(label.id)}
                        disabled={isBusy}
                        title={isAssigned ? 'Remove this label when changes are saved' : 'Add this label when changes are saved'}
                      >
                        {isAssigned ? '✓ ' : ''}{label.name}
                      </button>
                      <button
                        type="button"
                        className="delete-label-button"
                        onClick={() => handleDeleteLabel(label)}
                        title={`Delete ${label.name} label`}
                        aria-label={`Delete ${label.name} label`}
                        disabled={isBusy}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <form className="new-label-form" onSubmit={handleCreateLabel}>
              <input
                type="text"
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder="New label name, e.g. School"
              />

              <div className="label-color-control">
                <input
                  aria-label="Custom label color"
                  type="color"
                  value={newLabelColor}
                  onChange={(event) => setNewLabelColor(event.target.value)}
                />
                <span className="label-color-value">{newLabelColor}</span>
              </div>

              <button type="submit" disabled={isBusy}>{isBusy ? 'Working…' : 'Add Label'}</button>
            </form>

            <div className="label-color-presets" aria-label="Suggested label colors">
              {starterLabelColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="label-color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => setNewLabelColor(color)}
                  aria-label={`Use ${color} as label color`}
                  disabled={isBusy}
                />
              ))}
            </div>
          </section>

          <section className="detail-section description-section">
            <div className="detail-section-heading">
              <span className="detail-icon">☰</span>
              <h3>Description</h3>
            </div>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add a more detailed description..."
              rows="7"
            />
          </section>
        </div>

        <aside className="task-detail-side">
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="Close task details" disabled={isBusy}>
            ×
          </button>

          <div className="side-card">
            <p className="side-label">Current status</p>
            <div className="side-row">
              <span>Column</span>
              <strong>{currentColumn?.name || 'Unknown'}</strong>
            </div>
            <div className="side-row">
              <span>Priority</span>
              <strong className={formData.priority ? `priority-text priority-text-${formData.priority}` : ''}>
                {getPriorityLabel(formData.priority)}
              </strong>
            </div>
          </div>

          <div className="side-card activity-card">
            <p className="side-label">Activity</p>
            <p>
              This card was created on <strong>{formatActivityDate(task.created_at)}</strong>.
            </p>
            {task.updated_at && (
              <p>
                Last updated <strong>{formatActivityDate(task.updated_at)}</strong>.
              </p>
            )}
          </div>

          <div className="side-actions">
            <button type="button" onClick={handleSubmit} disabled={isBusy}>
              {isBusy ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" className="danger" onClick={() => onDelete(task)} disabled={isBusy}>
              Move to Trash
            </button>
            <button type="button" className="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
