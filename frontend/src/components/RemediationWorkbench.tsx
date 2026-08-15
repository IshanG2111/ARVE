import React, { useState } from 'react';
import { GitCommit, CheckCircle2, RefreshCw, ShieldCheck, ArrowDown } from 'lucide-react';
import { AnimatedTabs } from './ui/AnimatedTabs';

export const RemediationWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'graph' | 'diff' | 'verify'>('graph');
  const [verifiedStep, setVerifiedStep] = useState(false);

  return (
    <div className="card" id="remediation-workbench" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Workbench Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>
            Remediation Workbench • Attack Vector Simulation
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '1px' }}>
            IDOR / BOLA Vulnerability Analysis & AST Verification
          </div>
        </div>

        <AnimatedTabs
          tabs={[
            { id: 'graph', label: 'Attack Path Graph' },
            { id: 'diff', label: 'Auto Patch Diff' },
            { id: 'verify', label: 'Deterministic Sandbox' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'graph' | 'diff' | 'verify')}
          layoutIdPrefix="workbench-tabs"
        />
      </div>

      {/* Workbench Body */}
      <div style={{ padding: '22px 24px' }}>
        {activeTab === 'graph' && (
          <div className="anim-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {/* Step 1: Ingress */}
            <div
              style={{
                width: '100%',
                maxWidth: '580px',
                padding: '12px 16px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                  HTTP GET /api/users/:id
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                  Ingress Controller • FastAPI REST Endpoint
                </div>
              </div>
              <span className="badge badge-neutral">Entrypoint</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', padding: '2px 0' }}>
              <ArrowDown size={12} /> untrusted request parameter: id
            </div>

            {/* Step 2: Vulnerable Node */}
            <div
              style={{
                width: '100%',
                maxWidth: '580px',
                padding: '12px 16px',
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--critical)' }}>
                  Missing Tenant / User Authorization Guard
                </div>
                <div style={{ fontSize: '11px', color: 'var(--secondary)', fontFamily: 'var(--font-code)' }}>
                  CWE-639: Insecure Direct Object Reference (BOLA)
                </div>
              </div>
              <span className="badge badge-critical">Vulnerability</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', padding: '2px 0' }}>
              <ArrowDown size={12} /> unverified query filter
            </div>

            {/* Step 3: Sink */}
            <div
              style={{
                width: '100%',
                maxWidth: '580px',
                padding: '12px 16px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                  db.query(User).filter(User.id == id).first()
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                  SQLAlchemy Query Sink • Primary Key Lookup
                </div>
              </div>
              <span className="badge badge-neutral">Database Sink</span>
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="anim-fade-up" style={{ fontFamily: 'var(--font-code)', fontSize: '12px', lineHeight: '1.75' }}>
            <div style={{ color: 'var(--muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
              <GitCommit size={14} color="var(--accent)" />
              <span>// Deterministic AST Patch: ARVE-2026-004</span>
            </div>
            <div
              style={{
                background: 'var(--terminal-bg)',
                color: 'var(--terminal-text)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <div>&nbsp;&nbsp;@router.get("/users/{'{'}id{'}'}")</div>
              <div>&nbsp;&nbsp;async def get_user_profile(id: str, current_user: User = Depends(get_current_user)):</div>
              <div style={{ background: 'rgba(225, 29, 72, 0.15)', color: '#FDA4AF', padding: '2px 6px', borderRadius: '3px', textDecoration: 'line-through', margin: '4px 0' }}>
                - &nbsp;&nbsp;&nbsp;&nbsp;user = db.query(User).filter(User.id == id).first()
              </div>
              <div style={{ background: 'rgba(22, 163, 74, 0.18)', color: '#86EFAC', padding: '2px 6px', borderRadius: '3px', margin: '4px 0' }}>
                + &nbsp;&nbsp;&nbsp;&nbsp;if current_user.id != id and not current_user.is_admin:
              </div>
              <div style={{ background: 'rgba(22, 163, 74, 0.18)', color: '#86EFAC', padding: '2px 6px', borderRadius: '3px', margin: '4px 0' }}>
                + &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;raise HTTPException(status_code=403, detail="Forbidden object access")
              </div>
              <div style={{ background: 'rgba(22, 163, 74, 0.18)', color: '#86EFAC', padding: '2px 6px', borderRadius: '3px', margin: '4px 0' }}>
                + &nbsp;&nbsp;&nbsp;&nbsp;user = db.query(User).filter(User.id == current_user.id).first()
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;return user</div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="anim-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
              Deterministic AST Verification Sandbox
            </div>

            <div
              style={{
                background: 'var(--elevated)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-code)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} />
                <span>AST Graph Structural Invariant: Passed</span>
              </div>
              <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} />
                <span>Context Ingress Parameter Sanitization: Verified</span>
              </div>
              <div style={{ color: verifiedStep ? 'var(--success)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {verifiedStep ? (
                  <>
                    <CheckCircle2 size={14} color="var(--success)" />
                    <span>Zero-Regression Target Integration Suite: All 18 tests passed</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} className="spin" color="var(--accent)" />
                    <span>Executing target integration test suite…</span>
                  </>
                )}
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start', fontSize: '12px', gap: '6px' }}
              onClick={() => setVerifiedStep(!verifiedStep)}
              id="toggle-verify-sim"
            >
              <ShieldCheck size={14} color="var(--accent)" />
              {verifiedStep ? 'Reset Sandbox Simulation' : 'Execute Deterministic Verification'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
