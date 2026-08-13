import React from 'react';

interface LoadingAnimationProps {
  label?: string;
  fullScreen?: boolean;
  size?: number;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  fullScreen = false,
  size = 38,
}) => {
  const isInline = size <= 24;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isInline ? '0' : fullScreen ? '0' : '28px 16px',
        minHeight: fullScreen ? '70vh' : 'auto',
        userSelect: 'none',
      }}
    >
      {/* Compile SVG Matrix Loader */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56 56"
        role="img"
        aria-label="Loading"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <title>Loading</title>
        <defs>
          <circle id="b" r="2.2" fill="rgba(210, 206, 196, 0.12)" />
          <circle id="l" r="2.8" fill="var(--accent, #7E8BF5)" />
        </defs>
        <style>{`
          .l {
            opacity: 0;
            animation: matrix-wave 2000ms cubic-bezier(0.4, 0, 0.2, 1) infinite both;
          }
          @keyframes matrix-wave {
            0% { opacity: 0.1; transform: scale(0.9); }
            18% { opacity: 1; transform: scale(1.05); }
            70% { opacity: 0.85; transform: scale(1); }
            100% { opacity: 0.1; transform: scale(0.9); }
          }
          @media (prefers-reduced-motion: reduce) {
            .l { animation: none; opacity: 0.5; }
          }
          .d00 { animation-delay: 800ms; }
          .d01 { animation-delay: 880ms; }
          .d02 { animation-delay: 960ms; }
          .d03 { animation-delay: 1040ms; }
          .d04 { animation-delay: 1120ms; }
          .d10 { animation-delay: 600ms; }
          .d11 { animation-delay: 680ms; }
          .d12 { animation-delay: 760ms; }
          .d13 { animation-delay: 840ms; }
          .d14 { animation-delay: 920ms; }
          .d20 { animation-delay: 400ms; }
          .d21 { animation-delay: 480ms; }
          .d22 { animation-delay: 560ms; }
          .d23 { animation-delay: 640ms; }
          .d24 { animation-delay: 720ms; }
          .d30 { animation-delay: 200ms; }
          .d31 { animation-delay: 280ms; }
          .d32 { animation-delay: 360ms; }
          .d33 { animation-delay: 440ms; }
          .d34 { animation-delay: 520ms; }
          .d40 { animation-delay: 0ms; }
          .d41 { animation-delay: 80ms; }
          .d42 { animation-delay: 160ms; }
          .d43 { animation-delay: 240ms; }
          .d44 { animation-delay: 320ms; }
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
    </div>
  );
};
