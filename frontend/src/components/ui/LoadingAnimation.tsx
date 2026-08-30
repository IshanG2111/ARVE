import React from 'react';
import { Loader } from './Loader';
import { cn } from '@/lib/utils';

export interface LoadingAnimationProps {
  size?: number;
  fullScreen?: boolean;
  text?: string;
  className?: string;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  size = 56,
  fullScreen = false,
  text,
  className = '',
}) => {
  return (
    <div
      className={cn('global-glyph-loader', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: text ? '20px' : '0',
        padding: fullScreen ? '0' : '40px 24px',
        minHeight: fullScreen ? '85vh' : '60vh',
        width: '100%',
        margin: '0 auto',
        userSelect: 'none',
        textAlign: 'center',
      }}
    >
      <Loader size={size} />
      {text && (
        <p
          style={{
            fontSize: '12.5px',
            fontFamily: 'var(--font-code, monospace)',
            color: 'var(--muted, #64748B)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation;
