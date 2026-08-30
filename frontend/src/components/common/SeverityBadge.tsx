import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Shield } from 'lucide-react';
import type { FindingSeverity } from '@/types';

interface SeverityBadgeProps {
  severity: FindingSeverity | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  showIcon = true,
}) => {
  const norm = (severity || 'INFO').toUpperCase();

  let bg = 'var(--elevated)';
  let color = 'var(--secondary)';
  let border = 'var(--border)';
  let IconComponent = Shield;

  if (norm === 'CRITICAL') {
    bg = 'var(--critical-bg)';
    color = 'var(--critical)';
    border = 'var(--critical-border)';
    IconComponent = ShieldAlert;
  } else if (norm === 'HIGH') {
    bg = 'rgba(234, 88, 12, 0.12)';
    color = '#EA580C';
    border = 'rgba(234, 88, 12, 0.28)';
    IconComponent = AlertTriangle;
  } else if (norm === 'MEDIUM') {
    bg = 'var(--warning-bg)';
    color = 'var(--warning)';
    border = 'var(--warning-border)';
    IconComponent = AlertCircle;
  } else if (norm === 'LOW') {
    bg = 'var(--info-bg)';
    color = 'var(--info)';
    border = 'var(--info-border)';
    IconComponent = Info;
  }

  const iconSize = size === 'sm' ? 11 : size === 'lg' ? 14 : 12;
  const padding = size === 'sm' ? '1.5px 6px' : size === 'lg' ? '4px 10px' : '2.5px 7.5px';
  const fontSize = size === 'sm' ? '10px' : size === 'lg' ? '12px' : '11px';

  return (
    <span
      className="badge"
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        padding,
        fontSize,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-code)',
        borderRadius: 'var(--radius-xs)',
        textTransform: 'uppercase',
      }}
      title={`Severity: ${norm}`}
    >
      {showIcon && <IconComponent size={iconSize} style={{ flexShrink: 0 }} />}
      <span>{norm}</span>
    </span>
  );
};

export default SeverityBadge;
