import React from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { GitBranch, Globe, ShieldCheck } from 'lucide-react';
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
    <div className="metrics-grid-container" style={{ marginBottom: '28px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Repositories */}
        <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.06)">
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Repositories
              </span>
              <GitBranch size={15} color="var(--accent)" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
              {totalProjects}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '2px' }}>
              Connected codebase{totalProjects !== 1 ? 's' : ''}
            </div>
          </div>
        </SpotlightCard>

        {/* Target Domains */}
        <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.06)">
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Target Domains
              </span>
              <Globe size={15} color="var(--accent)" />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
              {totalTargets}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '2px' }}>
              {verifiedTargets} authorized domain{verifiedTargets !== 1 ? 's' : ''}
            </div>
          </div>
        </SpotlightCard>

        {/* Authorization Rate */}
        <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.06)">
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Authorized Rate
              </span>
              <ShieldCheck size={15} color={authRate === 100 && totalTargets > 0 ? 'var(--success)' : 'var(--muted)'} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
              {authRate}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '2px' }}>
              {totalTargets === 0 ? 'No targets configured' : `${verifiedTargets} of ${totalTargets} endpoints verified`}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};
