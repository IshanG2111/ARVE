import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { useToast } from '../components/ui/ToastProvider';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { EmptyState } from '../components/common/EmptyState';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { Wave } from '../components/ui/wave';
import { Play, Layers, FolderGit2, ArrowRight, GitFork, Network } from 'lucide-react';

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

// Same severity colours as SeverityBadge.
const SEVERITY_STRIP = [
  { key: 'CRITICAL', label: 'Critical', color: 'var(--critical)', hint: 'Fix immediately' },
  { key: 'HIGH', label: 'High', color: '#EA580C', hint: 'Fix this week' },
  { key: 'MEDIUM', label: 'Medium', color: 'var(--warning)', hint: 'Plan a fix' },
  { key: 'LOW', label: 'Low', color: 'var(--info)', hint: 'Low risk' },
];

const ENGINES = [
  { key: 'semgrep', label: 'Semgrep' },
  { key: 'gitleaks', label: 'Gitleaks' },
  { key: 'osv', label: 'OSV-Scanner' },
];

const panelStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  display: 'flex',
  flexDirection: 'column',
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--primary)',
  letterSpacing: '-0.01em',
};

const railCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: '10px 14px',
  gap: '6px',
  minWidth: 0,
};

const phaseChipStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: '10px',
  fontFamily: 'var(--font-code)',
  fontWeight: 650,
  padding: '2px 8px',
  borderRadius: '12px',
};

const phaseDescriptionStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--muted)',
  margin: 0,
  lineHeight: 1.45,
};

const tableHeadCellStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 8px',
  color: 'var(--muted)',
  fontSize: '11px',
  fontWeight: 500,
  fontFamily: 'var(--font-code)',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tableCellStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: '1px solid var(--border)',
  fontSize: '12px',
  verticalAlign: 'middle',
};

