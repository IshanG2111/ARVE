import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="page-container footer-inner">
        <div className="footer-brand">
          <div className="brand-name" style={{ fontSize: '13px' }}>
            <div className="brand-icon" style={{ width: '18px', height: '18px', fontSize: '9px' }}>A</div>
            ARVE
          </div>
          <span className="footer-text">
            Adaptive Remediation &amp; Verification Engine • Built for GitHub Security Workflow
          </span>
        </div>

        <div className="footer-links">
          <span className="status-pulse" style={{ fontSize: '10.5px' }}>
            <span className="pulse-dot" />
            Engines Operational
          </span>
          <span className="footer-text">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
};
