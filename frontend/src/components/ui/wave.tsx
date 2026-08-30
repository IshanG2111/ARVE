import React from 'react';
import { cn } from '@/lib/utils';

const WAVE_BAR_HEIGHTS = ['50%', '75%', '100%', '75%', '50%'] as const;

export interface WaveProps extends React.ComponentProps<'span'> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  color?: string;
}

export function Wave({ className, size = 'md', color, style, ...props }: WaveProps) {
  let pixelHeight = 16;
  let pixelWidth = 20;

  if (typeof size === 'number') {
    pixelHeight = size;
    pixelWidth = size * 1.25;
  } else {
    switch (size) {
      case 'xs':
        pixelHeight = 10;
        pixelWidth = 12;
        break;
      case 'sm':
        pixelHeight = 13;
        pixelWidth = 16;
        break;
      case 'md':
        pixelHeight = 16;
        pixelWidth = 20;
        break;
      case 'lg':
        pixelHeight = 24;
        pixelWidth = 30;
        break;
    }
  }

  return (
    <>
      <style>{`
        @keyframes loading-ui-wave {
          0%,
          100% {
            transform: scaleY(1);
          }

          50% {
            transform: scaleY(0.35);
          }
        }
      `}</style>
      <span
        role="status"
        className={cn('inline-flex items-center justify-between', className)}
        style={{
          width: `${pixelWidth}px`,
          height: `${pixelHeight}px`,
          color: color || 'currentColor',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          ...style,
        }}
        {...props}
      >
        {WAVE_BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="inline-block rounded-full bg-current"
            style={{
              width: `${Math.max(2, Math.round(pixelWidth / 8))}px`,
              height,
              backgroundColor: color || 'currentColor',
              borderRadius: '999px',
              animation: 'loading-ui-wave var(--duration, 1s) ease-in-out infinite',
              animationDelay: `calc(var(--delay, 100ms) * ${index})`,
            }}
          />
        ))}
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export default Wave;
