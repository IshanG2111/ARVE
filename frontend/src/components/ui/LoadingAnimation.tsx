import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingAnimationProps {
  label?: string;
  fullScreen?: boolean;
  size?: number;
}

const BOOT_MESSAGES = [
  'Initializing security matrix…',
  'Mapping AST graph representation…',
  'Analyzing ingress endpoints…',
  'Synthesizing security posture…',
];

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  label,
  fullScreen = false,
  size = 56,
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
      {/* Compile SVG Matrix Loader */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56 56"
        role="img"
        aria-label="Compile"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <title>Compile</title>
        <desc>Each column fills bottom-up, then releases as one.</desc>
        <defs>
          <circle id="b" r="2.4" fill="#ffffff" opacity="0.07" />
          <circle id="l" r="3.1" />
        </defs>
        <style>{`
          .l {
            fill: #ffffff;
            opacity: 0;
            animation: icon-28-k 2400ms cubic-bezier(0.65, 0, 0.35, 1) infinite both;
          }
          @keyframes icon-28-k {
            0% { opacity: 0.08; }
            14% { opacity: 1; }
            72% { opacity: 0.95; }
            100% { opacity: 0.08; }
          }
          @media (prefers-reduced-motion: reduce) {
            .l { animation: none; opacity: 0.45; }
          }
          .d00 { animation-delay: 960ms; }
          .d01 { animation-delay: 1056ms; }
          .d02 { animation-delay: 1152ms; }
          .d03 { animation-delay: 1248ms; }
          .d04 { animation-delay: 1344ms; }
          .d10 { animation-delay: 720ms; }
          .d11 { animation-delay: 816ms; }
          .d12 { animation-delay: 912ms; }
          .d13 { animation-delay: 1008ms; }
          .d14 { animation-delay: 1104ms; }
          .d20 { animation-delay: 480ms; }
          .d21 { animation-delay: 576ms; }
          .d22 { animation-delay: 672ms; }
          .d23 { animation-delay: 768ms; }
          .d24 { animation-delay: 864ms; }
          .d30 { animation-delay: 240ms; }
          .d31 { animation-delay: 336ms; }
          .d32 { animation-delay: 432ms; }
          .d33 { animation-delay: 528ms; }
          .d34 { animation-delay: 624ms; }
          .d40 { animation-delay: 0ms; }
          .d41 { animation-delay: 96ms; }
          .d42 { animation-delay: 192ms; }
          .d43 { animation-delay: 288ms; }
          .d44 { animation-delay: 384ms; }
        `}</style>
        <use href="#b" x="6" y="6" />
        <use href="#b" x="17" y="6" />
        <use href="#b" x="28" y="6" />
        <use href="#b" x="39" y="6" />
        <use href="#b" x="50" y="6" />
        <use href="#b" x="6" y="17" />
        <use href="#b" x="17" y="17" />
        <use href="#b" x="28" y="17" />
        <use href="#b" x="39" y="17" />
        <use href="#b" x="50" y="17" />
        <use href="#b" x="6" y="28" />
        <use href="#b" x="17" y="28" />
        <use href="#b" x="28" y="28" />
        <use href="#b" x="39" y="28" />
        <use href="#b" x="50" y="28" />
        <use href="#b" x="6" y="39" />
        <use href="#b" x="17" y="39" />
        <use href="#b" x="28" y="39" />
        <use href="#b" x="39" y="39" />
        <use href="#b" x="50" y="39" />
        <use href="#b" x="6" y="50" />
        <use href="#b" x="17" y="50" />
        <use href="#b" x="28" y="50" />
        <use href="#b" x="39" y="50" />
        <use href="#b" x="50" y="50" />
        <use className="l d00" href="#l" x="6" y="6" />
        <use className="l d01" href="#l" x="17" y="6" />
        <use className="l d02" href="#l" x="28" y="6" />
        <use className="l d03" href="#l" x="39" y="6" />
        <use className="l d04" href="#l" x="50" y="6" />
        <use className="l d10" href="#l" x="6" y="17" />
        <use className="l d11" href="#l" x="17" y="17" />
        <use className="l d12" href="#l" x="28" y="17" />
        <use className="l d13" href="#l" x="39" y="17" />
        <use className="l d14" href="#l" x="50" y="17" />
        <use className="l d20" href="#l" x="6" y="28" />
        <use className="l d21" href="#l" x="17" y="28" />
        <use className="l d22" href="#l" x="28" y="28" />
        <use className="l d23" href="#l" x="39" y="28" />
        <use className="l d24" href="#l" x="50" y="28" />
        <use className="l d30" href="#l" x="6" y="39" />
        <use className="l d31" href="#l" x="17" y="39" />
        <use className="l d32" href="#l" x="28" y="39" />
        <use className="l d33" href="#l" x="39" y="39" />
        <use className="l d34" href="#l" x="50" y="39" />
        <use className="l d40" href="#l" x="6" y="50" />
        <use className="l d41" href="#l" x="17" y="50" />
        <use className="l d42" href="#l" x="28" y="50" />
        <use className="l d43" href="#l" x="39" y="50" />
        <use className="l d44" href="#l" x="50" y="50" />
      </svg>

      <motion.span
        key={activeText}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.8, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          fontSize: '11px',
          color: 'var(--secondary)',
          fontFamily: 'var(--font-code)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {activeText}
      </motion.span>
    </div>
  );
};
