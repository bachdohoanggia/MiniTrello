import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';
import { deleteCurrentAccount, ensureCurrentUser } from './services/workspaceService.js';

const AuthContext = createContext(null);
const GOOGLE_ACCOUNT_CHOOSER_KEY = 'minitrello:choose-google-account-next-login';

function shouldChooseGoogleAccount() {
  try {
    return window.localStorage.getItem(GOOGLE_ACCOUNT_CHOOSER_KEY) === 'true';
  } catch {
    return false;
  }
}

function setChooseGoogleAccount(required) {
  try {
    if (required) window.localStorage.setItem(GOOGLE_ACCOUNT_CHOOSER_KEY, 'true');
    else window.localStorage.removeItem(GOOGLE_ACCOUNT_CHOOSER_KEY);
  } catch {
    // Authentication still works when browser storage is unavailable.
  }
}

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
    const chooseAccount = shouldChooseGoogleAccount();
    const options = { redirectTo: `${window.location.origin}/` };
    if (chooseAccount) {
      options.queryParams = { prompt: 'select_account' };
      setChooseGoogleAccount(false);
    }

    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options,
    });
    if (loginError) {
      if (chooseAccount) setChooseGoogleAccount(true);
      throw loginError;
    }
  }

  async function logout() {
    if (!supabase) return;
    setChooseGoogleAccount(true);
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

  async function deleteAccount(confirmationEmail) {
    const result = await deleteCurrentAccount(confirmationEmail);

    // The Auth Admin deletion happens on the server. Clear the browser copy
    // immediately because its access token can otherwise remain usable until
    // the token expires.
    setChooseGoogleAccount(true);
    const { error: localSignOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (localSignOutError) console.warn('Account deleted, but local sign-out reported:', localSignOutError);
    preparedUserId.current = null;
    setSession(null);
    setProfile(null);
    setError('');
    setLoading(false);
    return result;
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
    deleteAccount,
    configured: hasSupabaseConfig,
  }), [session, profile, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
