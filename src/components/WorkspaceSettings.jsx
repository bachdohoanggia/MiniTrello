import { useEffect, useState } from 'react';
import {
  addWorkspaceMember,
  changeWorkspaceMemberRole,
  deleteWorkspace,
  fetchWorkspaceContext,
  renameWorkspace,
  removeWorkspaceMember,
} from '../services/workspaceService.js';

export default function WorkspaceSettings({ isOpen, workspaceId, context, onClose, onContextChange, onDeleted }) {
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pendingKick, setPendingKick] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [message, setMessage] = useState('');
  const isAdmin = ['admin', 'super_admin'].includes(context?.current_role);
  const adminCount = context?.members?.filter((member) => member.workspace_role_key === 'admin').length || 0;

  useEffect(() => {
    if (!isOpen) return;
    setWorkspaceName(context?.workspace?.name || '');
    setMessage('');
    fetchWorkspaceContext(workspaceId)
      .then(onContextChange)
      .catch((err) => setError(err.message || 'Unable to refresh workspace settings.'));
  }, [isOpen, workspaceId]);

  useEffect(() => {
    if (isOpen && context?.workspace?.name) setWorkspaceName(context.workspace.name);
  }, [isOpen, context?.workspace?.name]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!isOpen) return null;

  async function refresh() {
    onContextChange(await fetchWorkspaceContext(workspaceId));
  }

  async function run(action) {
    if (busy) return false;
    setBusy(true); setError('');
    try { await action(); await refresh(); return true; }
    catch (err) { setError(err.message || 'Workspace action failed.'); return false; }
    finally { setBusy(false); }
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!targetEmail.trim()) return;
    const success = await run(() => addWorkspaceMember(workspaceId, targetEmail.trim(), targetRole));
    if (success) setTargetEmail('');
  }

  async function handleRename(event) {
    event.preventDefault();
    const nextName = workspaceName.trim();
    if (!nextName || nextName === context.workspace.name) return;
    setMessage('');
    const success = await run(() => renameWorkspace(workspaceId, nextName));
    if (success) setMessage('Workspace name updated.');
  }

  async function handleRoleChange(member, role) {
    await run(() => changeWorkspaceMemberRole(workspaceId, member.user_id, role));
  }

  async function handleKick(member) {
    const success = await run(() => removeWorkspaceMember(workspaceId, member.user_id));
    if (success) setPendingKick(null);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(context.workspace.join_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleDeleteWorkspace(event) {
    event.preventDefault();
    if (busy || deleteName !== context.workspace.name) return;
    setBusy(true); setError('');
    try {
      await deleteWorkspace(workspaceId);
      onDeleted();
    } catch (err) {
      setError(err.message || 'Unable to delete this workspace.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop workspace-settings-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <section className="workspace-settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="settings-header">
          <div><p className="modal-kicker">Workspace Settings</p><h2>{context.workspace.name}</h2></div>
          <button type="button" className="modal-close-button" onClick={onClose} disabled={busy}>×</button>
        </header>

        {error && <div className="portal-error">{error}</div>}

        {isAdmin && (
          <section className="settings-section">
            <h3>Workspace name</h3>
            <p>Change the name shown on the dashboard and workspace board.</p>
            <form className="workspace-name-form" onSubmit={handleRename}>
              <input
                value={workspaceName}
                onChange={(event) => { setWorkspaceName(event.target.value); setMessage(''); }}
                maxLength={100}
                placeholder="Workspace name"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !workspaceName.trim() || workspaceName.trim() === context.workspace.name}
              >
                {busy ? 'Saving…' : 'Save name'}
              </button>
            </form>
          </section>
        )}

        <section className="settings-section">
          <h3>Join code</h3>
          <p>Share this code with another signed-in user so they can join as a member.</p>
          <div className="join-code-card"><code>{context.workspace.join_code}</code><button type="button" onClick={copyCode}>{copied ? 'Copied!' : 'Copy code'}</button></div>
        </section>

        <section className="settings-section">
          <div className="settings-section-title"><div><h3>Members</h3><p>{context.members.length} people in this workspace</p></div><span className={`role-badge role-${context.current_role}`}>You: {context.current_role}</span></div>

          {isAdmin && (
            <form className="add-member-form" onSubmit={handleAdd}>
              <input type="email" value={targetEmail} onChange={(event) => setTargetEmail(event.target.value)} placeholder="User Gmail address" disabled={busy} />
              <select value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={busy}>
                <option value="member">Member</option><option value="admin">Admin</option>
              </select>
              <button disabled={busy || !targetEmail.trim()}>{busy ? 'Adding…' : 'Add user'}</button>
            </form>
          )}

          <div className="member-list">
            {context.members.map((member) => {
              const isSelf = member.is_current_user;
              const isLastAdmin = member.workspace_role_key === 'admin' && adminCount === 1;
              const roleLocked = member.is_virtual || member.global_role === 'super_admin';
              return (
                <article className="member-row" key={member.user_id}>
                  <div className="member-avatar">{member.display_name.slice(0, 1).toUpperCase()}</div>
                  <div className="member-copy"><strong>{member.display_name}{isSelf ? ' (you)' : ''}</strong><code>{member.email}</code></div>
                  {isAdmin && !roleLocked ? (
                    <select
                      value={member.role_key}
                      onChange={(event) => handleRoleChange(member, event.target.value)}
                      disabled={busy || isLastAdmin}
                      aria-label={`Role for ${member.display_name}`}
                      title={isLastAdmin ? 'A workspace must keep at least one admin' : `Change ${member.display_name}'s role`}
                    >
                      <option value="member">Member</option><option value="admin">Admin</option>
                    </select>
                  ) : <span className={`role-badge role-${member.role_key}`}>{member.role_key}</span>}
                  {isAdmin && !isSelf && !roleLocked && (
                    pendingKick?.user_id === member.user_id ? (
                      <div className="kick-confirm"><button type="button" className="danger" onClick={() => handleKick(member)} disabled={busy}>Confirm</button><button type="button" className="secondary" onClick={() => setPendingKick(null)} disabled={busy}>Cancel</button></div>
                    ) : <button type="button" className="danger" onClick={() => setPendingKick(member)} disabled={busy}>Kick</button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {isAdmin && (
          <section className="settings-section danger-zone">
            <div className="settings-section-title">
              <div><h3>Danger zone</h3><p>Permanently delete this workspace and all of its board data.</p></div>
              {!deleteOpen && <button type="button" className="danger" onClick={() => setDeleteOpen(true)}>Delete workspace</button>}
            </div>
            {deleteOpen && (
              <form className="delete-workspace-form" onSubmit={handleDeleteWorkspace}>
                <p>Type <strong>{context.workspace.name}</strong> to confirm. This cannot be undone.</p>
                <input value={deleteName} onChange={(event) => setDeleteName(event.target.value)} placeholder={context.workspace.name} disabled={busy} autoFocus />
                <div>
                  <button type="button" className="secondary" onClick={() => { setDeleteOpen(false); setDeleteName(''); }} disabled={busy}>Cancel</button>
                  <button type="submit" className="danger" disabled={busy || deleteName !== context.workspace.name}>{busy ? 'Deleting…' : 'Delete forever'}</button>
                </div>
              </form>
            )}
          </section>
        )}
      </section>
      {message && <div className="toast success">{message}</div>}
    </div>
  );
}
