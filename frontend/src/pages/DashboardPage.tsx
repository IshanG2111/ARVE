import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { useToast } from '../components/ui/ToastProvider';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { Wave } from '../components/ui/wave';
import {
  Play,
  ArrowRight,
  Shield,
  Layers,
  Globe,
  Code2,
  FolderGit2,
  FileCode2,
  Activity,
  Network,
  GitFork,
  Sparkles,
  Zap,
  Lock,
  Database,
  Server,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    currentProject,
    currentProjectId,
    isLoading,
    isProjectLoading,
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
    selectProject,
    targets,
    findings,
  } = useRepository();

  const [showWizard, setShowWizard] = useState(false);
  const [showIngestionOverlay, setShowIngestionOverlay] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [triggeringIngest, setTriggeringIngest] = useState(false);
  const [activeHoverNode, setActiveHoverNode] = useState<string | null>(null);

  const verifiedTargets = targets.filter((t) => t.is_verified);
  const targetCount = targets.length;
  const repoQuery = currentProjectId ? `?repo=${currentProjectId}` : '';

  const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');
  const highFindings = findings.filter((f) => f.severity === 'HIGH');
  const attentionCount = criticalFindings.length + highFindings.length;

    const handleRunAnalysis = async () => {
        if (!currentProjectId) return;

        setTriggeringIngest(true);
        setShowIngestionOverlay(true);

        try {
            // 1. Start a fresh ingestion
            const ingestionRun = await api.triggerIngestion(currentProjectId);

            toast.success('Repository ingestion started.');

            // 2. Poll the actual ingestion run until it reaches a terminal state
            let completedRun = ingestionRun;

            for (let attempt = 0; attempt < 180; attempt++) {
                const runs = await api.getAnalysisRuns(currentProjectId);

                const currentRun = runs.find(
                    (run: any) => run.id === ingestionRun.id
                );

                if (currentRun) {
                    completedRun = currentRun;
                }

                if (currentRun?.status === 'COMPLETED') {
                    break;
                }

                if (
                    currentRun?.status === 'FAILED' ||
                    currentRun?.status === 'CANCELLED'
                ) {
                    throw new Error(
                        currentRun.error_message ||
                        `Repository ingestion ${currentRun.status.toLowerCase()}`
                    );
                }

                // Poll every 2 seconds
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // 3. Make sure ingestion actually completed
            if (completedRun.status !== 'COMPLETED') {
                throw new Error('Repository ingestion timed out.');
            }

            // 4. Refresh the repository state so UI has the new snapshot
            await refreshRuns();

            // 5. Now create the security scan against THIS ingestion run
            setTriggeringIngest(false);
            setTriggeringScan(true);

            await api.createScan(currentProjectId, completedRun.id);

            toast.success('Security analysis run queued.');

            await refreshScans();

            // 6. Move to Analysis page
            navigate(`/analysis${repoQuery}`);
        } catch (err: unknown) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to run complete analysis'
            );
        } finally {
            setTriggeringIngest(false);
            setTriggeringScan(false);
            setShowIngestionOverlay(false);
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

  if (isLoading || (!currentProject && isProjectLoading)) {
    return (
      <div className="dashboard-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
        <div className="page-container" style={{ padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-shimmer" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '240px', height: '28px', borderRadius: '6px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '140px', height: '36px', borderRadius: '6px' }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card skeleton-shimmer"
                style={{ height: '90px', borderRadius: 'var(--radius-lg)' }}
              />
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            <div className="card skeleton-shimmer" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
            <div className="card skeleton-shimmer" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
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
            onCreated={(project) => {
              setShowWizard(false);
              selectProject(project.id);
              refreshProjects();
              navigate(`/overview?repo=${project.id}`, { replace: true });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="overview-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* ── Section 1: Minimalist Header ───────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
            paddingBottom: '20px',
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

        {/* ── Section 2: Real Essential Metrics Grid ────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          {/* Card 1: Security Posture */}
          <div
            className="card"
            style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/findings${repoQuery}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
              <span>Security Posture</span>
              <Shield size={14} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`dot ${attentionCount > 0 ? 'dot-red' : 'dot-green'}`} />
                <span style={{ fontSize: '16px', fontWeight: 750, color: attentionCount > 0 ? 'var(--critical)' : 'var(--success)' }}>
                  {attentionCount > 0 ? `${attentionCount} Critical & High Issues` : 'Clean Snapshot'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                {findings.length > 0 ? `${findings.length} security issues found` : 'No active security issues'}
              </div>
            </div>
          </div>

          {/* Card 2: Indexed Codebase */}
          <div
            className="card"
            style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/code${repoQuery}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
              <span>Indexed Files</span>
              <FileCode2 size={14} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                {latestRun?.files_ingested ?? 0}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                Active Branch: {defaultBranch}
              </div>
            </div>
          </div>

          {/* Card 3: Target Endpoints */}
          <div
            className="card"
            style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/targets${repoQuery}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
              <span>Target Endpoints</span>
              <Globe size={14} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                {targetCount}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                {targetCount === 0 ? 'No endpoints added' : `${verifiedTargets.length} verified domain(s)`}
              </div>
            </div>
          </div>

          {/* Card 4: Latest Pipeline Status */}
          <div
            className="card"
            style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/analysis${repoQuery}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
              <span>Pipeline Status</span>
              <Activity size={14} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StatusBadge status={latestScan?.status || latestRun?.status || 'PENDING'} size="sm" />
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                {runs.length} run(s) recorded
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Future Architecture Visual Placeholders (Phase 5-7 Roadmap) ──── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '18px',
            marginBottom: '24px',
          }}
        >
          {/* Visual Placeholder 1: Project Attack Graph Reconstruction (Phase 7) */}
          <div
            className="card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitFork size={15} color="var(--accent)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                    Project Attack Graph
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-code)',
                    fontWeight: 650,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--accent-muted)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}
                >
                  Phase 7 • Architecture Preview
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
                Reconstructs deterministic exploit paths from external HTTP entrypoints to sensitive data sinks.
              </p>

              {/* Visual Node Flow Mockup */}
              <div
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  overflowX: 'auto',
                }}
              >
                {/* Node 1: Entrypoint */}
                <div
                  onMouseEnter={() => setActiveHoverNode('entry')}
                  onMouseLeave={() => setActiveHoverNode(null)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeHoverNode === 'entry' ? 'var(--elevated-2)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    minWidth: '85px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Server size={13} color="var(--accent)" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)' }}>/api/users/:id</div>
                  <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Entrypoint</div>
                </div>

                <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-code)' }}>──▶</div>

                {/* Node 2: Weakness */}
                <div
                  onMouseEnter={() => setActiveHoverNode('weakness')}
                  onMouseLeave={() => setActiveHoverNode(null)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeHoverNode === 'weakness' ? 'var(--critical-bg)' : 'var(--surface)',
                    border: '1px solid var(--critical-border)',
                    textAlign: 'center',
                    minWidth: '95px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Lock size={13} color="var(--critical)" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--critical)' }}>Missing Auth</div>
                  <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>IDOR / CWE-639</div>
                </div>

                <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-code)' }}>──▶</div>

                {/* Node 3: Sink */}
                <div
                  onMouseEnter={() => setActiveHoverNode('sink')}
                  onMouseLeave={() => setActiveHoverNode(null)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: activeHoverNode === 'sink' ? 'var(--elevated-2)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    minWidth: '85px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Database size={13} color="var(--accent)" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)' }}>User Records</div>
                  <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Sensitive Sink</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                Target: {targets[0]?.domain || 'api.production.app'}
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/analysis${repoQuery}`)}
                style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent)', gap: '4px' }}
              >
                Scan Pipeline <ArrowRight size={11} />
              </button>
            </div>
          </div>

          {/* Visual Placeholder 2: Global Security Knowledge Graph & Patterns (Phase 5/6) */}
          <div
            className="card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Network size={15} color="var(--accent)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                    Security Knowledge Graph
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-code)',
                    fontWeight: 650,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--elevated-2)',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Phase 5/6 • Clustering Roadmap
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
                Interactive Obsidian-style graph correlating AI code patterns, CWE taxonomies, and cross-project attack techniques.
              </p>

              {/* Visual Pattern Clusters Grid */}
              <div
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--primary)',
                  }}
                >
                  <Sparkles size={11} color="var(--accent)" />
                  <span>PATTERN-014 (IDOR)</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--muted)',
                  }}
                >
                  <Zap size={11} />
                  <span>Broken Access Control</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--muted)',
                  }}
                >
                  <span>CWE-639 Invariants</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: 'var(--muted)',
                  }}
                >
                  <span>AI Code Synthesis Vectors</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                Clustering Engine: Neo4j &amp; HDBSCAN
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/code${repoQuery}`)}
                style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent)', gap: '4px' }}
              >
                Code Intelligence <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Section 4: Workspaces & Recent Activity Runs ──────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '18px',
          }}
        >
          {/* Column A: Quick Navigation & Actions */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
              Workspace Navigation
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/analysis${repoQuery}`)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={15} color="var(--accent)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Analysis &amp; Scans</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Execute multi-engine scanners &amp; view logs</div>
                  </div>
                </div>
                <ArrowRight size={13} color="var(--muted)" />
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/findings${repoQuery}`)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Shield size={15} color="var(--accent)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Security Findings</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Triage vulnerabilities, CWEs, and code traces</div>
                  </div>
                </div>
                <ArrowRight size={13} color="var(--muted)" />
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/code${repoQuery}`)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Code2 size={15} color="var(--accent)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Code Intelligence</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Inspect file tree and AST normalized symbols</div>
                  </div>
                </div>
                <ArrowRight size={13} color="var(--muted)" />
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/targets${repoQuery}`)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Globe size={15} color="var(--accent)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Target Endpoints</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Manage domain ownership &amp; verification</div>
                  </div>
                </div>
                <ArrowRight size={13} color="var(--muted)" />
              </button>
            </div>
          </div>

          {/* Column B: Recent Activity Runs */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
                Recent Pipeline Activity
              </div>
              <button
                onClick={() => navigate(`/analysis${repoQuery}`)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11.5px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                View all →
              </button>
            </div>

            {runs.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No analysis runs recorded yet. Click &quot;Ingest Codebase&quot; to initialize.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {runs.slice(0, 4).map((run) => (
                  <div
                    key={run.id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                          Run #{run.id.slice(0, 7)}
                        </span>
                        <StatusBadge status={run.status} size="sm" />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-code)' }}>
                        {run.files_ingested} files indexed • {new Date(run.started_at || run.completed_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent)' }}
                      onClick={() => navigate(`/analysis${repoQuery}`)}
                    >
                      Details →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
