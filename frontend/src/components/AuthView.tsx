import React, { useState } from 'react';
import { Shield, Lock, Zap, AlertCircle } from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';
import { api, type User } from '../services/api';

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGitHubSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/github/auth-url');
      const data = await res.json();

      if (data.is_configured) {
        window.location.href = data.auth_url;
        return; // keep loading while browser navigates
      } else {
        await api.githubCallback('mock_code', true);
        const currentUser = await api.me();
        onAuthSuccess(currentUser);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'GitHub sign-in failed';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="card" style={{ padding: '32px 28px' }}>
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-shield">
              <Shield size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="auth-title">ARVE</h1>
              <p className="auth-sub">
                Sign in with GitHub to manage authorized target domains and verification.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* GitHub button */}
          <button
            className={`btn-github-cta${loading ? ' loading' : ''}`}
            onClick={handleGitHubSignIn}
            disabled={loading}
            id="github-signin-btn"
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                Connecting…
              </>
            ) : (
              <>
                <GitHubIcon size={17} />
                Continue with GitHub
              </>
            )}
          </button>

          {/* Trust row */}
          <div className="auth-trust">
            <span className="trust-item"><Lock size={10} /> OAuth 2.0</span>
            <span style={{ color: 'var(--border-hi)', fontSize: '10px' }}>·</span>
            <span className="trust-item"><Shield size={10} /> No password stored</span>
            <span style={{ color: 'var(--border-hi)', fontSize: '10px' }}>·</span>
            <span className="trust-item"><Zap size={10} /> Instant access</span>
          </div>
        </div>

        <p className="auth-footer">
          GitHub scopes:{' '}
          <code style={{ color: 'var(--text-2)' }}>user, repo</code>
        </p>
      </div>
    </div>
  );
};
