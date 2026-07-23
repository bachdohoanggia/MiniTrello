import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';

export default function LoginPage() {
  const { login, configured, error: authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setBusy(true); setError('');
    try { await login(); }
    catch (err) { setError(err.message || 'Google sign-in failed.'); setBusy(false); }
  }

  return (
    <main className="portal-shell login-shell">
      <section className="portal-card login-card">
        <div className="login-copy">
          <div className="login-brand">
            <div className="brand-mark">MT</div>
            <div><p className="eyebrow">MiniTrello</p><strong>Work, made visible.</strong></div>
          </div>

          <div className="login-heading">
            <span className="login-kicker">Your shared workspace</span>
            <h1>Organize work.<br />Move forward.</h1>
            <p>Create boards, collaborate with your team and keep every task moving—all in one simple place.</p>
          </div>

          <div className="login-benefits" aria-label="MiniTrello features">
            <span>✓ Visual task boards</span>
            <span>✓ Live team updates</span>
            <span>✓ Workspaces and roles</span>
          </div>

          {(error || authError) && <div className="portal-error">{error || authError}</div>}
          {!configured && <div className="portal-error">Supabase environment variables are missing.</div>}
          <button className="google-login-button" type="button" onClick={handleLogin} disabled={busy || !configured}>
            <span className="google-mark" aria-hidden="true">G</span>
            {busy ? 'Connecting…' : 'Continue with Google'}
          </button>
          <p className="login-footnote">New here? Your MiniTrello account is created automatically after you continue.</p>
        </div>

        <div className="login-preview" aria-hidden="true">
          <div className="preview-glow preview-glow-one" />
          <div className="preview-glow preview-glow-two" />
          <div className="preview-window">
            <div className="preview-toolbar">
              <div><span className="preview-logo">MT</span><strong>Launch plan</strong></div>
              <span className="preview-people">A&nbsp;&nbsp;B&nbsp;&nbsp;+2</span>
            </div>
            <div className="preview-board">
              <div className="preview-column">
                <div className="preview-column-title"><strong>To do</strong><span>2</span></div>
                <div className="preview-task"><i className="task-dot task-dot-purple" />Plan new homepage<small>Today</small></div>
                <div className="preview-task"><i className="task-dot task-dot-blue" />Review content</div>
              </div>
              <div className="preview-column preview-column-active">
                <div className="preview-column-title"><strong>In progress</strong><span>2</span></div>
                <div className="preview-task"><i className="task-dot task-dot-red" />Build sign-in flow<small>High priority</small></div>
                <div className="preview-task"><i className="task-dot task-dot-green" />Connect Realtime</div>
              </div>
              <div className="preview-column">
                <div className="preview-column-title"><strong>Done</strong><span>1</span></div>
                <div className="preview-task preview-task-done"><i className="task-dot task-dot-green" />Create workspace</div>
              </div>
            </div>
          </div>
          <div className="preview-live"><span />Live updates</div>
        </div>
      </section>
    </main>
  );
}
