import React from 'react';
import { Loader } from './Loader';

export interface LoadingAnimationProps {
  size?: number;
  fullScreen?: boolean;
  text?: string;
  className?: string;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  size = 64,
  fullScreen = false,
  text,
  className = '',
}) => {
  return (
    <div
      className={`universal-loading-animation ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: text ? '16px' : '0',
        padding: fullScreen ? '0' : '40px 16px',
        minHeight: fullScreen ? '75vh' : 'auto',
        userSelect: 'none',
      }}
    >
      <Loader size={size} />
      {text && (
        <p
          style={{
            fontSize: '13px',
            fontFamily: 'var(--font-code, monospace)',
            color: 'var(--text-muted, #888)',
            letterSpacing: '0.05em',
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
