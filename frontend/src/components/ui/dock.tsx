export * from '../core/dock';

import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'framer-motion';
import { Dock, DockItem, DockLabel, DockIcon } from '../core/dock';

interface DockContextType {
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
  isHovered: boolean;
}

const LegacyDockContext = createContext<DockContextType | null>(null);

export interface DockCardProps {
  children?: React.ReactNode;
  id?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  style?: React.CSSProperties;
}

export const DockCard: React.FC<DockCardProps> = ({
  children,
  id,
  className = '',
  onClick,
  title,
  active = false,
  style = {},
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const context = useContext(LegacyDockContext);
  const fallbackMouseX = useMotionValue(Infinity);
  const mouseX = context?.mouseX ?? fallbackMouseX;
  const magnification = context?.magnification ?? 60;
  const distance = context?.distance ?? 120;

  const defaultWidth = 44;
  const distanceCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [defaultWidth, magnification, defaultWidth]
  );
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 160, damping: 14 });

  return (
    <motion.div
      ref={ref}
      style={{
        width,
        height: width,
        position: 'relative',
        ...style,
      }}
      onClick={onClick}
      className={`arve-dock-card ${active ? 'active' : ''} ${className}`}
      title={title}
      id={id}
      whileTap={{ scale: 0.92 }}
    >
      {children}
    </motion.div>
  );
};

export interface DockCardInnerProps {
  src?: string | null;
  id?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DockCardInner: React.FC<DockCardInnerProps> = ({
  src,
  children,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`arve-dock-card-inner ${className}`}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'var(--elevated)',
        border: '1px solid var(--border)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      {children && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const DockDivider: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`arve-dock-divider ${className}`}
      style={{
        width: '1px',
        height: '24px',
        background: 'var(--border-strong)',
        margin: '0 4px',
      }}
    />
  );
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export { Dock, DockItem, DockLabel, DockIcon };
export default Dock;
