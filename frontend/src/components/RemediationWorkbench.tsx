import React, { useState } from 'react';
import { GitCommit, FileCode, CheckCircle2, RefreshCw } from 'lucide-react';

export const RemediationWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'graph' | 'diff' | 'verify'>('graph');
  const [verifiedStep, setVerifiedStep] = useState(false);

  return (
    <div className="card anim-fade-up" id="remediation-workbench" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Workbench Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
          Security Remediation Simulator • OWASP-A01 Broken Auth
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            className="filter-tab"
            style={{
              background: activeTab === 'graph' ? 'var(--elevated)' : 'transparent',
              color: activeTab === 'graph' ? 'var(--primary)' : 'var(--muted)',
            }}
            onClick={() => setActiveTab('graph')}
            id="tab-graph"
          >
            Attack Path Graph
          </button>
          <button
            className="filter-tab"
            style={{
              background: activeTab === 'diff' ? 'var(--elevated)' : 'transparent',
              color: activeTab === 'diff' ? 'var(--primary)' : 'var(--muted)',
            }}
            onClick={() => setActiveTab('diff')}
            id="tab-diff"
          >
            Auto Patch Diff
          </button>
          <button
            className="filter-tab"
            style={{
              background: activeTab === 'verify' ? 'var(--elevated)' : 'transparent',
              color: activeTab === 'verify' ? 'var(--primary)' : 'var(--muted)',
            }}
            onClick={() => setActiveTab('verify')}
            id="tab-verify"
          >
            Deterministic Verification
          </button>
        </div>
      </div>

      {/* Workbench Body */}
      <div style={{ padding: '24px' }}>
        {activeTab === 'graph' && (
          <div className="anim-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '100%',
                maxWidth: '640px',
                padding: '14px 18px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>HTTP GET /api/users/:id</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Public Ingress Route • REST Controller</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Entry</span>
            </div>

            <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
              ↓ untrusted req.params.id
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: '640px',
                padding: '14px 18px',
                background: 'rgba(255, 107, 107, 0.08)',
                border: '1px solid var(--critical)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--critical)' }}>
                  Missing Authorization Guard
                </div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', fontFamily: 'var(--font-code)' }}>CWE-639: Insecure Direct Object Reference (IDOR)</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--critical)', fontFamily: 'var(--font-code)' }}>Vulnerability</span>
            </div>

            <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
              ↓ unverified query sink
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: '640px',
                padding: '14px 18px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>db.users.findOne({ '{ _id: id }' })</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>PostgreSQL / MongoDB Data Layer</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Sink</span>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="anim-slide-in" style={{ fontFamily: 'var(--font-code)', fontSize: '12px', lineHeight: '1.75' }}>
            <div style={{ color: 'var(--muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitCommit size={14} color="var(--accent)" />
              <span>// ARVE Patch Candidate ARVE-2026-004</span>
            </div>
            <div style={{ background: 'var(--bg)', padding: '16px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div>&nbsp;&nbsp;export async function getUser(req: Request, res: Response) {'{'}</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;const {'{ id }'} = req.params;</div>
              <div style={{ background: 'rgba(255, 107, 107, 0.12)', color: '#FF8787', padding: '2px 6px', borderRadius: '3px', textDecoration: 'line-through', margin: '4px 0' }}>
                - &nbsp;&nbsp;const user = await User.findById(id);
              </div>
              <div style={{ background: 'rgba(81, 207, 102, 0.12)', color: '#6EE7B7', padding: '2px 6px', borderRadius: '3px', margin: '4px 0' }}>
                + &nbsp;&nbsp;if (req.user.id !== id &amp;&amp; !req.user.isAdmin) throw new UnauthorizedError();
              </div>
              <div style={{ background: 'rgba(81, 207, 102, 0.12)', color: '#6EE7B7', padding: '2px 6px', borderRadius: '3px', margin: '4px 0' }}>
                + &nbsp;&nbsp;const user = await User.findOwnedUser(id, req.user.tenantId);
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;return res.json(user);</div>
              <div>&nbsp;&nbsp;{'}'}</div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="anim-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              DETERMINISTIC VERIFICATION SANDBOX
            </div>

            <div
              style={{
                background: 'var(--bg)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-code)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} />
                <span>Step 1: AST Structural Integrity Passed</span>
              </div>
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} />
                <span>Step 2: Ingress Parameter Sanitization Verified</span>
              </div>
              <div style={{ color: verifiedStep ? 'var(--success)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {verifiedStep ? (
                  <>
                    <CheckCircle2 size={14} color="var(--success)" />
                    <span>Step 3: Zero-Regression Target Test Suite Passed</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} className="animate-spin" color="var(--accent)" />
                    <span>Step 3: Executing Target Regression Suite...</span>
                  </>
                )}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start', fontSize: '12px' }}
              onClick={() => setVerifiedStep(!verifiedStep)}
              id="toggle-verify-sim"
            >
              <FileCode size={14} />
              {verifiedStep ? 'Reset Simulation' : 'Run Verification Sandbox'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
