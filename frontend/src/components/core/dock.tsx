import React, { createContext, useContext, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  MotionValue,
} from 'framer-motion';

const DEFAULT_MAGNIFICATION = 48;
const DEFAULT_DISTANCE = 110;
const DEFAULT_PANEL_HEIGHT = 48;

interface DockContextType {
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
}

const DockContext = createContext<DockContextType | null>(null);

export interface DockProps {
  children: React.ReactNode;
  className?: string;
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  style?: React.CSSProperties;
}

export const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      children,
      className = '',
      magnification = DEFAULT_MAGNIFICATION,
      distance = DEFAULT_DISTANCE,
      panelHeight = DEFAULT_PANEL_HEIGHT,
      style = {},
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity);

    return (
      <DockContext.Provider value={{ mouseX, magnification, distance }}>
        <motion.div
          ref={ref}
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className={`flex h-[48px] w-max items-center gap-2 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-2xl transition-colors duration-200 ${className}`}
          style={{
            height: panelHeight,
            background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-modal), 0 8px 30px -4px rgba(0, 0, 0, 0.12)',
            ...style,
          }}
          role="toolbar"
          aria-label="Application dock"
        >
          {children}
        </motion.div>
      </DockContext.Provider>
    );
  }
);
Dock.displayName = 'Dock';

export interface DockItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const DockItem = React.forwardRef<HTMLDivElement, DockItemProps>(
  ({ children, className = '', onClick, style = {} }, propRef) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const ref = (propRef as React.RefObject<HTMLDivElement | null>) || internalRef;
    const context = useContext(DockContext);
    const fallbackMouseX = useMotionValue(Infinity);
    const mouseX = context?.mouseX ?? fallbackMouseX;
    const magnification = context?.magnification ?? DEFAULT_MAGNIFICATION;
    const distance = context?.distance ?? DEFAULT_DISTANCE;

    const [isHovered, setIsHovered] = useState(false);
    const defaultWidth = 34;

    const distanceCalc = useTransform(mouseX, (val: number) => {
      const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
      return val - bounds.x - bounds.width / 2;
    });

    const widthSync = useTransform(
      distanceCalc,
      [-distance, 0, distance],
      [defaultWidth, magnification, defaultWidth]
    );

    const width = useSpring(widthSync, {
      mass: 0.1,
      stiffness: 170,
      damping: 14,
    });

    return (
      <motion.div
        ref={ref}
        style={{
          width,
          height: width,
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        className={`relative flex items-center justify-center cursor-pointer rounded-full transition-colors duration-150 ${className}`}
        whileTap={{ scale: 0.88 }}
      >
        <DockItemContext.Provider value={{ isHovered }}>
          {children}
        </DockItemContext.Provider>
      </motion.div>
    );
  }
);
DockItem.displayName = 'DockItem';

interface DockItemContextType {
  isHovered: boolean;
}

const DockItemContext = createContext<DockItemContextType>({ isHovered: false });

export interface DockLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const DockLabel: React.FC<DockLabelProps> = ({ children, className = '' }) => {
  const { isHovered } = useContext(DockItemContext);

  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.9 }}
          animate={{ opacity: 1, y: -8, scale: 1 }}
          exit={{ opacity: 0, y: 0, scale: 0.9 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10.5px] font-medium shadow-md pointer-events-none z-50 ${className}`}
          style={{
            background: 'var(--primary)',
            color: 'var(--surface)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface DockIconProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DockIcon: React.FC<DockIconProps> = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={`flex items-center justify-center w-full h-full p-1.5 ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'inherit',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Dock;
