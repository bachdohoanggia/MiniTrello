import { useEffect, useState } from 'react';
import {
  fetchUserDashboard,
  selectGoogleLoginIdentity,
  updateUserProfile,
} from '../services/workspaceService.js';

function identityEmail(identity) {
  return identity?.identity_data?.email || 'Google account';
}

function friendlyIdentityError(error, currentEmail) {
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const detail = String(error?.message || error?.error_description || '').toLowerCase();

  if (code === 'identity_already_exists' || detail.includes('identity already')) {
    if (detail.includes('another user') || detail.includes('different user')) {
      return 'This Gmail already belongs to another MiniTrello account, so it cannot be used here.';
    }
    return `${currentEmail} is already your current login Gmail. Please choose a different Google account.`;
  }
  if (code === 'email_exists' || detail.includes('already used by another minitrello account')) {
    return 'This Gmail already belongs to another MiniTrello account, so it cannot be used here.';
  }
  if (code === 'manual_linking_disabled') {
    return 'Connecting another Gmail is disabled in Supabase. Enable manual identity linking and try again.';
  }
  return error?.message || error?.error_description || 'Unable to connect this Google account.';
}

export default function AccountPage({
  profile,
  onProfileChange,
  onNavigate,
  onLogout,
  onLinkGoogleIdentity,
  onGetUserIdentities,
  onUnlinkIdentity,
}) {
  const [name, setName] = useState(profile.display_name);
  const [identities, setIdentities] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const hasNewGoogleIdentity = identities.some(
    (identity) => identityEmail(identity).toLowerCase() !== profile.email.toLowerCase(),
  );

  async function loadIdentities() {
    const nextIdentities = await onGetUserIdentities();
    setIdentities(nextIdentities.filter((identity) => identity.provider === 'google'));
  }

  useEffect(() => {
    Promise.all([fetchUserDashboard(), onGetUserIdentities()])
      .then(([data, nextIdentities]) => {
        setName(data.user.display_name);
        setIdentities(nextIdentities.filter((identity) => identity.provider === 'google'));
      })
      .catch((err) => setError(err.message));
  }, [onGetUserIdentities]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get('error');
    const callbackCode = params.get('error_code');
    const callbackDescription = params.get('error_description');
    if (!callbackError && !callbackCode && !callbackDescription) return;

    setError(friendlyIdentityError({
      code: callbackCode || callbackError,
      message: callbackDescription || callbackError,
    }, profile.email));
    window.history.replaceState({}, '', window.location.pathname);
  }, [profile.email]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const user = await updateUserProfile(name.trim());
      setName(user.display_name);
      onProfileChange(user);
      setMessage('Account name updated.');
    } catch (err) { setError(err.message || 'Unable to update account.'); }
    finally { setBusy(false); }
  }

  async function handleLinkGoogle() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await onLinkGoogleIdentity();
    } catch (err) {
      setError(friendlyIdentityError(err, profile.email));
      setBusy(false);
    }
  }

  async function handleUseIdentity(identity) {
    if (busy) return;
    if (identityEmail(identity).toLowerCase() === profile.email.toLowerCase()) {
      setMessage('');
      setError(`${profile.email} is already your current login Gmail. Please choose a different Google account.`);
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const selectedIdentityId = identity.identity_id || identity.id;
      const updatedProfile = await selectGoogleLoginIdentity(selectedIdentityId);
      const oldGoogleIdentities = identities.filter(
        (item) => (item.identity_id || item.id) !== selectedIdentityId,
      );
      for (const oldIdentity of oldGoogleIdentities) {
        await onUnlinkIdentity(oldIdentity);
      }
      onProfileChange(updatedProfile);
      await loadIdentities();
      setMessage(`Login Gmail changed to ${updatedProfile.email}. Your UUID, workspaces and roles were preserved.`);
    } catch (err) {
      setError(friendlyIdentityError(err, profile.email));
    } finally { setBusy(false); }
  }

  return (
    <main className="portal-shell account-shell">
      <button type="button" className="portal-back" onClick={() => onNavigate('/')}>← Back to workspaces</button>
      <section className="portal-card account-card">
        <p className="eyebrow">My Account</p><h1>Profile settings</h1>
        {error && <div className="portal-error">{error}</div>}
        {message && <div className="portal-success">{message}</div>}
        <form className="account-section" onSubmit={handleSubmit}>
          <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
          <label>Login Gmail<input value={profile.email} disabled /></label>
          <p className="account-note">Global role: <strong>{profile.global_role}</strong></p>
          <button type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>

        <div className="account-divider" />
        <div className="account-section">
          <h2>Change login Gmail</h2>
          <p className="account-note">Connect the new Google account first. Both accounts temporarily belong to the same MiniTrello UUID. Choosing the new one removes the old Google login while preserving every workspace and role.</p>

          {hasNewGoogleIdentity ? (
            <div className="account-step account-step-complete">
              <span>✓</span>
              <div><strong>New login Gmail connected</strong><p>Continue to step 2 below. You do not need to connect it again.</p></div>
            </div>
          ) : (
            <>
              <div className="account-step"><span>1</span><div><strong>Connect your new login Gmail</strong><p>In the Google popup, choose the Gmail you want to use from now on.</p></div></div>
              <button type="button" onClick={handleLinkGoogle} disabled={busy}>Connect new login Gmail</button>
            </>
          )}

          <div className="account-step"><span>2</span><div><strong>Choose the Gmail to keep</strong><p>{hasNewGoogleIdentity ? 'Select the newly connected Gmail below to finish.' : 'Step 2 becomes available after you connect a new Gmail.'}</p></div></div>
          <div className="identity-list">
            {identities.map((identity) => {
              const email = identityEmail(identity);
              const isCurrent = email.toLowerCase() === profile.email.toLowerCase();
              return (
                <div className="current-account-card" key={identity.identity_id || identity.id}>
                  <span>{isCurrent ? 'Current login Gmail' : 'Connected Google account'}</span>
                  <strong>{email}</strong>
                  {isCurrent ? (
                    <span>Currently used by MiniTrello</span>
                  ) : (
                    <button type="button" onClick={() => handleUseIdentity(identity)} disabled={busy}>
                      {busy ? 'Switching…' : `Use ${email} as login`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <button type="button" className="secondary" onClick={onLogout}>Sign out</button>
      </section>
    </main>
  );
}
