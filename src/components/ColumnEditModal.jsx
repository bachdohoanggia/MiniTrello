import { useEffect, useState } from 'react';

export default function ColumnEditModal({ column, isBusy, onClose, onSave }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (column) setName(column.name || '');
  }, [column?.id]);

  if (!column) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName === column.name) return;
    await onSave(column, cleanName);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={isBusy ? undefined : onClose}>
      <section className="modal-card column-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-column-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-kicker">Column settings</p>
            <h2 id="edit-column-title">Rename Column</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Column name
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. In Review" disabled={isBusy} />
          </label>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose} disabled={isBusy}>Cancel</button>
            <button type="submit" className="primary-action" disabled={isBusy || !name.trim() || name.trim() === column.name}>
              {isBusy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
