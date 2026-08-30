import React from 'react';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  borderRadius,
  style,
  ...props
}) => {
  return (
    <div
      className={cn('skeleton-shimmer', className)}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        borderRadius: borderRadius !== undefined ? borderRadius : undefined,
        ...style,
      }}
      {...props}
    />
  );
};

export const SkeletonCard: React.FC<{ height?: string | number; className?: string }> = ({
  height = '260px',
  className,
}) => {
  return (
    <div
      className={cn('card', className)}
      style={{
        padding: '22px',
        minHeight: height,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Skeleton width="20px" height="20px" borderRadius="4px" />
          <Skeleton width="140px" height="18px" borderRadius="4px" />
        </div>
        <Skeleton width="80px" height="14px" borderRadius="4px" />
      </div>

      <Skeleton width="100%" height="12px" borderRadius="999px" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <Skeleton width="100%" height="40px" borderRadius="6px" />
        <Skeleton width="100%" height="40px" borderRadius="6px" />
        <Skeleton width="100%" height="40px" borderRadius="6px" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <Skeleton width="120px" height="14px" borderRadius="4px" />
        <Skeleton width="60px" height="14px" borderRadius="4px" />
      </div>
    </div>
  );
};

export const SkeletonRibbon: React.FC = () => {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ padding: '16px 20px', borderRight: i < 5 ? '1px solid var(--border)' : 'none' }}>
          <Skeleton width="70px" height="11px" borderRadius="3px" style={{ marginBottom: '8px' }} />
          <Skeleton width="120px" height="18px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="data-table-container">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px' }}>
        <Skeleton width="120px" height="14px" />
        <Skeleton width="80px" height="14px" />
        <Skeleton width="100px" height="14px" />
        <Skeleton width="140px" height="14px" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: '14px 20px',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Skeleton width="16px" height="16px" borderRadius="4px" />
              <Skeleton width="160px" height="16px" borderRadius="4px" />
              <Skeleton width="60px" height="16px" borderRadius="4px" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Skeleton width="80px" height="16px" borderRadius="4px" />
              <Skeleton width="24px" height="24px" borderRadius="4px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
