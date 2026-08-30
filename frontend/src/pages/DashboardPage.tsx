import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { useToast } from '../components/ui/ToastProvider';
import { api } from '../services/api';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { Wave } from '../components/ui/wave';
import {
  Play,
  CheckCircle2,
  ArrowRight,
  Layers,
  Activity,
  ChevronRight,
  ChevronDown,
  FolderGit2,
} from 'lucide-react';
import type { SecurityFinding } from '@/types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    currentProject,
    currentProjectId,
    isLoading,
    displayName,
    repoLabel,
    defaultBranch,
    runs,
    latestRun,
    latestScan,
    isScanActive,
    refreshRuns,
    refreshScans,
    refreshProjects,
    targets,
  } = useRepository();

  const [showWizard, setShowWizard] = useState(false);
  const [showIngestionOverlay, setShowIngestionOverlay] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [triggeringIngest, setTriggeringIngest] = useState(false);
  const [showEngineDetails, setShowEngineDetails] = useState(false);

  const verifiedTargets = targets.filter((t) => t.is_verified);
  const targetCount = targets.length;
  const repoQuery = currentProjectId ? `?repo=${currentProjectId}` : '';

  // Findings computation
  const findings: SecurityFinding[] = useMemo(() => {
    if (!latestRun && !latestScan) return [];
    return [];
  }, [latestRun, latestScan]);

  const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');
  const highFindings = findings.filter((f) => f.severity === 'HIGH');
  const attentionCount = criticalFindings.length + highFindings.length;

  const handleRunAnalysis = async () => {
    if (!currentProjectId) return;

    if (!latestRun || latestRun.status !== 'COMPLETED') {
      setTriggeringIngest(true);
      setShowIngestionOverlay(true);
      try {
        await api.triggerIngestion(currentProjectId);
        toast.success('Codebase ingestion initiated.');
        refreshRuns();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to trigger ingestion');
      } finally {
        setTriggeringIngest(false);
      }
      return;
    }

    setTriggeringScan(true);
    try {
      await api.createScan(currentProjectId, latestRun.id);
      toast.success('Security analysis run queued.');
      refreshScans();
      navigate(`/analysis${repoQuery}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setTriggeringScan(false);
    }
  };

  const lastAnalyzedDate = latestScan?.completed_at || latestRun?.completed_at;
  const lastAnalyzedText = lastAnalyzedDate
    ? new Date(lastAnalyzedDate).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  if (isLoading) {
    return (
      <div className="dashboard-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
        <div className="page-container" style={{ padding: '0 24px' }}>
          {/* Header Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-shimmer" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '260px', height: '32px', borderRadius: '6px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '180px', height: '38px', borderRadius: '6px' }} />
          </div>

          {/* Banner Skeleton */}
          <div
            className="skeleton-shimmer"
            style={{
              width: '100%',
              height: '90px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '24px',
            }}
          />

          {/* Metric Cards Skeleton Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton-shimmer" style={{ width: '80px', height: '12px', borderRadius: '3px' }} />
                  <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: '60px', height: '28px', borderRadius: '4px' }} />
                <div className="skeleton-shimmer" style={{ width: '140px', height: '12px', borderRadius: '3px' }} />
              </div>
            ))}
          </div>

          {/* Activity Table Skeleton */}
          <div className="card" style={{ padding: '24px', background: 'var(--surface)' }}>
            <div className="skeleton-shimmer" style={{ width: '160px', height: '18px', borderRadius: '4px', marginBottom: '16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer"
                  style={{ width: '100%', height: '48px', borderRadius: '6px' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={FolderGit2}
          title="No repository connected"
          description="Connect a GitHub repository to start scanning code, mapping dependencies, and analyzing vulnerabilities."
          action={
            <button
              className="btn btn-primary"
              onClick={() => setShowWizard(true)}
              style={{ gap: '6px' }}
              id="empty-connect-repo-btn"
            >
              Connect Repository
            </button>
          }
        />
        {showWizard && (
          <ProjectWizardModal
            onClose={() => setShowWizard(false)}
            onCreated={() => {
              setShowWizard(false);
              refreshProjects();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="overview-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* ── Section 1: Minimal Repository Header ───────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
            paddingBottom: '18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 750,
                  letterSpacing: '-0.03em',
                  color: 'var(--primary)',
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {displayName}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                }}
              >
                {defaultBranch}
              </span>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                fontFamily: 'var(--font-code)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <span>{repoLabel || 'Workspace'}</span>
              <span>•</span>
              <span>Last analyzed: {lastAnalyzedText}</span>
            </div>
          </div>

          {/* Single Primary Action Button */}
          <div>
            <button
              className="btn btn-primary"
              onClick={handleRunAnalysis}
              disabled={triggeringScan || triggeringIngest || isScanActive}
              style={{ padding: '7px 16px', fontSize: '12.5px', gap: '8px' }}
              id="overview-run-analysis-btn"
            >
              {isScanActive ? (
                <>
                  <Wave size="xs" color="currentColor" /> Scanning ({latestScan?.progress_percent ?? 0}%)
                </>
              ) : triggeringIngest ? (
                <>
                  <Wave size="xs" color="currentColor" /> Ingesting…
                </>
              ) : triggeringScan ? (
                <>
                  <Wave size="xs" color="currentColor" /> Starting Scan…
                </>
              ) : latestRun?.status === 'COMPLETED' ? (
                <>
                  <Play size={13} fill="currentColor" /> Run Analysis
                </>
              ) : (
                <>
                  <Layers size={13} /> Ingest Codebase
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Section 2: Unified Summary Bar (Single unified surface, no separate boxes) ──── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginBottom: '22px',
            overflow: 'hidden',
          }}
        >
          {/* Item 1: Posture */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Security Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              {attentionCount > 0 ? (
                <>
                  <span className="dot dot-red" />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--critical)' }}>
                    Attention Required
                  </span>
                </>
              ) : (
                <>
                  <span className="dot dot-green" />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>
                    Healthy
                  </span>
                </>
              )}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
              {attentionCount > 0 ? `${attentionCount} items require review` : 'Zero critical findings'}
            </div>
          </div>

          {/* Item 2: Findings */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Findings
              </span>
              <button
                onClick={() => navigate(`/findings${repoQuery}`)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                View →
              </button>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--primary)', marginTop: '4px', fontFamily: 'var(--font-code)' }}>
              {findings.length}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
              {criticalFindings.length} Critical • {highFindings.length} High
            </div>
          </div>

          {/* Item 3: Target Endpoints */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Targets
              </span>
              <button
                onClick={() => navigate(`/targets${repoQuery}`)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Manage →
              </button>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--primary)', marginTop: '4px', fontFamily: 'var(--font-code)' }}>
              {targetCount}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
              {targetCount === 0 ? 'None configured' : `${verifiedTargets.length} / ${targetCount} verified`}
            </div>
          </div>

          {/* Item 4: Analysis Engine Snapshot */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Latest Analysis
              </span>
              <button
                onClick={() => navigate(`/analysis${repoQuery}`)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Runs →
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <StatusBadge status={latestScan?.status || latestRun?.status || 'PENDING'} size="sm" />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
              {latestRun?.files_ingested ?? 0} files indexed
            </div>
          </div>
        </div>

        {/* ── Section 3: Core Workspace Status Banner (Minimal signal-first) ──── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            marginBottom: '20px',
          }}
        >
          {attentionCount > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)' }}>
                  Attention Required ({attentionCount} items)
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '11.5px', padding: '2px 8px', color: 'var(--accent)' }}
                  onClick={() => navigate(`/findings${repoQuery}`)}
                >
                  View all findings →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {findings.slice(0, 3).map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--elevated)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SeverityBadge severity={f.severity} size="sm" />
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>{f.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>{f.file_path || f.engine}</span>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--accent)' }}
                      onClick={() => navigate(`/findings${repoQuery}`)}
                    >
                      Inspect →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--primary)' }}>
                    Repository snapshot is clean
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    No critical or high vulnerabilities detected across AST invariants and scanner engines.
                  </div>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '11.5px', padding: '4px 10px', color: 'var(--accent)', gap: '4px' }}
                onClick={() => navigate(`/findings${repoQuery}`)}
              >
                Inspect Findings <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ── Section 4: Progressive Disclosure (Expandable Engine Status & Activity) ──── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Clickable Header Accordion */}
          <button
            onClick={() => setShowEngineDetails(!showEngineDetails)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--primary)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--primary)' }}>
                Security Engine Pipeline &amp; Activity
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                (OSV, GitLeaks, Semgrep)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontSize: '11.5px', fontFamily: 'var(--font-code)' }}>
              <span>{showEngineDetails ? 'Hide' : 'Details'}</span>
              {showEngineDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          </button>

          {/* Expanded Content on Demand */}
          {showEngineDetails && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
              <div className="data-table-container" style={{ marginBottom: '16px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Engine</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-code)' }}>OSV Scanner</td>
                      <td style={{ color: 'var(--muted)' }}>Dependency Vulnerabilities (SCA)</td>
                      <td><StatusBadge status={latestRun ? 'COMPLETED' : 'PENDING'} size="sm" /></td>
                      <td style={{ fontFamily: 'var(--font-code)' }}>0</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-code)' }}>GitLeaks</td>
                      <td style={{ color: 'var(--muted)' }}>Secret &amp; Credential Leaks</td>
                      <td><StatusBadge status={latestRun ? 'COMPLETED' : 'PENDING'} size="sm" /></td>
                      <td style={{ fontFamily: 'var(--font-code)' }}>0</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-code)' }}>Semgrep</td>
                      <td style={{ color: 'var(--muted)' }}>Static AST Security Testing (SAST)</td>
                      <td><StatusBadge status={latestRun ? 'COMPLETED' : 'PENDING'} size="sm" /></td>
                      <td style={{ fontFamily: 'var(--font-code)' }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Recent Activity */}
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={13} color="var(--accent)" />
                <span>
                  {runs.length > 0
                    ? `Latest Analysis Run #${runs[0].id.slice(0, 8)} recorded with ${runs[0].files_ingested} files indexed.`
                    : 'No previous activity runs recorded.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ingestion Overlay */}
      {showIngestionOverlay && (
        <IngestionOverlay
          isOpen={true}
          projectName={displayName}
          onClose={() => {
            setShowIngestionOverlay(false);
            refreshRuns();
          }}
          onComplete={() => {
            refreshRuns();
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
