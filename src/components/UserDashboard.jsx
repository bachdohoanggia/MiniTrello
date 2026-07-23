import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspace, fetchUserDashboard, joinWorkspace } from '../services/workspaceService.js';
import { supabase } from '../supabaseClient.js';

export default function UserDashboard({ profile, onProfileChange, onNavigate, onLogout }) {
  const [data, setData] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refreshTimerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const nextData = await fetchUserDashboard();
      setData(nextData);
      if (nextData?.user) onProfileChange(nextData.user);
    } catch (err) {
      setError(err.message || 'Unable to load this user.');
    }
  }, [onProfileChange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!supabase || !profile?.id) return undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(load, 140);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    const channel = supabase
      .channel(`dashboard-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${profile.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${profile.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspace_members' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${profile.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, scheduleRefresh)
      .subscribe((status, channelError) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
        console.info('Dashboard Realtime status:', status, channelError || '');
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          console.error('Dashboard Realtime channel failed:', status, channelError);
        }
      });

    window.addEventListener('focus', scheduleRefresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener('focus', scheduleRefresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      supabase.removeChannel(channel);
    };
  }, [load, profile?.id]);

  async function handleCreate(event) {
    event.preventDefault();
    if (!workspaceName.trim() || busy) return;
    setBusy(true);
    try {
      const workspace = await createWorkspace(workspaceName.trim());
      onNavigate(`/workspace/${workspace.id}`);
    } catch (err) {
      setError(err.message || 'Unable to create workspace.');
    } finally { setBusy(false); }
  }

  async function handleJoin(event) {
    event.preventDefault();
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    try {
      const workspaceId = await joinWorkspace(joinCode);
      onNavigate(`/workspace/${workspaceId}`);
    } catch (err) {
      setError(err.message || 'Unable to join workspace.');
    } finally { setBusy(false); }
  }

  if (!data && !error) return <main className="portal-shell"><section className="portal-card">Loading dashboard…</section></main>;

  return (
    <main className="portal-shell">
      <header className="portal-toolbar">
        <button type="button" className="portal-back sign-out-button" onClick={onLogout}>Sign out</button>
        <div><p className="eyebrow">{profile.global_role === 'super_admin' ? 'Super Admin dashboard' : 'User dashboard'}</p><h1>{data?.user?.display_name || profile.display_name}</h1></div>
        <button type="button" onClick={() => onNavigate('/account')}>My Account</button>
      </header>
      {error && <div className="portal-error">{error}</div>}
      <section className="dashboard-layout">
        <div className="portal-card workspace-list-card">
          <div className="portal-section-heading"><div><p className="eyebrow">Your workspaces</p><h2>Choose a board</h2></div><span>{data?.workspaces?.length || 0}</span></div>
          <div className="workspace-card-grid">
            {(data?.workspaces || []).map((workspace) => (
              <button key={workspace.id} className="workspace-card" onClick={() => onNavigate(`/workspace/${workspace.id}`)}>
                <span><strong>{workspace.name}</strong><small>{workspace.effective_role} · {workspace.member_count} members</small></span><span>→</span>
              </button>
            ))}
            {data?.workspaces?.length === 0 && <p>You are not a member of a workspace yet.</p>}
          </div>
        </div>
        <aside className="dashboard-actions">
          <form className="portal-card portal-form" onSubmit={handleCreate}>
            <p className="eyebrow">Start fresh</p><h2>Create workspace</h2>
            <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Workspace name" disabled={busy} />
            <button className="primary-action" disabled={busy || !workspaceName.trim()}>{busy ? 'Working…' : 'Create workspace'}</button>
          </form>
          <form className="portal-card portal-form" onSubmit={handleJoin}>
            <p className="eyebrow">Have an invite?</p><h2>Join by code</h2>
            <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="8-character code" maxLength="8" disabled={busy} />
            <button className="primary-action" disabled={busy || joinCode.trim().length !== 8}>{busy ? 'Working…' : 'Join workspace'}</button>
          </form>
        </aside>
      </section>
    </main>
  );
}
