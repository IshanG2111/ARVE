import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const s = (status || 'UNKNOWN').toUpperCase();

  let bg = 'var(--elevated)';
  let color = 'var(--secondary)';
  let border = 'var(--border)';
  let IconComponent: React.ComponentType<{ size: number; className?: string; style?: React.CSSProperties }> = Clock;
  let isSpinning = false;
  let label = s;

  switch (s) {
    case 'COMPLETED':
    case 'SUCCESS':
    case 'VERIFIED':
    case 'RESOLVED':
    case 'INGESTED':
      bg = 'var(--success-bg)';
      color = 'var(--success)';
      border = 'var(--success-border)';
      IconComponent = CheckCircle2;
      label = s === 'INGESTED' ? 'Ingested' : s === 'COMPLETED' ? 'Completed' : s === 'VERIFIED' ? 'Verified' : 'Resolved';
      break;

    case 'SCANNING':
    case 'INGESTING':
    case 'PROCESSING':
    case 'FETCHING':
    case 'NORMALIZING':
      bg = 'var(--info-bg)';
      color = 'var(--info)';
      border = 'var(--info-border)';
      IconComponent = RefreshCw;
      isSpinning = true;
      label = s === 'SCANNING' ? 'Scanning…' : s === 'INGESTING' ? 'Ingesting…' : 'Processing…';
      break;

    case 'QUEUED':
    case 'PENDING':
    case 'OPEN':
      bg = 'var(--warning-bg)';
      color = 'var(--warning)';
      border = 'var(--warning-border)';
      IconComponent = Clock;
      label = s === 'QUEUED' ? 'Queued' : s === 'PENDING' ? 'Pending' : 'Open';
      break;

    case 'PARTIAL':
    case 'SUPPRESSED':
    case 'FALSE_POSITIVE':
    case 'SKIPPED':
      bg = 'var(--elevated-2)';
      color = 'var(--muted)';
      border = 'var(--border-strong)';
      IconComponent = AlertTriangle;
      label = s === 'SUPPRESSED' ? 'Suppressed' : s === 'FALSE_POSITIVE' ? 'False Positive' : s === 'SKIPPED' ? 'Skipped' : 'Partial';
      break;

    case 'FAILED':
    case 'ERROR':
    case 'CANCELLED':
      bg = 'var(--critical-bg)';
      color = 'var(--critical)';
      border = 'var(--critical-border)';
      IconComponent = XCircle;
      label = s === 'FAILED' ? 'Failed' : s === 'CANCELLED' ? 'Cancelled' : 'Error';
      break;

    default:
      label = s;
      break;
  }

  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11;
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
        gap: '4.5px',
        fontWeight: 550,
        fontFamily: 'var(--font-code)',
        borderRadius: 'var(--radius-xs)',
        lineHeight: 1.2,
      }}
      title={`Status: ${s}`}
    >
      {showIcon && (
        <IconComponent
          size={iconSize}
          className={isSpinning ? 'spin' : ''}
          style={{ flexShrink: 0 }}
        />
      )}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
