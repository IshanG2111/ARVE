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
  size = 48,
  fullScreen = true,
  text,
  className = '',
}) => {
  if (fullScreen) {
    return (
      <div
        className={cn('global-glyph-loader', className)}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: text ? '16px' : '0',
          zIndex: 99999,
          background: 'var(--bg)',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        <Loader size={size} />
        {text && (
          <p
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-code, monospace)',
              color: 'var(--muted, #64748B)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
              fontWeight: 600,
            }}
          >
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('global-glyph-loader', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: text ? '16px' : '0',
        width: '100%',
        minHeight: '280px',
        flex: 1,
        margin: '0 auto',
        userSelect: 'none',
        textAlign: 'center',
      }}
    >
      <Loader size={size} />
      {text && (
        <p
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-code, monospace)',
            color: 'var(--muted, #64748B)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
            fontWeight: 600,
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation;
