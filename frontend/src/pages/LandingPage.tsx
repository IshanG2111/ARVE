import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { RemediationWorkbench } from '../components/RemediationWorkbench';
import { Footer } from '../components/Footer';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();

  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* Hero Section */}
        <section className="hero-section anim-fade-up">
          <div className="hero-pill">
            <span className="pulse-dot" />
            ARVE Security Platform v1.0 • Autonomous Vulnerability Engine
          </div>

          <h1 className="hero-title">
            Adaptive Vulnerability Remediation &amp; Verification for GitHub
          </h1>

          <p className="hero-subtitle">
            Instantly map complex AST attack graphs, auto-generate context-aware code patches,
            and deterministically verify security fixes across your GitHub repositories.
          </p>

          <div className="hero-actions">
            <button
              className="btn-github-hero"
              onClick={login}
              disabled={loading}
              id="github-signin-btn"
            >
              {loading ? (
                <>
                  <div
                    className="spinner"
                    style={{
                      width: '16px',
                      height: '16px',
                      borderWidth: '2px',
                      borderColor: 'rgba(0,0,0,0.15)',
                      borderTopColor: 'var(--bg)'
                    }}
                  />
                  Connecting to GitHub…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </>
              )}
            </button>
          </div>

          <div className="hero-stats-ticker">
            <div className="ticker-item">
              <span className="ticker-value">&lt;50ms</span>
              <span className="ticker-label">AST Path Graphing</span>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
            <div className="ticker-item">
              <span className="ticker-value">100%</span>
              <span className="ticker-label">Deterministic Verification</span>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
            <div className="ticker-item">
              <span className="ticker-value">OAuth 2.0</span>
              <span className="ticker-label">Scoped GitHub Access</span>
            </div>
          </div>
        </section>

        {/* Live Workbench Interactive Demo */}
        <section className="workbench-section" id="workbench-section">
          <RemediationWorkbench />
        </section>

        {/* Platform Capabilities */}
        <section className="features-section" id="features-section">
          <div className="section-head">
            <h2 className="section-title">Engine Capabilities</h2>
            <p className="section-sub">
              Engineered for modern DevSecOps teams requiring precision and rapid remediation.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </div>
              <h3 className="feature-title">AST Attack Path Mapping</h3>
              <p className="feature-desc">
                Trace un-sanitized ingress parameters across controller routes down to SQL queries and data models.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <h3 className="feature-title">Deterministic Verification</h3>
              <p className="feature-desc">
                Validate generated patches against target test suites before committing back to repository branches.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 22v-4a48.4 48.4 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                  <path d="M9 18c-4.51 2-5-2-7-2"/>
                </svg>
              </div>
              <h3 className="feature-title">Native GitHub Integration</h3>
              <p className="feature-desc">
                Direct OAuth 2.0 authentication with scoped access (`read:user`, `repo`) for seamless repository sync.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="feature-title">Zero Snippet Retention</h3>
              <p className="feature-desc">
                Source code snippets are processed in volatile sandbox memory and never stored in long-term DB storage.
              </p>
            </div>
          </div>
        </section>

        {/* Security & Compliance Banner */}
        <section className="trust-section" id="trust-section">
          <div className="trust-card">
            <div className="trust-content">
              <h3 className="trust-title">Built for Enterprise Security Workflows</h3>
              <p className="trust-desc">
                ARVE utilizes strict OAuth 2.0 PKCE authentication with JWT session cookies.
                Granted repository access is strictly isolated per authenticated user session.
              </p>
            </div>

            <div className="trust-badges">
              <span className="badge badge-neutral">GitHub OAuth 2.0</span>
              <span className="badge badge-neutral">JWT Encrypted</span>
              <span className="badge badge-ok">OWASP Top 10 Aligned</span>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};
