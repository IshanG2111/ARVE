import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ARVELoader } from './ARVELoader';
import { InteractiveDotMatrix } from './InteractiveDotMatrix';
import { Check, Shield, Zap, X } from 'lucide-react';

interface IngestionOverlayProps {
  isOpen: boolean;
  projectName: string;
  onClose?: () => void;
  onComplete?: () => void;
}

const STAGES = [
  { id: 'auth', num: '01', title: 'AUTHENTICATION', desc: 'Verifying repository access & tokens' },
  { id: 'fetch', num: '02', title: 'TREE EXTRACTION', desc: 'Fetching repository file tree & manifests' },
  { id: 'snapshot', num: '03', title: 'CODE SNAPSHOT', desc: 'Creating isolated cryptographic snapshot' },
  { id: 'index', num: '04', title: 'AST PARSING', desc: 'Building abstract syntax trees & call graphs' },
  { id: 'model', num: '05', title: 'RISK MODELING', desc: 'Tracing parameter flow & OWASP invariants' },
  { id: 'ready', num: '06', title: 'ANALYSIS READY', desc: 'AST node graph ready for deterministic verification' },
];

export const IngestionOverlay: React.FC<IngestionOverlayProps> = ({
  isOpen,
  projectName,
  onClose,
  onComplete,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Lock body scroll completely while ingestion overlay is active
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  // Elapsed timer
  useEffect(() => {
    if (!isOpen) {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Progression through stages & auto smooth-exit
  useEffect(() => {
    if (!isOpen) {
      setCurrentStageIdx(0);
      setIsFinished(false);
      return;
    }

    const stageTimer = setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stageTimer);
          setIsFinished(true);
          return prev;
        }
      });
    }, 850);

    return () => clearInterval(stageTimer);
  }, [isOpen]);

  // When finished: brief celebration then smooth ease-out exit automatically
  useEffect(() => {
    if (isFinished && isOpen) {
      const exitTimer = setTimeout(() => {
        onComplete?.();
        onClose?.();
      }, 750);
      return () => clearTimeout(exitTimer);
    }
  }, [isFinished, isOpen, onComplete, onClose]);

  if (!isOpen) return null;

  const formattedTime = `00:${elapsedSec < 10 ? '0' : ''}${elapsedSec}s`;
  const progressPercent = Math.round(((currentStageIdx + (isFinished ? 1 : 0)) / STAGES.length) * 100);

  const overlayContent = (
    <AnimatePresence>
      <motion.div
        key="arve-ingestion-portal"
        initial={{ opacity: 0, filter: 'blur(16px)', scale: 0.98 }}
        animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
        exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.03 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        data-lenis-prevent="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999999,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          touchAction: 'none',
          overscrollBehavior: 'none',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* Background Interactive Dot Matrix Canvas */}
        <InteractiveDotMatrix dotSize={1.6} gap={24} hoverRadius={150} />

        {/* Atmospheric Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% 45%, transparent 20%, var(--bg) 85%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Top Status Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            position: 'relative',
            zIndex: 10,
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--bg) 95%, transparent)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <Shield size={14} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--primary)' }}>
                ARVE ENGINE
              </div>
              <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.05em' }}>
                INGESTION PIPELINE // {projectName.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-code)', fontSize: '11px' }}>
            <span style={{ color: 'var(--muted)' }}>
              ELAPSED: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{formattedTime}</span>
            </span>
            <span style={{ color: 'var(--muted)' }}>
              PROGRESS: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progressPercent}%</span>
            </span>
            {onClose && (
              <button
                className="btn btn-ghost btn-icon"
                onClick={onClose}
                style={{ padding: '6px', marginLeft: '8px' }}
                title="Dismiss Ingestion Modal"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Center Stage: Compiling Matrix & Clean Stages ── */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: '560px',
            width: '100%',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Compiling Matrix SVG Loader with Breathing Halo */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: '24px' }}
          >
            <ARVELoader size={112} />
          </motion.div>

          {/* Live Status Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              borderRadius: '100px',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              fontSize: '11px',
              fontFamily: 'var(--font-code)',
              letterSpacing: '0.06em',
              color: 'var(--primary)',
              marginBottom: '24px',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isFinished ? 'var(--success)' : 'var(--accent)',
                display: 'inline-block',
                animation: isFinished ? 'none' : 'arve-dot-pulse 1.4s ease-in-out infinite',
              }}
            />
            <span>{isFinished ? 'INGESTION COMPLETE • ENTERING WORKSPACE…' : 'PARSING SYNTAX TREES & AST'}</span>
          </div>

          {/* Connected Pipeline Stages */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              textAlign: 'left',
            }}
          >
            {STAGES.map((stage, idx) => {
              const isDone = idx < currentStageIdx || isFinished;
              const isCurrent = idx === currentStageIdx && !isFinished;

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent ? 'var(--surface)' : 'transparent',
                    border: isCurrent ? '1px solid var(--border-strong)' : '1px solid transparent',
                    boxShadow: isCurrent ? 'var(--shadow-subtle)' : 'none',
                    transition: 'all 200ms ease',
                  }}
                >
                  {/* Left: Step Number & Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-code)',
                        fontSize: '11px',
                        color: isDone ? 'var(--accent)' : isCurrent ? 'var(--primary)' : 'var(--dim)',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {stage.num}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-code)',
                          fontSize: '11.5px',
                          fontWeight: isCurrent ? 650 : isDone ? 500 : 400,
                          color: isCurrent ? 'var(--primary)' : isDone ? 'var(--secondary)' : 'var(--dim)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {stage.title}
                      </div>
                      <div
                        style={{
                          fontSize: '10.5px',
                          color: isCurrent ? 'var(--muted)' : 'var(--dim)',
                          marginTop: '1px',
                        }}
                      >
                        {stage.desc}
                      </div>
                    </div>
                  </div>

                  {/* Right: State Tag */}
                  <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                    {isDone ? (
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'var(--accent-muted)',
                          border: '1px solid var(--accent-border)',
                          color: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                    ) : isCurrent ? (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontFamily: 'var(--font-code)',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          letterSpacing: '0.06em',
                          padding: '2px 7px',
                          background: 'var(--accent-muted)',
                          borderRadius: '4px',
                          border: '1px solid var(--accent-border)',
                        }}
                      >
                        ACTIVE
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontFamily: 'var(--font-code)',
                          color: 'var(--dim)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        QUEUED
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Telemetry Footer ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            position: 'relative',
            zIndex: 10,
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--bg) 95%, transparent)',
            backdropFilter: 'blur(12px)',
            fontFamily: 'var(--font-code)',
            fontSize: '11px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={12} color="var(--accent)" />
            AST ISOLATION ENGINE
          </span>
          <span>ZERO REGRESSIONS DETERMINISTIC</span>
        </motion.div>

        <style>{`
          @keyframes arve-dot-pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.4); opacity: 1; filter: drop-shadow(0 0 4px var(--accent)); }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(overlayContent, document.body);
};
