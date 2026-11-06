import React, { useState, useEffect } from 'react';
import {
  Clock,
  Hourglass,
  Layers,
  Shield,
  Cpu,
  CheckCircle2,
  Loader2,
  StopCircle,
  FileCode2,
  Zap,
} from 'lucide-react';
import type { Scan } from '@/types';

interface ScanProgressCockpitProps {
  scan: Scan;
  onCancel: () => void;
}

export const ScanProgressCockpit: React.FC<ScanProgressCockpitProps> = ({ scan, onCancel }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    if (!scan.created_at) return 0;
    const diff = (Date.now() - new Date(scan.created_at).getTime()) / 1000;
    return Math.max(0, Math.floor(diff));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (scan.created_at) {
        const diff = (Date.now() - new Date(scan.created_at).getTime()) / 1000;
        setElapsedSeconds(Math.max(0, Math.floor(diff)));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [scan.created_at]);

  const progress = Math.min(99, Math.max(8, scan.progress_percent || 10));

  // Dynamic ETA remaining calculation
  // Typical multi-engine run including CodeQL takes ~120s - 160s
  const calculateEta = (): { remainingText: string; remainingSeconds: number } => {
    if (progress >= 95) {
      return { remainingText: '~5s', remainingSeconds: 5 };
    }

    let projectedTotal = 120;
    if (elapsedSeconds > 10 && progress > 15) {
      // Harmonic smoothed estimate
      const empiricalTotal = Math.round(elapsedSeconds / (progress / 100));
      projectedTotal = Math.min(240, Math.max(85, empiricalTotal));
    }

    const remainingSecs = Math.max(6, projectedTotal - elapsedSeconds);
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;

    let text = '';
    if (mins > 0) {
      text = `~${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    } else {
      text = `~${secs}s`;
    }

    return { remainingText: text, remainingSeconds: remainingSecs };
  };

  const { remainingText } = calculateEta();

  const formatElapsed = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Pipeline stages mapped to progress percent
  const stages = [
    {
      id: 'ingest',
      label: 'Workspace Ingestion',
      sublabel: 'Snapshot & file tree',
      icon: Layers,
      isDone: progress >= 25,
      isActive: progress < 25,
    },
    {
      id: 'fast_sast',
      label: 'Fast SAST & Secrets',
      sublabel: 'OSV, Semgrep, Gitleaks',
      icon: Zap,
      isDone: progress >= 50,
      isActive: progress >= 25 && progress < 50,
    },
    {
      id: 'codeql',
      label: 'CodeQL Deep SAST',
      sublabel: 'Dataflow & taint analysis',
      icon: Cpu,
      isDone: progress >= 88,
      isActive: progress >= 50 && progress < 88,
    },
    {
      id: 'ast_norm',
      label: 'AST & Normalization',
      sublabel: 'Call graph & deduplication',
      icon: FileCode2,
      isDone: progress >= 98,
      isActive: progress >= 88,
    },
  ];

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)',
        border: '1px solid rgba(0, 82, 255, 0.28)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background cyber accent glow */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(0, 82, 255, 0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              position: 'relative',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 82, 255, 0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 82, 255, 0.4)',
            }}
          >
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
                Security Analysis in Progress
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-code)',
                  background: 'rgba(0, 82, 255, 0.18)',
                  color: 'var(--accent)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  border: '1px solid rgba(0, 82, 255, 0.3)',
                }}
              >
                LIVE TELEMETRY
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {scan.current_stage || 'Executing containerized scanner engines in sandboxed workspaces...'}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="btn btn-ghost"
          style={{
            fontSize: '11.5px',
            color: 'var(--critical)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            background: 'rgba(239, 68, 68, 0.06)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <StopCircle size={13} />
          Cancel Run
        </button>
      </div>

      {/* Metrics Row: ETA + Elapsed + Stage */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          margin: '16px 0',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
            <Hourglass size={12} />
            <span>EST. TIME REMAINING</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
            {remainingText}
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
            <Clock size={12} />
            <span>ELAPSED TIME</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
            {formatElapsed(elapsedSeconds)}
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
            <Shield size={12} />
            <span>ENGINES ENGAGED</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 650, color: 'var(--primary)', marginTop: '2px' }}>
            OSV • Semgrep • Gitleaks • CodeQL
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>OVERALL COMPLETION</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--accent)' }}>
            {progress}%
          </div>
        </div>
      </div>

      {/* Cyber Shimmer Progress Bar */}
      <div
        style={{
          height: '8px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
          margin: '18px 0 20px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #0052ff 0%, #38bdf8 70%, #60a5fa 100%)',
            borderRadius: '999px',
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.55)',
            position: 'relative',
          }}
        >
          {/* Animated pulse bead */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '-2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow: '0 0 10px #38bdf8, 0 0 20px #0052ff',
            }}
          />
        </div>
      </div>

      {/* Stage Stepper Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
        }}
      >
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={st.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: st.isActive
                  ? 'rgba(0, 82, 255, 0.12)'
                  : st.isDone
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: st.isActive
                  ? '1px solid rgba(0, 82, 255, 0.45)'
                  : st.isDone
                  ? '1px solid rgba(16, 185, 129, 0.25)'
                  : '1px solid var(--border)',
                transition: 'all 200ms ease',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: st.isDone
                    ? 'rgba(16, 185, 129, 0.2)'
                    : st.isActive
                    ? 'rgba(0, 82, 255, 0.25)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: st.isDone ? '#10b981' : st.isActive ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {st.isDone ? (
                  <CheckCircle2 size={13} />
                ) : st.isActive ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Icon size={12} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 650,
                    color: st.isActive ? 'var(--primary)' : st.isDone ? 'var(--primary)' : 'var(--muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {idx + 1}. {st.label}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: st.isActive ? 'var(--accent)' : 'var(--muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {st.isActive ? 'Executing...' : st.isDone ? 'Completed' : st.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
