import React from 'react';
import { RemediationWorkbench } from '../components/RemediationWorkbench';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { Zap } from 'lucide-react';

export const WorkbenchPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 54px)', position: 'relative', zIndex: 1 }}>
      <HalftoneBackground interactive={false} showHero={false} />

      <div className="dashboard anim-fade-up">
        {/* Page Header */}
        <div className="dashboard-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>
                <Zap size={12} /> Deterministic Sandbox
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                Zero-Regression Patch Simulator
              </span>
            </div>
            <h1 className="dashboard-title">Security Remediation Workbench</h1>
            <p className="dashboard-sub">
              Inspect visual attack path graphs, review synthesized syntax diff candidates, and test fixes in deterministic verification sandboxes.
            </p>
          </div>
        </div>

        {/* Feature Star: Remediation Workbench */}
        <RemediationWorkbench />
      </div>
    </div>
  );
};
