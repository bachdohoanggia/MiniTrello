import { useState } from 'react';

export default function ColumnForm({ onCreateColumn }) {
  const [name, setName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    await onCreateColumn(cleanName);
    setName('');
  }

  return (
    <form className="column-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New column, e.g. Review"
        aria-label="New column name"
      />
      <button type="submit">+ Add Column</button>
    </form>
  );
}