const findingLocation = (f: { file_path?: string; line_start?: number }) =>
  f.file_path ? (f.line_start ? `${f.file_path}:${f.line_start}` : f.file_path) : '—';

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
    findings,
  } = useRepository();

  const [showWizard, setShowWizard] = useState(false);
  const [showIngestionOverlay, setShowIngestionOverlay] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [triggeringIngest, setTriggeringIngest] = useState(false);

  const repoQuery = currentProjectId ? `?repo=${currentProjectId}` : '';

  const sortedFindings = useMemo(
    () =>
      [...findings].sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity?.toUpperCase()] ?? 0) - (SEVERITY_RANK[a.severity?.toUpperCase()] ?? 0)
      ),
    [findings]
  );

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => {
      const key = f.severity?.toUpperCase();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [findings]);

  const engineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    findings.forEach((f) => {
      const key = f.engine?.toLowerCase();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [findings]);

  const attentionCount = (severityCounts.CRITICAL ?? 0) + (severityCounts.HIGH ?? 0);

  // The ingestion run the latest scan analysed (falls back to the latest run).
  const analysedRun = runs.find((r) => r.id === latestScan?.analysis_run_id) ?? latestRun;
  const analysedSha = latestScan?.commit_sha || analysedRun?.commit_sha;
  const indexedFileCount = analysedRun?.status === 'COMPLETED' ? analysedRun.files_ingested : undefined;
  const hasCompletedScan = latestScan?.status === 'COMPLETED';
  const isFindingsLoading = isProjectLoading && findings.length === 0 && !isScanActive;

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
    ? new Date(`${lastAnalyzedDate}Z`).toLocaleString(undefined, {
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
              gridTemplateColumns: 'minmax(0, 1fr) 540px',
              gap: '14px',
            }}
          >
            <div className="card skeleton-shimmer" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
            <div className="card skeleton-shimmer" style={{ height: '360px', borderRadius: 'var(--radius-lg)' }} />
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

  // Never render a green "clean" claim: zero findings stays a neutral grey state.
  let verdictText: string;
  let verdictColor = 'var(--muted)';
  if (findings.length > 0) {
    const filesPart = indexedFileCount !== undefined ? ` across ${indexedFileCount} files` : '';
    const attentionPart =
      attentionCount > 0 ? `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention now` : 'none are critical or high';
    verdictText = `${findings.length} issue${findings.length === 1 ? '' : 's'} found${filesPart} — ${attentionPart}.`;
    verdictColor = 'var(--primary)';
  } else if (isScanActive) {
    verdictText = 'Scan in progress — findings will appear when the engines finish.';
  } else if (hasCompletedScan && !isProjectLoading) {
    verdictText = 'No findings from the last scan.';
  } else {
    verdictText = 'Not yet analyzed — run a scan to see findings.';
  }

  return (
    <div className="overview-page anim-fade-up" style={{ padding: '16px 0' }}>
      <div className="page-container" style={{ padding: '0 24px', maxWidth: '1320px' }}>
        {/* ── Section 1: Minimalist Header ───────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '12px',
            paddingBottom: '12px',
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
              {analysedSha && (
                <>
                  <span>•</span>
                  <span title={analysedSha}>Commit: {analysedSha.slice(0, 7)}</span>
                </>
              )}
              {indexedFileCount !== undefined && (
                <>
                  <span>•</span>
                  <span>{indexedFileCount} files indexed</span>
                </>
              )}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: verdictColor, marginTop: '4px' }}>
              {verdictText}
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
                  <Play size={13} fill="currentColor" /> Scan Repository
                </>
              ) : (
                <>
                  <Layers size={13} /> Scan Repository
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Section 2: Severity Strip ─────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '12px',
          }}
        >
          {SEVERITY_STRIP.map((s) => (
            <div
              key={s.key}
              className="card"
              style={{
                padding: '10px 18px',
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
              <div style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>{s.hint}</div>
              <div style={{ marginTop: '4px', fontSize: '18px', fontWeight: 750, color: s.color, fontFamily: 'var(--font-code)' }}>
                {severityCounts[s.key] ?? 0}
              </div>
            </div>
          ))}
        </div>

        {/* ── Section 3: Findings Preview & Side Rail ───────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 540px',
            gap: '14px',
            alignItems: 'stretch',
          }}
        >
          {/* Column A: Findings Preview */}
          <div style={{ ...panelStyle, padding: '14px 16px', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={panelTitleStyle}>Top 10 findings</div>
              {findings.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                  Showing {Math.min(10, findings.length)} of {findings.length}
                </span>
              )}
            </div>

            {isFindingsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ height: '28px', borderRadius: 'var(--radius-md)' }} />
                ))}
              </div>
            ) : findings.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                {isScanActive
                  ? 'Scan in progress. Findings will appear here when the engines finish.'
                  : hasCompletedScan
                    ? 'No findings from the last scan.'
                    : 'No findings yet. Click "Scan Repository" to analyze this codebase.'}
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tableHeadCellStyle, width: '14%' }}>Severity</th>
                      <th style={{ ...tableHeadCellStyle, width: '38%' }}>Title</th>
                      <th style={{ ...tableHeadCellStyle, width: '28%' }}>File:line</th>
                      <th style={{ ...tableHeadCellStyle, width: '10%' }}>CWE</th>
                      <th style={{ ...tableHeadCellStyle, width: '10%' }}>Engine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFindings.slice(0, 10).map((f) => (
                      <tr key={f.id}>
                        <td style={tableCellStyle}>
                          <SeverityBadge severity={f.severity} size="sm" />
                        </td>
                        <td
                          style={{ ...tableCellStyle, color: 'var(--primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={f.title}
                        >
                          {f.title}
                        </td>
                        <td
                          style={{ ...tableCellStyle, color: 'var(--muted)', fontFamily: 'var(--font-code)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={findingLocation(f)}
                        >
                          {findingLocation(f)}
                        </td>
                        <td style={{ ...tableCellStyle, color: 'var(--muted)', fontFamily: 'var(--font-code)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.cwe || '—'}
                        </td>
                        <td style={{ ...tableCellStyle, color: 'var(--muted)', fontFamily: 'var(--font-code)', fontSize: '11px' }}>
                          {f.engine}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pushes the link to the card's bottom edge so it lines up with the rail. */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                  <button
                    onClick={() => navigate(`/findings${repoQuery}`)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11.5px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                  >
                    View all {findings.length} findings →
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Column B: Side rail — two sub-columns so it fits short viewports */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start', gridTemplateRows: 'auto auto 1fr' }}>
            <div style={{ ...railCardStyle, alignSelf: 'stretch' }}>
              <div style={panelTitleStyle}>By engine</div>
              {findings.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No findings to break down yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {ENGINES.map((e) => (
                    <div
                      key={e.key}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}
                    >
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>{e.label}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 650, fontFamily: 'var(--font-code)' }}>
                        {engineCounts[e.key] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...railCardStyle, alignSelf: 'stretch' }}>
              <div style={panelTitleStyle}>Top 3 fixes</div>
              {findings.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Nothing to fix yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sortedFindings.slice(0, 3).map((f) => (
                    <div key={f.id} style={{ minWidth: 0 }}>
                      <div
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={f.title}
                      >
                        {f.title}
                      </div>
                      <div
                        style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={f.file_path}
                      >
                        {f.file_path || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Roadmap: Project Attack Graph (Phase 7) */}
            <div style={{ ...railCardStyle, alignSelf: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitFork size={15} color="var(--accent)" />
                <span style={panelTitleStyle}>Project Attack Graph</span>
              </div>
              <span
                style={{
                  ...phaseChipStyle,
                  background: 'var(--accent-muted)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-border)',
                }}
              >
                Phase 7 • Architecture Preview
              </span>
              <p style={phaseDescriptionStyle}>
                Reconstructs deterministic exploit paths from external HTTP entrypoints to sensitive data sinks.
              </p>
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/analysis${repoQuery}`)}
                style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent)', gap: '4px', alignSelf: 'flex-start', marginLeft: '-8px' }}
              >
                Scan Pipeline <ArrowRight size={11} />
              </button>
            </div>

            {/* Roadmap: Security Knowledge Graph (Phase 5/6) */}
            <div style={{ ...railCardStyle, alignSelf: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={15} color="var(--accent)" />
                <span style={panelTitleStyle}>Security Knowledge Graph</span>
              </div>
              <span
                style={{
                  ...phaseChipStyle,
                  background: 'var(--elevated-2)',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                Phase 5/6 • Clustering Roadmap
              </span>
              <p style={phaseDescriptionStyle}>
                Interactive Obsidian-style graph correlating AI code patterns, CWE taxonomies, and cross-project attack techniques.
              </p>
              <button
                className="btn btn-ghost"
                onClick={() => navigate(`/code${repoQuery}`)}
                style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--accent)', gap: '4px', alignSelf: 'flex-start', marginLeft: '-8px' }}
              >
                Code Intelligence <ArrowRight size={11} />
              </button>
            </div>

            {/* Recent Activity Runs */}
            <div style={{ ...railCardStyle, gridColumn: '1 / -1', alignSelf: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={panelTitleStyle}>Recent Pipeline Activity</div>
                <button
                  onClick={() => navigate(`/analysis${repoQuery}`)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11.5px', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                >
                  View all →
                </button>
              </div>

              {runs.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  No analysis runs recorded yet. Click &quot;Scan Repository&quot; to initialize.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {runs.slice(0, 3).map((run) => (
                    <div
                      key={run.id}
                      title="View run details"
                      style={{
                        padding: '6px 10px',
                        background: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                      onClick={() => navigate(`/analysis${repoQuery}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                          #{run.id.slice(0, 7)}
                        </span>
                        <StatusBadge status={run.status} size="sm" />
                      </div>
                      <div
                        style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'var(--font-code)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {run.files_ingested} files • {new Date(run.started_at || run.completed_at || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
