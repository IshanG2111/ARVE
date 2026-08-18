import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpotlightCard } from './ui/SpotlightCard';
import { Play, CheckCircle2, ShieldCheck, Terminal, RefreshCw, Cpu, XCircle, Ban } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import { api } from '../services/api';
import type { AnalysisRun, ScanStatusResponse } from '@/types';

interface LiveScanSimulatorProps {
  projectId: string;
  projectName?: string;
  analysisRunId?: string;
  analysisRun?: AnalysisRun | null;
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'INGESTING', 'SCANNING', 'NORMALIZING']);
const TERMINAL_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED']);

function statusLabel(status?: string): string {
  switch (status) {
    case 'QUEUED': return 'Queued';
    case 'INGESTING': return 'Preparing snapshot';
    case 'SCANNING': return 'Running scanner';
    case 'NORMALIZING': return 'Finalizing scan';
    case 'COMPLETED': return 'Completed';
    case 'PARTIAL': return 'Partial';
    case 'FAILED': return 'Failed';
    case 'CANCELLED': return 'Cancelled';
    default: return status || 'Idle';
  }
}

function statusColor(status?: string): string {
  if (status === 'COMPLETED') return 'var(--success)';
  if (status === 'PARTIAL') return 'var(--warning, #F59E0B)';
  if (status === 'FAILED' || status === 'CANCELLED') return 'var(--critical)';
  return 'var(--accent)';
}

