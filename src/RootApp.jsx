import { useCallback, useEffect, useMemo, useState } from 'react';
import App from './App.jsx';
import LoginPage from './components/LoginPage.jsx';
import UserDashboard from './components/UserDashboard.jsx';
import AccountPage from './components/AccountPage.jsx';
import WorkspaceSettings from './components/WorkspaceSettings.jsx';
import { fetchWorkspaceContext } from './services/workspaceService.js';
import { supabase } from './supabaseClient.js';
import { useAuth } from './AuthContext.jsx';

function readRoute() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts.length === 1 && parts[0] === 'login') return { name: 'login' };
  if (parts.length === 1 && parts[0] === 'account') return { name: 'account' };
  if (parts.length === 2 && parts[0] === 'workspace') return { name: 'workspace', workspaceId: parts[1] };
  return { name: 'not-found' };
}

export default function RootApp() {
  const { user, profile, loading: authLoading, error: authError, setProfile, logout, linkGoogleIdentity, getUserIdentities, unlinkIdentity } = useAuth();
  const [route, setRoute] = useState(readRoute);
  const [workspaceContext, setWorkspaceContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const userId = user?.id || null;
  const profileId = profile?.id || null;
  const routeName = route.name;
  const workspaceId = route.workspaceId || null;

  const navigate = useCallback((path) => {
    window.history.pushState({}, '', path);
    setRoute(readRoute());
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    const handlePopState = () => { setRoute(readRoute()); setSettingsOpen(false); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId && routeName !== 'login') navigate('/login');
    if (userId && profileId && routeName === 'login') navigate('/');
  }, [authLoading, userId, profileId, routeName, navigate]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setWorkspaceContext(null);

    if (!userId || !profileId || routeName !== 'workspace' || !workspaceId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    fetchWorkspaceContext(workspaceId)
      .then((context) => { if (!cancelled) setWorkspaceContext(context); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Unable to open this workspace.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, profileId, routeName, workspaceId]);

  useEffect(() => {
    if (!supabase || routeName !== 'workspace' || !profileId || !workspaceId) return undefined;
    let refreshTimer;
    const refreshContext = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        fetchWorkspaceContext(workspaceId).then(setWorkspaceContext).catch((err) => setError(err.message));
      }, 120);
    };
    const channel = supabase
      .channel(`workspace-context-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, refreshContext)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, refreshContext)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'workspace_members' }, refreshContext)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, refreshContext)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, refreshContext)
      .subscribe((status, channelError) => {
        if (status === 'SUBSCRIBED') refreshContext();
        console.info('Workspace Realtime status:', status, channelError || '');
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          console.error('Workspace Realtime channel failed:', status, channelError);
        }
      });
    return () => { window.clearTimeout(refreshTimer); supabase.removeChannel(channel); };
  }, [profileId, routeName, workspaceId]);

  const content = useMemo(() => {
    if (authLoading) return <PageState title="Restoring your session…" />;
    if (!user || !profile) return <LoginPage />;
    if (loading) return <PageState title="Loading MiniTrello…" />;
    if (error || authError) return <PageState title="Unable to open this page" message={error || authError} onBack={() => navigate('/')} />;

    if (route.name === 'dashboard') return <UserDashboard profile={profile} onProfileChange={setProfile} onNavigate={navigate} onLogout={logout} />;
    if (route.name === 'account') return <AccountPage profile={profile} onProfileChange={setProfile} onNavigate={navigate} onLogout={logout} onLinkGoogleIdentity={linkGoogleIdentity} onGetUserIdentities={getUserIdentities} onUnlinkIdentity={unlinkIdentity} />;
    if (route.name === 'workspace' && workspaceContext) return (
      <>
        <App key={route.workspaceId} workspaceId={route.workspaceId} workspaceContext={workspaceContext} onNavigate={navigate} onOpenSettings={() => setSettingsOpen(true)} />
        <WorkspaceSettings isOpen={settingsOpen} workspaceId={route.workspaceId} context={workspaceContext} onClose={() => setSettingsOpen(false)} onContextChange={setWorkspaceContext} onDeleted={() => navigate('/')} />
      </>
    );
    return <PageState title="Page not found" message="Check the workspace URL." onBack={() => navigate('/')} />;
  }, [authError, authLoading, error, getUserIdentities, linkGoogleIdentity, loading, logout, navigate, profile, route, setProfile, settingsOpen, unlinkIdentity, user, workspaceContext]);

  return content;
}

function PageState({ title, message, onBack }) {
  return <main className="portal-shell"><section className="portal-card page-state-card"><div className="brand-mark">MT</div><h1>{title}</h1>{message && <p>{message}</p>}{onBack && <button type="button" onClick={onBack}>Back to dashboard</button>}</section></main>;
}
