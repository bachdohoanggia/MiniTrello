import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';
import { ensureCurrentUser } from './services/workspaceService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prepareSequence = useRef(0);
  const preparedUserId = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function prepare(nextSession) {
      const sequence = ++prepareSequence.current;
      preparedUserId.current = nextSession?.user?.id || null;
      setSession(nextSession);
      setError('');

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextProfile = await ensureCurrentUser();
        if (active && sequence === prepareSequence.current) setProfile(nextProfile);
      } catch (err) {
        if (active && sequence === prepareSequence.current) {
          setProfile(null);
          setError(err.message || 'Unable to prepare your account.');
        }
      } finally {
        if (active && sequence === prepareSequence.current) setLoading(false);
      }
    }

    function handleAuthSession(nextSession) {
      const nextUserId = nextSession?.user?.id || null;

      // Supabase may emit SIGNED_IN/TOKEN_REFRESHED again when a browser tab
      // regains focus. The identity did not change, so refresh the token
      // silently instead of rebuilding the profile and covering the app.
      if (nextUserId && nextUserId === preparedUserId.current) {
        setSession(nextSession);
        return;
      }

      prepare(nextSession);
    }

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        if (active) return handleAuthSession(data.session);
      })
      .catch((err) => {
        if (active) { setError(err.message); setLoading(false); }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => { if (active) handleAuthSession(nextSession); }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function login() {
    if (!supabase) throw new Error('Supabase configuration is missing.');
    setError('');
    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (loginError) throw loginError;
  }

  async function logout() {
    if (!supabase) return;
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) throw logoutError;
  }

  async function linkGoogleIdentity() {
    const { data, error: linkError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (linkError) throw linkError;
    return data;
  }

  async function getUserIdentities() {
    const { data, error: identitiesError } = await supabase.auth.getUserIdentities();
    if (identitiesError) throw identitiesError;
    return data.identities || [];
  }

  async function unlinkIdentity(identity) {
    const { data, error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
    if (unlinkError) throw unlinkError;
    return data;
  }

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    setProfile,
    loading,
    error,
    login,
    logout,
    linkGoogleIdentity,
    getUserIdentities,
    unlinkIdentity,
    configured: hasSupabaseConfig,
  }), [session, profile, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
