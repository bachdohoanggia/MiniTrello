import { useState } from 'react';

export default function ColumnForm({ onCreateColumn, isBusy }) {
  const [name, setName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    const created = await onCreateColumn(cleanName);
    if (created) setName('');
  }

  return (
    <form className="column-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New column, e.g. Review"
        aria-label="New column name"
        disabled={isBusy}
      />
      <button type="submit" disabled={isBusy}>{isBusy ? 'Adding…' : '+ Add Column'}</button>
    </form>
  );
}
