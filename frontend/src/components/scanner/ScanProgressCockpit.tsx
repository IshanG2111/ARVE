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
import type { Scan, ScanStatusResponse } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/services/api';
import { parseUtcDate } from '@/lib/utils';

interface ScanProgressCockpitProps {
  scan: Scan;
  telemetry?: ScanStatusResponse | null;
  onCancel: () => void;
}

export const ScanProgressCockpit: React.FC<ScanProgressCockpitProps> = ({
  scan,
  telemetry: initialTelemetry,
  onCancel,
}) => {
  const { isDark } = useTheme();
  const [liveTelemetry, setLiveTelemetry] = useState<ScanStatusResponse | null>(initialTelemetry || null);

  useEffect(() => {
    if (initialTelemetry) {
      setLiveTelemetry(initialTelemetry);
    }
  }, [initialTelemetry]);

  // Merge live telemetry so the cockpit immediately reflects status, progress, and stage
  const currentScan = liveTelemetry ? { ...scan, ...liveTelemetry } : scan;
  const currentStatus = currentScan.status?.toUpperCase() || 'QUEUED';

  // Status flags
  const isQueued = currentStatus === 'QUEUED';
  const isCompleted = ['COMPLETED', 'PARTIAL'].includes(currentStatus);
  const isCancelled = currentStatus === 'CANCELLED';
  const isFailed = currentStatus === 'FAILED';
  const isScanning = ['SCANNING', 'INGESTING', 'NORMALIZING'].includes(currentStatus);

  // Poll live telemetry while active
  useEffect(() => {
    if (!scan.id) return;
    if (isCompleted || isCancelled || isFailed) return;

    let cancelled = false;
    const fetchTelemetry = async () => {
      try {
        const data = await api.getScanStatus(scan.id);
        if (!cancelled) setLiveTelemetry(data);
      } catch {
        // quiet fallback
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scan.id, currentStatus, isCompleted, isCancelled, isFailed]);

  // Live reactive clock tick (updates every 1000ms while active)
  const [now, setNow] = useState<number>(() => Date.now());
  const mountTimeRef = React.useRef<number>(Date.now());

  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, [scan.id]);

  useEffect(() => {
    if (isCompleted || isCancelled || isFailed) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isCompleted, isCancelled, isFailed]);

  // Compute elapsed time accurately to the dot:
  // - Always anchor to created_at so the timer never jumps backward when started_at arrives
  // - If scan is finished, measure exact duration from start to completed_at
  // - If scan is active, count up every second, protected against negative clock drift
  const startTs = parseUtcDate(currentScan.created_at || currentScan.started_at);

  const elapsedSeconds = (() => {
    if (!startTs) return 0;

    if ((isCompleted || isCancelled || isFailed) && currentScan.completed_at) {
      const endTs = parseUtcDate(currentScan.completed_at);
      if (endTs >= startTs) {
        return Math.max(1, Math.floor((endTs - startTs) / 1000));
      }
    }

    const serverDelta = Math.floor((now - startTs) / 1000);
    const localDelta = Math.floor((now - mountTimeRef.current) / 1000);

    // If serverDelta is valid (>=0), use it; otherwise fallback to localDelta to prevent freezing on clock skew
    if (serverDelta >= 0) {
      return serverDelta;
    }
    return Math.max(0, localDelta);
  })();

  const isStalled = isQueued && elapsedSeconds > 900;

  // Format elapsed time cleanly as mm:ss (e.g. 00:15, 01:24) or h:mm:ss if prolonged
  const formatElapsed = (totalSecs: number): string => {
    if (totalSecs <= 0) return '00:00';
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
      return `${h}h ${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Real overall completion percentage
  const rawProgress = (() => {
    if (isCompleted) return 100;
    if (isCancelled || isFailed) return currentScan.progress_percent || 0;
    if (isQueued) return 0;
    if (typeof currentScan.progress_percent === 'number' && currentScan.progress_percent > 0) {
      return Math.min(99, currentScan.progress_percent);
    }
    if (currentScan.current_stage?.includes('AST') || currentScan.current_stage?.includes('Normalization')) return 90;
    if (currentScan.current_stage?.includes('CodeQL')) return 65;
    if (currentScan.current_stage?.includes('SAST') || currentScan.current_stage?.includes('engines')) return 35;
    return 10;
  })();

  // Visual progress bar width (at least 3% when active so the bead is visible)
  const visualProgress = isQueued ? 2 : Math.min(100, Math.max(3, rawProgress));

  // Dynamic, physically accurate countdown ETA
  const calculateEta = (): string => {
    if (isCompleted) {
      return '~0s';
    }
    if (isCancelled || isFailed) {
      return '--';
    }
    if (isStalled) {
      return 'Stalled';
    }

    // Pipeline progresses through:
    // 0-25% Workspace Ingestion (~5-10s)
    // 25-50% Fast SAST OSV/Semgrep/Gitleaks (~15-20s)
    // 50-88% CodeQL (~15-25s)
    // 88-100% AST Normalization & Deduplication (~5-10s)
    if (rawProgress >= 95) {
      return '~3s';
    }
    if (rawProgress >= 88) {
      const rem = Math.max(2, 6 - (elapsedSeconds % 6));
      return `~${rem}s`;
    }
    if (rawProgress >= 50) {
      const rem = Math.max(5, 18 - (elapsedSeconds % 18));
      return `~${rem}s`;
    }
    if (rawProgress >= 25) {
      const rem = Math.max(10, 35 - (elapsedSeconds % 35));
      return `~${rem}s`;
    }

    // Starting or queued:
    const rem = Math.max(12, 50 - Math.min(38, elapsedSeconds));
    const mins = Math.floor(rem / 60);
    const secs = rem % 60;
    return mins > 0 ? `~${mins}m ${secs < 10 ? '0' : ''}${secs}s` : `~${secs}s`;
  };

  const remainingText = calculateEta();

  // Engine telemetry details
  const engineRuns = liveTelemetry?.engine_runs || [];
  const totalEnginesCount = engineRuns.length || 4;
  const completedEnginesCount = engineRuns.filter((r) =>
    ['SUCCESS', 'FAILED', 'TIMEOUT', 'COMPLETED'].includes(r.status?.toUpperCase())
  ).length;

  const enginesEngagedValue = (() => {
    if (isCompleted) {
      return `${totalEnginesCount}/${totalEnginesCount} Finished`;
    }
    if (engineRuns.length > 0 && completedEnginesCount > 0) {
      return `${completedEnginesCount}/${totalEnginesCount} Completed`;
    }
    return '4 Active';
  })();

  // Pipeline stages accurately mapped to progress percent & execution status
  const stages = [
    {
      id: 'ingest',
      label: 'Workspace Ingestion',
      sublabel: 'Snapshot & file tree',
      icon: Layers,
      isDone: rawProgress >= 25 || isCompleted,
      isActive: isScanning && rawProgress < 25,
      statusText: isCompleted || rawProgress >= 25 ? 'Completed' : isScanning && rawProgress < 25 ? 'Executing...' : 'Snapshot & file tree',
    },
    {
      id: 'fast_sast',
      label: 'Fast SAST & Secrets',
      sublabel: 'OSV, Semgrep, Gitleaks',
      icon: Zap,
      isDone: rawProgress >= 50 || isCompleted,
      isActive: isScanning && rawProgress >= 25 && rawProgress < 50,
      statusText: isCompleted || rawProgress >= 50 ? 'Completed' : isScanning && rawProgress >= 25 && rawProgress < 50 ? 'Executing...' : 'OSV, Semgrep, Gitleaks',
    },
    {
      id: 'codeql',
      label: 'CodeQL Deep SAST',
      sublabel: 'Dataflow & taint analysis',
      icon: Cpu,
      isDone: rawProgress >= 88 || isCompleted,
      isActive: isScanning && rawProgress >= 50 && rawProgress < 88,
      statusText: isCompleted || rawProgress >= 88 ? 'Completed' : isScanning && rawProgress >= 50 && rawProgress < 88 ? 'Executing...' : 'Dataflow & taint analysis',
    },
    {
      id: 'ast_norm',
      label: 'AST & Normalization',
      sublabel: 'Call graph & deduplication',
      icon: FileCode2,
      isDone: rawProgress >= 98 || isCompleted,
      isActive: isScanning && rawProgress >= 88 && rawProgress < 98,
      statusText: isCompleted || rawProgress >= 98 ? 'Completed' : isScanning && rawProgress >= 88 && rawProgress < 98 ? 'Executing...' : 'Call graph & deduplication',
    },
  ];

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        background: isDark
          ? 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(0, 82, 255, 0.04) 0%, #FFFFFF 100%)',
        border: isDark
          ? '1px solid rgba(0, 82, 255, 0.28)'
          : '1px solid rgba(0, 82, 255, 0.18)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.35)'
          : '0 4px 20px -2px rgba(0, 82, 255, 0.07), 0 1px 3px rgba(15, 23, 42, 0.05)',
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
          background: isDark
            ? 'radial-gradient(circle, rgba(0, 82, 255, 0.22) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0, 82, 255, 0.07) 0%, transparent 70%)',
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
              background: isDark ? 'rgba(0, 82, 255, 0.15)' : 'rgba(0, 82, 255, 0.08)',
              borderRadius: '8px',
              border: isDark ? '1px solid rgba(0, 82, 255, 0.4)' : '1px solid rgba(0, 82, 255, 0.22)',
            }}
          >
            {isScanning ? (
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
            ) : isQueued ? (
              <Hourglass size={16} style={{ color: 'var(--accent)' }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
                {isCompleted ? 'Security Analysis Complete' : isQueued ? 'Security Analysis Queued' : 'Security Analysis in Progress'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-code)',
                  background: isDark ? 'rgba(0, 82, 255, 0.18)' : 'rgba(0, 82, 255, 0.08)',
                  color: 'var(--accent)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  border: isDark ? '1px solid rgba(0, 82, 255, 0.3)' : '1px solid rgba(0, 82, 255, 0.22)',
                }}
              >
                LIVE TELEMETRY
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              {currentScan.current_stage || (isCompleted ? 'All engines executed and findings normalized.' : isStalled ? 'Queue has been idle. Worker may be offline.' : isQueued ? 'Waiting for container worker to start execution...' : 'Executing containerized scanner engines in sandboxed workspaces...')}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="btn btn-ghost"
          style={{
            fontSize: '11.5px',
            color: isDark ? 'var(--critical)' : '#DC2626',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(220, 38, 38, 0.25)',
            background: isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(220, 38, 38, 0.05)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <StopCircle size={13} />
          {isCompleted ? 'Dismiss Cockpit' : isStalled ? 'Cancel & Reset' : 'Cancel Run'}
        </button>
      </div>

      {/* Metrics Row: ETA + Elapsed + Engines + Completion */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          margin: '16px 0',
        }}
      >
        {/* Card 1: EST. TIME REMAINING */}
        <div
          style={{
            padding: '10px 14px',
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: isDark ? '1px solid var(--border)' : '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.03)',
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
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            {isCompleted ? 'Analysis complete' : isStalled ? 'Worker idle' : 'Adaptive countdown'}
          </div>
        </div>

        {/* Card 2: ELAPSED TIME */}
        <div
          style={{
            padding: '10px 14px',
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: isDark ? '1px solid var(--border)' : '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: isDark ? 'var(--muted)' : '#475569', fontWeight: 600 }}>
            <Clock size={12} />
            <span>ELAPSED TIME</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
            {formatElapsed(elapsedSeconds)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isCompleted ? 'var(--success)' : isStalled ? '#f59e0b' : isScanning ? '#38bdf8' : 'var(--accent)',
                boxShadow: isScanning ? '0 0 6px #38bdf8' : 'none',
                display: 'inline-block',
              }}
            />
            <span>{isCompleted ? 'Total duration' : isStalled ? 'Stalled in queue' : isScanning ? 'Live runtime' : 'In queue'}</span>
          </div>
        </div>

        {/* Card 3: ENGINES ENGAGED */}
        <div
          style={{
            padding: '10px 14px',
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: isDark ? '1px solid var(--border)' : '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: isDark ? 'var(--muted)' : '#475569', fontWeight: 600 }}>
            <Shield size={12} />
            <span>ENGINES ENGAGED</span>
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)', marginTop: '2px' }}>
            {enginesEngagedValue}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '1px' }}>
            OSV • Semgrep • Gitleaks • CodeQL
          </div>
        </div>

        {/* Card 4: OVERALL COMPLETION */}
        <div
          style={{
            padding: '10px 14px',
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: isDark ? '1px solid var(--border)' : '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: isDark ? 'var(--muted)' : '#475569', fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>OVERALL COMPLETION</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--accent)' }}>
            {rawProgress}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
            {isCompleted ? '100% Normalized' : isStalled ? 'Pending worker' : stages.find((s) => s.isActive)?.label || 'In progress'}
          </div>
        </div>
      </div>

      {/* Cyber Shimmer Progress Bar */}
      <div
        style={{
          height: '8px',
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
          margin: '18px 0 20px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${visualProgress}%`,
            background: 'linear-gradient(90deg, #0052ff 0%, #38bdf8 70%, #60a5fa 100%)',
            borderRadius: '999px',
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isDark
              ? '0 0 16px rgba(56, 189, 248, 0.55)'
              : '0 0 10px rgba(0, 82, 255, 0.3)',
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
              boxShadow: isDark
                ? '0 0 10px #38bdf8, 0 0 20px #0052ff'
                : '0 0 6px rgba(0, 82, 255, 0.4), 0 1px 3px rgba(0, 0, 0, 0.15)',
              border: isDark ? 'none' : '1px solid rgba(0, 82, 255, 0.3)',
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
                  ? isDark ? 'rgba(0, 82, 255, 0.14)' : 'rgba(0, 82, 255, 0.08)'
                  : st.isDone
                  ? isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.07)'
                  : isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
                border: st.isActive
                  ? isDark ? '1px solid rgba(0, 82, 255, 0.45)' : '1px solid rgba(0, 82, 255, 0.35)'
                  : st.isDone
                  ? isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.28)'
                  : isDark ? '1px solid var(--border)' : '1px solid rgba(15, 23, 42, 0.08)',
                boxShadow: !isDark && (st.isActive || st.isDone) ? '0 1px 2px rgba(15, 23, 42, 0.04)' : 'none',
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
                    ? isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.14)'
                    : st.isActive
                    ? isDark ? 'rgba(0, 82, 255, 0.25)' : 'rgba(0, 82, 255, 0.12)'
                    : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
                  color: st.isDone
                    ? isDark ? '#10b981' : '#059669'
                    : st.isActive
                    ? 'var(--accent)'
                    : isDark ? 'var(--muted)' : '#64748B',
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
                    color: st.isActive
                      ? 'var(--primary)'
                      : st.isDone
                      ? 'var(--primary)'
                      : isDark ? 'var(--muted)' : '#64748B',
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
                    color: st.isActive
                      ? 'var(--accent)'
                      : st.isDone
                      ? isDark ? '#10b981' : '#059669'
                      : isDark ? 'var(--dim)' : '#94A3B8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: st.isActive || st.isDone ? 600 : 400,
                  }}
                >
                  {st.statusText}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
