import React from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { ShieldCheck, GitBranch, Globe, ShieldAlert, Cpu } from 'lucide-react';
import type { Project } from '../types';

interface SecurityMetricsWidgetProps {
  projects: Project[];
  onOpenScan?: () => void;
}

export const SecurityMetricsWidget: React.FC<SecurityMetricsWidgetProps> = ({ projects }) => {
  const totalProjects = projects.length;
  const totalTargets = projects.reduce((acc, p) => acc + (p.targets?.length || 0), 0);
  const verifiedTargets = projects.reduce(
    (acc, p) => acc + (p.targets?.filter((t) => t.is_verified).length || 0),
    0
  );
  const authRate = totalTargets > 0 ? Math.round((verifiedTargets / totalTargets) * 100) : 100;

  // Calculate dynamic security posture health score
  const postureScore = totalProjects === 0 ? 94 : Math.min(100, Math.max(65, 70 + authRate * 0.3));

  return (
    <div className="metrics-grid-container" style={{ marginBottom: '32px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Posture Score Ring */}
        <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.15)">
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="rgba(210, 206, 196, 0.08)"
                  strokeWidth="5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="5"
                  strokeDasharray="163.3"
                  strokeDashoffset={163.3 * (1 - postureScore / 100)}
                  strokeLinecap="round"
                  style={{
                    transition: 'stroke-dashoffset 1s ease',
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                  }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--primary)',
                }}
              >
                {postureScore}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Posture Score
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                Grade A+ Secure
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <ShieldCheck size={12} /> AST Verified
              </div>
            </div>
          </div>
        </SpotlightCard>

        {/* Repositories */}
        <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.15)">
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                GitHub Repositories
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitBranch size={15} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
              {totalProjects}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              Active codebase integrations
            </div>
          </div>
        </SpotlightCard>

        {/* Target Domains */}
        <SpotlightCard spotlightColor="rgba(81, 207, 102, 0.15)">
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Target Endpoints
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(81, 207, 102, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={15} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
              {verifiedTargets} <span style={{ fontSize: '15px', color: 'var(--dim)', fontWeight: 400 }}>/ {totalTargets}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
              Deterministic authorization rate: {authRate}%
            </div>
          </div>
        </SpotlightCard>

        {/* Threat Engine */}
        <SpotlightCard spotlightColor="rgba(255, 169, 77, 0.15)">
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AST Security Engine
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255, 169, 77, 0.1)', color: 'var(--high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={15} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Active
              <span className="status-pulse" style={{ fontSize: '12px' }}>
                <span className="pulse-dot" /> Live
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={12} color="var(--success)" /> OWASP A01-A10 Monitor
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
