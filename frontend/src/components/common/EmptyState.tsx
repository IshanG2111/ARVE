import React from 'react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) => {
  return (
    <div
      className="empty-state-card"
      style={{
        padding: compact ? '28px 20px' : '44px 28px',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: compact ? '480px' : '560px',
        margin: '24px auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {Icon && (
        <div
          style={{
            width: compact ? '36px' : '44px',
            height: compact ? '36px' : '44px',
            borderRadius: '10px',
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            marginBottom: '14px',
          }}
        >
          <Icon size={compact ? 18 : 22} />
        </div>
      )}

      <h3
        style={{
          fontSize: compact ? '14px' : '16px',
          fontWeight: 650,
          color: 'var(--primary)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h3>

      <div
        style={{
          fontSize: '13px',
          color: 'var(--muted)',
          lineHeight: 1.55,
          maxWidth: '420px',
          marginBottom: action ? '18px' : '0',
        }}
      >
        {description}
      </div>

      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
