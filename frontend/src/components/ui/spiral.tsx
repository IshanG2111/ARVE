import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SpiralProps extends React.ComponentProps<'span'> {
  dots?: number;
  radius?: number;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export function Spiral({
  dots = 8,
  radius = 31.25,
  size = 32,
  color,
  className,
  style,
  ...props
}: SpiralProps) {
  let pixelSize = 32;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    switch (size) {
      case 'sm':
        pixelSize = 20;
        break;
      case 'md':
        pixelSize = 32;
        break;
      case 'lg':
        pixelSize = 44;
        break;
      case 'xl':
        pixelSize = 56;
        break;
    }
  }

  return (
    <span
      role="status"
      className={cn('relative inline-block', className)}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
        color: color || 'var(--accent, #0052FF)',
        ...style,
      }}
      {...props}
    >
      {Array.from({ length: dots }, (_, index) => {
        const angle = (index / dots) * (2 * Math.PI);
        const x = `${50 + radius * Math.cos(angle)}%`;
        const y = `${50 + radius * Math.sin(angle)}%`;

        return (
          <motion.span
            key={index}
            aria-hidden="true"
            className="absolute inline-block rounded-full bg-current"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              width: `${150 / dots}%`,
              height: `${150 / dots}%`,
              backgroundColor: 'currentColor',
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: (index / dots) * 1.5,
              ease: 'easeInOut',
            }}
          />
        );
      })}
      <span className="sr-only">Loading</span>
    </span>
  );
}

export default Spiral;
