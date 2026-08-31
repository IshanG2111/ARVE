import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Wave } from './wave';

export interface LoadingState {
  text: string;
}

export interface MultiStepLoaderProps {
  loadingStates: LoadingState[];
  loading: boolean;
  duration?: number;
  loop?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  projectName?: string;
}

export const MultiStepLoader: React.FC<MultiStepLoaderProps> = ({
  loadingStates,
  loading,
  duration = 1100,
  loop = false,
  onClose,
  onComplete,
  projectName,
}) => {
  const [currentState, setCurrentState] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Lock body scroll while loader is active
  useEffect(() => {
    if (loading) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [loading]);

  // Step progression
  useEffect(() => {
    if (!loading) {
      setCurrentState(0);
      setIsFinished(false);
      return;
    }

    const timer = setInterval(() => {
      setCurrentState((prev) => {
        if (prev < loadingStates.length - 1) {
          return prev + 1;
        } else {
          if (loop) {
            return 0;
          } else {
            clearInterval(timer);
            setIsFinished(true);
            return prev;
          }
        }
      });
    }, duration);

    return () => clearInterval(timer);
  }, [loading, loadingStates.length, duration, loop]);

  // Completion auto-exit
  useEffect(() => {
    if (isFinished && loading && !loop) {
      const exitTimer = setTimeout(() => {
        onComplete?.();
        onClose?.();
      }, 600);
      return () => clearTimeout(exitTimer);
    }
  }, [isFinished, loading, loop, onComplete, onClose]);

  if (!loading) return null;

  const progressPercent = Math.round(
    ((currentState + (isFinished ? 1 : 0)) / loadingStates.length) * 100
  );

  const modalElement = (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8, 9, 13, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '24px',
            userSelect: 'none',
          }}
        >
          {/* Top-Right Dismiss Button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: 'fixed',
                top: '24px',
                right: '24px',
                zIndex: 10000,
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#E2E8F0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 160ms ease',
              }}
              title="Close loader"
            >
              <X size={17} />
            </button>
          )}

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%',
              maxWidth: '460px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '24px',
            }}
          >
            {/* ARVE Clean Wordmark with subtle accent glow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 850,
                  letterSpacing: '0.04em',
                  color: '#FFFFFF',
                  fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
                  lineHeight: 1,
                }}
              >
                ARVE
              </span>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent, #0052FF)',
                  boxShadow: '0 0 10px rgba(0, 82, 255, 0.8)',
                  display: 'inline-block',
                }}
              />
            </div>

            {/* Target Project Pill */}
            {projectName && (
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: '#94A3B8',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '100px',
                  padding: '3px 12px',
                  letterSpacing: '0.04em',
                }}
              >
                TARGET: {projectName}
              </div>
            )}

            {/* Steps List */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: 'left',
              }}
            >
              {loadingStates.map((step, idx) => {
                const isCompleted = idx < currentState || isFinished;
                const isActive = idx === currentState && !isFinished;
                const isFuture = idx > currentState && !isFinished;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: isFuture ? 0.35 : 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      background: isActive ? 'rgba(0, 82, 255, 0.08)' : 'transparent',
                      border: isActive
                        ? '1px solid rgba(0, 82, 255, 0.25)'
                        : '1px solid transparent',
                      transition: 'all 160ms ease',
                    }}
                  >
                    {/* Left: Step Circle Indicator + Clean Text (No Strikethrough) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 200ms ease',
                          ...(isCompleted
                            ? {
                                background: 'rgba(0, 82, 255, 0.2)',
                                border: '1px solid var(--accent, #0052FF)',
                                color: '#FFFFFF',
                              }
                            : isActive
                            ? {
                                background: 'transparent',
                                border: '2px solid var(--accent, #0052FF)',
                                boxShadow: '0 0 10px rgba(0, 82, 255, 0.3)',
                              }
                            : {
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                              }),
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={13} color="var(--accent, #0052FF)" strokeWidth={2.5} />
                        ) : isActive ? (
                          <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: 'var(--accent, #0052FF)',
                            }}
                          />
                        ) : null}
                      </div>

                      <span
                        style={{
                          fontSize: '12.5px',
                          fontFamily: 'var(--font-code, monospace)',
                          fontWeight: isActive ? 600 : isCompleted ? 500 : 400,
                          color: isCompleted
                            ? '#E2E8F0'
                            : isActive
                            ? '#FFFFFF'
                            : '#64748B',
                          transition: 'color 160ms ease',
                        }}
                      >
                        {step.text}
                      </span>
                    </div>

                    {/* Right: Active Wave Indicator */}
                    {isActive && (
                      <div style={{ flexShrink: 0, marginLeft: '10px' }}>
                        <Wave size="xs" color="var(--accent, #0052FF)" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Progress Bar */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  width: '100%',
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #0052FF, #2563EB, #60A5FA)',
                    borderRadius: '999px',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-code)',
                  color: '#94A3B8',
                }}
              >
                <span>{isFinished ? 'INGESTION COMPLETED' : 'INGESTING REPOSITORY'}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalElement, document.body);
};

export { MultiStepLoader as Loader };
export default MultiStepLoader;
