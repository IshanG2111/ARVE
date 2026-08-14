import React, { useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';

export interface AnimatedThemeTogglerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'circle' | 'square';
  className?: string;
}

export function AnimatedThemeToggler({ variant = 'circle', className = '', ...props }: AnimatedThemeTogglerProps) {
  const { isDark, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const sunVariants = {
    initial: { rotate: -120, scale: 0.2, opacity: 0 },
    animate: { rotate: 0, scale: 1, opacity: 1 },
    exit: { rotate: 120, scale: 0.2, opacity: 0 },
  };

  const moonVariants = {
    initial: { rotate: 120, scale: 0.2, opacity: 0 },
    animate: { rotate: 0, scale: 1, opacity: 1 },
    exit: { rotate: -120, scale: 0.2, opacity: 0 },
  };

  const buttonShapeStyle = variant === 'square' ? 'var(--radius-md)' : '50%';

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      className={`btn-ghost ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        height: '32px',
        width: '32px',
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: buttonShapeStyle,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--primary)',
        padding: 0,
        boxShadow: 'var(--shadow-subtle)',
        overflow: 'hidden',
      }}
      aria-label="Toggle theme"
      {...(props as any)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? 'dark-icon' : 'light-icon'}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <motion.div variants={moonVariants} className="flex items-center justify-center">
              <Moon size={15} color="var(--primary)" />
            </motion.div>
          ) : (
            <motion.div variants={sunVariants} className="flex items-center justify-center">
              <Sun size={15} color="var(--warning)" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

export default AnimatedThemeToggler;
