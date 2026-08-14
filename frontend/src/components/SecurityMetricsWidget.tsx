import React from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { CountUpNumber } from './ui/CountUpNumber';
import { GitBranch, Globe, ShieldCheck, Cpu } from 'lucide-react';
import type { Project } from '@/types';

interface SecurityMetricsWidgetProps {
  projects: Project[];
}

export const SecurityMetricsWidget: React.FC<SecurityMetricsWidgetProps> = ({ projects }) => {
  const totalProjects = projects.length;
  const totalTargets = projects.reduce((acc, p) => acc + (p.targets?.length || 0), 0);
  const verifiedTargets = projects.reduce(
    (acc, p) => acc + (p.targets?.filter((t) => t.is_verified).length || 0),
    0
  );
  const authRate = totalTargets > 0 ? Math.round((verifiedTargets / totalTargets) * 100) : 0;

  return (
    <div style={{ marginBottom: '28px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Connected Codebases */}
        <SpotlightCard>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Repositories
              </span>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <GitBranch size={14} />
              </div>
            </div>

            <div style={{ fontSize: '26px', fontWeight: 650, fontFamily: 'var(--font-code)', color: 'var(--primary)', lineHeight: 1.1 }}>
              <CountUpNumber value={totalProjects} />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              Linked GitHub workspace{totalProjects !== 1 ? 's' : ''}
            </div>
          </div>
        </SpotlightCard>

        {/* Target Domains */}
        <SpotlightCard>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Target Endpoints
              </span>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--info)',
                }}
              >
                <Globe size={14} />
              </div>
            </div>

            <div style={{ fontSize: '26px', fontWeight: 650, fontFamily: 'var(--font-code)', color: 'var(--primary)', lineHeight: 1.1 }}>
              <CountUpNumber value={totalTargets} />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              {verifiedTargets} authorized domain{verifiedTargets !== 1 ? 's' : ''}
            </div>
          </div>
        </SpotlightCard>

        {/* Verification / Security Health */}
        <SpotlightCard>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Verification Health
              </span>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: authRate === 100 && totalTargets > 0 ? 'var(--success)' : 'var(--warning)',
                }}
              >
                <ShieldCheck size={14} />
              </div>
            </div>

            <div style={{ fontSize: '26px', fontWeight: 650, fontFamily: 'var(--font-code)', color: 'var(--primary)', lineHeight: 1.1 }}>
              <CountUpNumber value={authRate} suffix="%" />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              {totalTargets === 0 ? 'No targets configured' : `${verifiedTargets} of ${totalTargets} endpoints authorized`}
            </div>
          </div>
        </SpotlightCard>

        {/* AST Engine Telemetry Status */}
        <SpotlightCard>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Engine Status
              </span>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                }}
              >
                <Cpu size={14} />
              </div>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '29px' }}>
              <span className="status-pulse">
                <span className="pulse-dot" /> Operational
              </span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              OWASP & AST AST graph ready
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
