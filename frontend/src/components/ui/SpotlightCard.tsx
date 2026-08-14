import React, { useRef, useState, useCallback } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor,
  borderColor = 'var(--border-hover)',
  style,
  onMouseMove,
  onMouseLeave,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setOpacity(1);
    onMouseMove?.(e);
  }, [onMouseMove]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setOpacity(0);
    onMouseLeave?.(e);
  }, [onMouseLeave]);

  // Default color adapts subtly to light and dark
  const resolvedColor = spotlightColor || 'var(--accent-muted)';

  return (
    <div
      ref={cardRef}
      className={`card card-hover ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      {/* 21st.dev Radial Spotlight Overlay */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          opacity,
          transition: 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1)',
          background: `radial-gradient(450px circle at ${position.x}px ${position.y}px, ${resolvedColor}, transparent 65%)`,
          zIndex: 1,
        }}
      />

      {/* Subtle hairline border glow on hover */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          opacity,
          transition: 'opacity 250ms ease',
          borderRadius: 'inherit',
          border: `1px solid ${borderColor}`,
          zIndex: 2,
        }}
      />

      {/* Card Body Content */}
      <div style={{ position: 'relative', zIndex: 3, height: '100%' }}>
        {children}
      </div>
    </div>
  );
};
