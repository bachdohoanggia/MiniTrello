import { useEffect, useMemo, useRef, useState } from 'react';
import MemberAvatar from './MemberAvatar.jsx';

export default function MemberPicker({
  members = [],
  selectedIds = [],
  onChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMembers = useMemo(
    () => members.filter((member) => selectedSet.has(member.user_id)),
    [members, selectedSet]
  );
  const filteredMembers = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return members;

    return members.filter((member) => (
      member.display_name?.toLowerCase().includes(cleanQuery)
      || member.email?.toLowerCase().includes(cleanQuery)
    ));
  }, [members, query]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutsidePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isOpen]);

  function toggleMember(userId) {
    if (selectedSet.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
      return;
    }
    onChange([...selectedIds, userId]);
  }

  function removeMember(userId) {
    onChange(selectedIds.filter((id) => id !== userId));
  }

  function togglePicker() {
    if (disabled) return;
    setIsOpen((current) => !current);
    setQuery('');
  }

  return (
    <div className="member-picker" ref={pickerRef}>
      <div className="assignee-summary">
        <div className="assignee-chip-list">
          {selectedMembers.length === 0 ? (
            <span className="unassigned-text">Unassigned</span>
          ) : (
            selectedMembers.map((member) => (
              <span className="assignee-chip" key={member.user_id}>
                <MemberAvatar member={member} size="small" />
                <span>{member.display_name}</span>
                <button
                  type="button"
                  onClick={() => removeMember(member.user_id)}
                  aria-label={`Remove ${member.display_name} from this task`}
                  title={`Remove ${member.display_name}`}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <button
          type="button"
          className="member-picker-trigger"
          onClick={togglePicker}
          aria-expanded={isOpen}
          disabled={disabled}
        >
          {selectedMembers.length > 0 ? 'Edit members' : '+ Members'}
        </button>
      </div>

      {isOpen && (
        <div className="member-picker-popover">
          <div className="member-picker-header">
            <strong>Assign members</strong>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close member picker">×</button>
          </div>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members by name or Gmail"
            aria-label="Search workspace members"
            autoFocus
          />

          <div className="member-picker-list">
            {filteredMembers.length === 0 ? (
              <p>No workspace members found.</p>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedSet.has(member.user_id);
                return (
                  <button
                    type="button"
                    className={`member-picker-option ${isSelected ? 'is-selected' : ''}`}
                    key={member.user_id}
                    onClick={() => toggleMember(member.user_id)}
                    aria-pressed={isSelected}
                  >
                    <MemberAvatar member={member} />
                    <span>
                      <strong>{member.display_name}</strong>
                      <small>{member.email}</small>
                    </span>
                    <span className="member-picker-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