export const LiveScanSimulator: React.FC<LiveScanSimulatorProps> = ({
  projectId,
  projectName = 'ARVE Core Repository',
  analysisRunId,
  analysisRun,
}) => {
  const toast = useToast();
  const [scan, setScan] = useState<ScanStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState('Ready to start an asynchronous Phase 3 scan.');
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async (scanId: string) => {
    const current = await api.getScanStatus(scanId);
    setScan(current);
    setMessage(current.current_stage || statusLabel(current.status));
    if (TERMINAL_STATUSES.has(current.status)) {
      stopPolling();
      setLoading(false);
    }
    return current;
  }, [stopPolling]);

  const startPolling = useCallback((scanId: string) => {
    stopPolling();
    void refreshStatus(scanId).catch((error) => {
      stopPolling();
      setLoading(false);
      setMessage(error instanceof Error ? error.message : 'Unable to read scan status');
      toast.error(error instanceof Error ? error.message : 'Unable to read scan status');
    });
    pollRef.current = window.setInterval(() => {
      void refreshStatus(scanId).catch((error) => {
        stopPolling();
        setLoading(false);
        setMessage(error instanceof Error ? error.message : 'Unable to read scan status');
      });
    }, 2000);
  }, [refreshStatus, stopPolling, toast]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (!projectId) {
      setScan(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void api.getProjectScans(projectId)
      .then((scans) => {
        if (cancelled || scans.length === 0) return;
        const latest = scans[0];
        return api.getScanStatus(latest.id);
      })
      .then((latest) => {
        if (cancelled || !latest) return;
        setScan(latest);
        setMessage(latest.current_stage || statusLabel(latest.status));
        if (ACTIVE_STATUSES.has(latest.status)) {
          setLoading(true);
          startPolling(latest.id);
        }
      })
      .catch(() => {
        // A missing scan history is not an error for a new project.
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [projectId, startPolling, stopPolling]);

  const selectedRun = analysisRun ?? null;
  const effectiveRunId = analysisRunId || selectedRun?.id;
  const canStart = Boolean(projectId && effectiveRunId && !loading);

  const startScan = async () => {
    if (!projectId) {
      toast.error('No project is selected.');
      return;
    }
    if (!effectiveRunId) {
      toast.error('No completed Phase 2 analysis run is selected. Ingest the repository first.');
      return;
    }

    setLoading(true);
    setCancelling(false);
    setScan(null);
    setMessage('Submitting scan to the Celery worker queue…');

    try {
      const created = await api.createScan(projectId, effectiveRunId);
      toast.success('Scan queued successfully.');
      startPolling(created.id);
    } catch (error) {
      setLoading(false);
      const text = error instanceof Error ? error.message : 'Failed to start scan';
      setMessage(text);
      toast.error(text);
    }
  };

  const handleCancel = async () => {
    if (!scan || !ACTIVE_STATUSES.has(scan.status)) return;
    setCancelling(true);
    try {
      const cancelled = await api.cancelScan(scan.id);
      setScan((previous) => previous ? { ...previous, ...cancelled, engine_statuses: previous.engine_statuses, engine_runs: previous.engine_runs } : previous);
      stopPolling();
      setLoading(false);
      setMessage(cancelled.current_stage || 'Scan cancelled');
      toast.success('Scan cancellation requested.');
      await refreshStatus(scan.id);
    } catch (error) {
      setCancelling(false);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel scan');
    }
  };

  const progress = scan?.progress_percent ?? 0;
  const currentStatus = scan?.status;
  const active = currentStatus ? ACTIVE_STATUSES.has(currentStatus) : loading;
  const terminal = currentStatus ? TERMINAL_STATUSES.has(currentStatus) : false;
  const engineRuns = scan?.engine_runs ?? [];

  const timeline = useMemo(() => {
    const items: string[] = [];
    if (scan?.created_at) items.push('[QUEUE] Scan accepted by API and queued for asynchronous execution.');
    if (scan?.status === 'INGESTING' || ['SCANNING', 'NORMALIZING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(scan?.status || '')) {
      items.push('[SNAPSHOT] Validating the selected Phase 2 commit-pinned repository snapshot.');
    }
    if (['SCANNING', 'NORMALIZING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(scan?.status || '')) {
      items.push('[DOCKER] Executing the registered scanner engine inside the isolated container.');
    }
    if (scan?.status === 'NORMALIZING' || terminal) {
      items.push(`[RESULT] ${statusLabel(scan?.status)} — orchestration lifecycle updated.`);
    }
    if (scan?.error_message) items.push(`[ERROR] ${scan.error_message}`);
    return items;
  }, [scan, terminal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SpotlightCard>
        <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>
                  Phase 3 Scan Orchestration
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '1px' }}>
                  Target Repository: <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)', fontWeight: 550 }}>{projectName}</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {active && (
              <button className="btn btn-secondary" onClick={handleCancel} disabled={cancelling} style={{ padding: '8px 14px', gap: '7px' }}>
                {cancelling ? <RefreshCw size={13} className="spin" /> : <Ban size={13} />}
                {cancelling ? 'Cancelling…' : 'Cancel Scan'}
              </button>
            )}
            <button className="btn btn-primary" onClick={startScan} disabled={!canStart} style={{ padding: '8px 16px', gap: '7px' }}>
              {active ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
              {active ? `Scanning (${progress}%)` : terminal ? 'Run Again' : 'Run Scan'}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 24px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', marginBottom: '6px' }}>
            <span>{message}</span>
            <span style={{ color: statusColor(currentStatus) }}>{currentStatus ? `${statusLabel(currentStatus)} · ${progress}%` : 'READY'}</span>
          </div>
          <div style={{ height: '3px', background: 'var(--elevated)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: statusColor(currentStatus), transition: 'width 0.4s ease' }} />
          </div>
          {selectedRun && (
            <div style={{ marginTop: '10px', fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
              Phase 2 snapshot: {selectedRun.id.slice(0, 8)} · commit {selectedRun.commit_sha?.slice(0, 12) || 'unknown'} · {selectedRun.files_ingested} ingested files
            </div>
          )}
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--muted)" />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            SCAN ORCHESTRATION LOG
          </span>
        </div>
        <div style={{ padding: '16px 20px', background: 'var(--terminal-bg)', color: 'var(--terminal-text)', fontFamily: 'var(--font-code)', fontSize: '11.5px', minHeight: '140px', maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {timeline.length === 0 ? (
            <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}>
              Ready to start a real asynchronous Phase 3 scan. The selected Phase 2 snapshot will be materialized and executed in Docker.
            </span>
          ) : timeline.map((line, index) => (
            <div key={`${line}-${index}`} style={{ opacity: 0.92, lineHeight: '1.5' }}>{line}</div>
          ))}
          {engineRuns.map((engine) => (
            <div key={engine.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '3px' }}>
              <span>[ENGINE] {engine.engine_name}</span>
              <span style={{ color: engine.status === 'SUCCESS' ? 'var(--success)' : engine.status === 'FAILED' || engine.status === 'TIMEOUT' ? 'var(--critical)' : 'var(--muted)' }}>{engine.status}</span>
            </div>
          ))}
        </div>
      </SpotlightCard>

      {scan && (
        <SpotlightCard>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>Scan {scan.id.slice(0, 8)}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '3px' }}>
                  Commit {scan.commit_sha.slice(0, 12)} · Analysis Run {scan.analysis_run_id.slice(0, 8)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: statusColor(scan.status), fontSize: '12px', fontWeight: 600 }}>
                {scan.status === 'COMPLETED' ? <CheckCircle2 size={15} /> : scan.status === 'FAILED' || scan.status === 'CANCELLED' ? <XCircle size={15} /> : <RefreshCw size={14} className={active ? 'spin' : ''} />}
                {statusLabel(scan.status)}
              </div>
            </div>

            {scan.error_message && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', color: 'var(--secondary)', fontSize: '11px', marginBottom: '12px' }}>
                {scan.error_message}
              </div>
            )}

            {scan.status === 'COMPLETED' ? (
              <div style={{ padding: '20px', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)' }}>
                <ShieldCheck size={22} color="var(--success)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>Phase 3 orchestration completed</div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  The repository snapshot was validated and the registered Phase 3 scanner completed successfully. Security findings are intentionally deferred to Phase 4/5.
                </p>
              </div>
            ) : scan.status === 'PARTIAL' ? (
              <div style={{ padding: '20px', textAlign: 'center', borderRadius: 'var(--radius-md)', background: 'var(--elevated)' }}>
                <XCircle size={22} color="var(--warning, #F59E0B)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>Scan completed partially</div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  One or more scanner executions failed or timed out. This is an expected Phase 3 terminal state, not a false success.
                </p>
              </div>
            ) : null}
          </div>
        </SpotlightCard>
      )}
    </div>
  );
};

export default LiveScanSimulator;
