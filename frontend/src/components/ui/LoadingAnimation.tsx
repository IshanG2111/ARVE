import React, { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';

interface LoadingAnimationProps {
  label?: string;
  fullScreen?: boolean;
}

const BOOT_MESSAGES = [
  'Initializing…',
  'Mapping AST graph…',
  'Synthesizing…',
];

const dotVariants: Variants = {
  animate: (i: number) => ({
    opacity: [0.2, 0.8, 0.2],
    scale: [0.8, 1.2, 0.8],
    transition: {
      duration: 1.8,
      repeat: Infinity,
      delay: i * 0.25,
      ease: 'easeInOut',
    },
  }),
};

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  label,
  fullScreen = false,
}) => {
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const activeText = label || BOOT_MESSAGES[logIndex];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: fullScreen ? '0' : '48px 24px',
        minHeight: fullScreen ? '75vh' : 'auto',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            custom={i}
            animate="animate"
            variants={dotVariants}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--secondary)',
            }}
          />
        ))}
      </div>

      <motion.span
        key={activeText}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.4 }}
        style={{
          fontSize: '11px',
          color: 'var(--muted)',
          fontFamily: 'var(--font-code)',
          letterSpacing: '0.06em',
        }}
      >
        {activeText}
      </motion.span>
    </div>
  );
};
