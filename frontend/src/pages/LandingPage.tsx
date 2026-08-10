import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();

  return (
    <div className="landing-root">
      <div className="landing-card">

        <div className="landing-wordmark">ARVE</div>
        <p className="landing-tagline">
          Adaptive Remediation &amp; Verification Engine.<br />
          Connect your GitHub repositories. Manage security analysis.
        </p>

        <button
          className="btn-github"
          onClick={login}
          disabled={loading}
          id="github-signin-btn"
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(0,0,0,0.15)', borderTopColor: 'var(--bg)' }} />
              Connecting…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </>
          )}
        </button>

        <div className="landing-features">
          <span className="landing-feature">Firebase Auth</span>
          <span className="landing-feature" style={{ color: 'var(--border-active)' }}>·</span>
          <span className="landing-feature">GitHub OAuth 2.0</span>
          <span className="landing-feature" style={{ color: 'var(--border-active)' }}>·</span>
          <span className="landing-feature">JWT sessions</span>
        </div>

        <p className="landing-footer">
          Scopes: <code>read:user user:email repo</code>
        </p>
      </div>
    </div>
  );
};
