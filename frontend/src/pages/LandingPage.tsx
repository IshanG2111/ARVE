import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();

  return (
    <div className="landing-root">
      <div className="landing-card">
        <div className="card" style={{ padding: '44px 40px' }}>

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
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                Connecting…
              </>
            ) : (
              'Continue with GitHub'
            )}
          </button>

          <div className="landing-features">
            <span className="landing-feature">OAuth 2.0</span>
            <span className="landing-feature">·</span>
            <span className="landing-feature">No password stored</span>
            <span className="landing-feature">·</span>
            <span className="landing-feature">JWT sessions</span>
          </div>
        </div>

        <p className="landing-footer">
          GitHub scopes: <code>read:user user:email repo</code>
        </p>
      </div>
    </div>
  );
};
