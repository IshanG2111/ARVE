import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="page-container footer-inner">
        <div className="footer-brand">
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--primary)' }}>
            ARVE
          </span>
          <span className="footer-text">
            Adaptive Remediation &amp; Verification Engine • Built for GitHub Security Workflow
          </span>
        </div>

        <div className="footer-links">
          <span className="status-pulse" style={{ fontSize: '10.5px' }}>
            <span className="pulse-dot" />
            Engines Active
          </span>
          <span className="footer-text">v1.0</span>
        </div>
      </div>
    </footer>
  );
};
