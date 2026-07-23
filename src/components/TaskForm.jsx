import { useEffect, useState } from 'react';

const blankForm = {
  title: '',
  description: '',
  priority: '',
  due_date: '',
  column_id: '',
};

export default function TaskForm({ isOpen, columns, defaultColumnId, isBusy, onClose, onSubmit }) {
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      ...blankForm,
      column_id: defaultColumnId || columns[0]?.id || '',
    });
  }, [isOpen, defaultColumnId]);

  if (!isOpen) return null;

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanTitle = formData.title.trim();
    if (!cleanTitle) return;
    if (!formData.column_id) return;

    await onSubmit({
      ...formData,
      title: cleanTitle,
      description: formData.description.trim(),
      priority: formData.priority || null,
      due_date: formData.due_date || null,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <section className="modal-card task-create-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-kicker">New card</p>
            <h2>Add Task</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Finish React project"
              required
            />
          </label>

          <label>
            Description <span className="optional-text">optional</span>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="You can also add details later by clicking the card."
              rows="4"
            />
          </label>

          <div className="form-row">
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
              Due Date <span className="optional-text">optional</span>
              <input name="due_date" type="date" value={formData.due_date || ''} onChange={handleChange} />
            </label>
          </div>

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

          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" disabled={isBusy}>{isBusy ? 'Creating…' : 'Create Task'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
