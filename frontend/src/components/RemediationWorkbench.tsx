import React, { useState } from 'react';

export const RemediationWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'graph' | 'diff' | 'verify'>('graph');
  const [verifiedStep, setVerifiedStep] = useState(false);

  return (
    <div className="workbench-card anim-fade-up" id="remediation-workbench">
      <div className="workbench-header">
        <div className="workbench-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Security Remediation Simulator • OWASP-A01 Broken Auth
        </div>

        <div className="workbench-tabs">
          <button
            className={`workbench-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
            id="tab-graph"
          >
            Attack Path Graph
          </button>
          <button
            className={`workbench-tab ${activeTab === 'diff' ? 'active' : ''}`}
            onClick={() => setActiveTab('diff')}
            id="tab-diff"
          >
            Auto Patch Diff
          </button>
          <button
            className={`workbench-tab ${activeTab === 'verify' ? 'active' : ''}`}
            onClick={() => setActiveTab('verify')}
            id="tab-verify"
          >
            Deterministic Verification
          </button>
        </div>
      </div>

      <div className="workbench-body">
        {activeTab === 'graph' && (
          <div className="graph-flow anim-slide-in">
            <div className="graph-node">
              <div>
                <div className="node-title">HTTP GET /api/users/:id</div>
                <div className="node-sub">Public Ingress Route • REST Controller</div>
              </div>
              <span className="badge badge-neutral">Entry Point</span>
            </div>

            <div className="graph-arrow">↓ untrusted req.params.id</div>

            <div className="graph-node vulnerable">
              <div>
                <div className="node-title" style={{ color: 'var(--critical)' }}>
                  Missing Authorization Guard
                </div>
                <div className="node-sub">CWE-639: Insecure Direct Object Reference (IDOR)</div>
              </div>
              <span className="badge badge-warn">Vulnerability</span>
            </div>

            <div className="graph-arrow">↓ unverified query</div>

            <div className="graph-node">
              <div>
                <div className="node-title">db.users.findOne({ '{ _id: id }' })</div>
                <div className="node-sub">PostgreSQL / MongoDB Data Layer</div>
              </div>
              <span className="badge badge-neutral">Data Access</span>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="anim-slide-in" style={{ fontFamily: 'var(--font-code)', fontSize: '12px', lineHeight: '1.7' }}>
            <div style={{ color: 'var(--muted)', marginBottom: '10px' }}>
              // Remediation Candidate ARVE-2026-004
            </div>
            <div style={{ background: 'var(--elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div>&nbsp;&nbsp;export async function getUser(req: Request, res: Response) {'{'}</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;const {'{ id }'} = req.params;</div>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5', padding: '2px 4px', borderRadius: '2px', textDecoration: 'line-through' }}>
                - &nbsp;&nbsp;const user = await User.findById(id);
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6EE7B7', padding: '2px 4px', borderRadius: '2px' }}>
                + &nbsp;&nbsp;if (req.user.id !== id &amp;&amp; !req.user.isAdmin) throw new UnauthorizedError();
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6EE7B7', padding: '2px 4px', borderRadius: '2px' }}>
                + &nbsp;&nbsp;const user = await User.findOwnedUser(id, req.user.tenantId);
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;return res.json(user);</div>
              <div>&nbsp;&nbsp;{'}'}</div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="anim-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="alert alert-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>Verification Sandbox executing target test suites against proposed patch...</span>
            </div>

            <div style={{ background: 'var(--elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontFamily: 'var(--font-code)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--success)' }}>✓ Step 1: AST Structural Integrity Passed</div>
              <div style={{ color: 'var(--success)' }}>✓ Step 2: Ingress Input Sanitization Verified</div>
              <div style={{ color: verifiedStep ? 'var(--success)' : 'var(--muted)' }}>
                {verifiedStep ? '✓ Step 3: Zero-Regression Test Suite Passed' : '⟳ Step 3: Executing Regression Suite...'}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setVerifiedStep(!verifiedStep)}
              id="toggle-verify-sim"
            >
              {verifiedStep ? 'Reset Test Simulation' : 'Run Verification Sandbox'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
