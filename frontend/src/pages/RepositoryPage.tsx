import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { useToast } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { Wave } from '../components/ui/wave';
import { SkeletonCard, SkeletonRibbon } from '../components/ui/skeleton';
import { api } from '../services/api';
import {
  FolderGit2,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  ArrowRight,
  Fingerprint,
  FileCode2,
  Boxes,
  FileCheck,
  Shield,
  FileText,
} from 'lucide-react';
import type { RepositoryFile } from '@/types';

const LANGUAGE_CONFIG: Record<string, { label: string; color: string }> = {
  py: { label: 'Python', color: '#38BDF8' },
  python: { label: 'Python', color: '#38BDF8' },
  ts: { label: 'TypeScript', color: '#3B82F6' },
  typescript: { label: 'TypeScript', color: '#3B82F6' },
  tsx: { label: 'TypeScript (React)', color: '#60A5FA' },
  js: { label: 'JavaScript', color: '#FBBF24' },
  javascript: { label: 'JavaScript', color: '#FBBF24' },
  jsx: { label: 'JavaScript (React)', color: '#FCD34D' },
  md: { label: 'Markdown', color: '#A855F7' },
  markdown: { label: 'Markdown', color: '#A855F7' },
  css: { label: 'CSS', color: '#EC4899' },
  scss: { label: 'SCSS', color: '#F472B6' },
  html: { label: 'HTML', color: '#F97316' },
  htm: { label: 'HTML', color: '#F97316' },
  json: { label: 'JSON', color: '#10B981' },
  yaml: { label: 'YAML', color: '#E11D48' },
  yml: { label: 'YAML', color: '#E11D48' },
  toml: { label: 'TOML', color: '#9CA3AF' },
  sh: { label: 'Shell Script', color: '#6366F1' },
  bash: { label: 'Bash Script', color: '#6366F1' },
  dockerfile: { label: 'Dockerfile', color: '#06B6D4' },
  sql: { label: 'SQL', color: '#F59E0B' },
  graphql: { label: 'GraphQL', color: '#E535AB' },
  rs: { label: 'Rust', color: '#DEA584' },
  go: { label: 'Go', color: '#00ADD8' },
  java: { label: 'Java', color: '#B07219' },
  c: { label: 'C', color: '#555555' },
  cpp: { label: 'C++', color: '#F34B7D' },
};

export const RepositoryPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    currentProject,
    currentProjectId,
    displayName,
    repoLabel,
    defaultBranch,
    latestRun,
    findings = [],
    isLoading: isRepoLoading,
    refreshRuns,
  } = useRepository();

  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [showIngestionOverlay, setShowIngestionOverlay] = useState(false);
  const [triggeringIngest, setTriggeringIngest] = useState(false);

  useEffect(() => {
    if (!latestRun?.id) {
      setFiles([]);
      setLoadingFiles(false);
      return;
    }
    let cancelled = false;
    setLoadingFiles(true);
    api
      .getAnalysisFiles(latestRun.id)
      .then((data: RepositoryFile[]) => {
        if (!cancelled) {
          setFiles(data || []);
          setLoadingFiles(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiles([]);
          setLoadingFiles(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [latestRun?.id]);

  const handleTriggerIngest = async () => {
    if (!currentProjectId) return;
    setTriggeringIngest(true);
    setShowIngestionOverlay(true);
    try {
      await api.triggerIngestion(currentProjectId);
      toast.success('Codebase ingestion triggered.');
      refreshRuns();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to ingest repository');
    } finally {
      setTriggeringIngest(false);
    }
  };

  // Compute normalized language distribution
  const languageStats = useMemo(() => {
    if (!files.length) return [];
    const counts: Record<string, { bytes: number; count: number; rawKey: string }> = {};
    let totalBytes = 0;

    files.forEach((f) => {
      const rawExt = (f.extension || f.language || '').replace(/^\./, '').toLowerCase() || 'other';
      const size = f.size || 500;
      totalBytes += size;
      if (!counts[rawExt]) {
        counts[rawExt] = { bytes: 0, count: 0, rawKey: rawExt };
      }
      counts[rawExt].bytes += size;
      counts[rawExt].count += 1;
    });

    return Object.entries(counts)
      .map(([rawExt, stat]) => {
        const config = LANGUAGE_CONFIG[rawExt] || {
          label: rawExt.toUpperCase(),
          color: '#64748B',
        };
        return {
          key: rawExt,
          name: config.label,
          bytes: stat.bytes,
          count: stat.count,
          percentage: totalBytes > 0 ? (stat.bytes / totalBytes) * 100 : 0,
          color: config.color,
        };
      })
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 6);
  }, [files]);

  const totalSizeKb = useMemo(() => {
    const bytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    return (bytes / 1024).toFixed(1);
  }, [files]);

  const avgFileSizeBytes = useMemo(() => {
    if (!files.length) return '0.0';
    const bytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    return (bytes / files.length / 1024).toFixed(1);
  }, [files]);

  // Extract real detected manifest & configuration files (up to 4 for unified height)
  const discoveredManifests = useMemo(() => {
    const manifestNames = [
      'package.json',
      'package-lock.json',
      'requirements.txt',
      'pyproject.toml',
      'pipfile',
      'go.mod',
      'cargo.toml',
      'dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'tsconfig.json',
      'vite.config.ts',
      'run.py',
    ];

    return files
      .filter((f) => {
        const filename = f.path.split('/').pop()?.toLowerCase() || '';
        return manifestNames.includes(filename);
      })
      .slice(0, 4);
  }, [files]);

  // Extract top 4 largest files in snapshot
  const topLargestFiles = useMemo(() => {
    return [...files].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 4);
  }, [files]);

  if (!currentProject && !isRepoLoading) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={FolderGit2}
          title="No repository selected"
          description="Select or connect a repository to view metadata and architecture snapshot details."
        />
      </div>
    );
  }

  const repoUrl = currentProject?.repo_url;
  const language = currentProject?.repo_language || 'TypeScript / Python';
  const packageManager = currentProject?.repo_package_manager || 'npm / pip';
  const commitSha = latestRun?.commit_sha || latestRun?.id?.slice(0, 8) || 'HEAD';

  return (
    <div className="repository-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* Page Header */}
        <PageHeader
          category="Repository Blueprint"
          title="Repository Architecture &amp; Posture"
          description="Deterministic snapshot telemetry, codebase language composition, discovered build manifests, and scanner readiness."
          actions={
            <button
              className="btn btn-primary"
              onClick={handleTriggerIngest}
              disabled={triggeringIngest}
              style={{ gap: '8px' }}
              id="reingest-repo-btn"
            >
              {triggeringIngest ? (
                <>
                  <Wave size="xs" color="currentColor" /> Ingesting Snapshot…
                </>
              ) : (
                <>
                  <RefreshCw size={13} /> Re-Ingest Snapshot
                </>
              )}
            </button>
          }
        />

        {/* ── Key Repository Specs Ribbon with Generous Column Breathing Room ── */}
        {isRepoLoading ? (
          <SkeletonRibbon />
        ) : (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              marginBottom: '24px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <div style={{ padding: '16px 22px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Connected Repository
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repoLabel || displayName}
                </span>
                {repoUrl && (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                    title="View on GitHub"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Active Branch
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitBranch size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                <span>{defaultBranch}</span>
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Primary Runtime
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                {language}
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Package Ecosystem
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '4px', textTransform: 'uppercase' }}>
                {packageManager}
              </div>
            </div>

            <div style={{ padding: '16px 22px' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                Snapshot Commit
              </div>
              <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--accent)', fontFamily: 'var(--font-code)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Fingerprint size={13} style={{ flexShrink: 0 }} />
                <span>{commitSha.slice(0, 10)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Unified 2x2 Grid with Shimmer Skeleton Loaders ── */}
        {loadingFiles || isRepoLoading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            <SkeletonCard height="280px" />
            <SkeletonCard height="280px" />
            <SkeletonCard height="280px" />
            <SkeletonCard height="280px" />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            {/* Card 1: Language Composition */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '280px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Language Composition
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                    {files.length} indexed files · {totalSizeKb} KB
                  </span>
                </div>

                {/* Progress Bar */}
                {languageStats.length > 0 ? (
                  <>
                    <div
                      style={{
                        height: '12px',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        display: 'flex',
                        background: 'var(--elevated)',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                        marginBottom: '16px',
                      }}
                    >
                      {languageStats.map((stat) => (
                        <div
                          key={stat.name}
                          style={{
                            width: `${stat.percentage}%`,
                            background: stat.color,
                            transition: 'width 400ms ease',
                          }}
                          title={`${stat.name}: ${stat.percentage.toFixed(1)}% (${(stat.bytes / 1024).toFixed(1)} KB)`}
                        />
                      ))}
                    </div>

                    {/* Language Legend Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {languageStats.map((stat) => (
                        <div
                          key={stat.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11.5px',
                            fontFamily: 'var(--font-code)',
                          }}
                        >
                          <span
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              background: stat.color,
                              flexShrink: 0,
                              boxShadow: `0 0 6px ${stat.color}66`,
                            }}
                          />
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{stat.name}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{stat.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-code)' }}>
                    Ingest repository to calculate code distribution.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                }}
              >
                <span>Deterministic AST mapping</span>
                <span style={{ color: 'var(--success, #10B981)', fontWeight: 600 }}>100% Ready</span>
              </div>
            </div>

            {/* Card 2: Discovered Manifests */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '280px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Discovered Manifests
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                    {discoveredManifests.length} build manifests
                  </span>
                </div>

                {discoveredManifests.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--font-code)' }}>
                    No root manifest files discovered in snapshot.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {discoveredManifests.map((m) => (
                      <div
                        key={m.id || m.path}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                          <Boxes size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: '12px',
                              fontFamily: 'var(--font-code)',
                              color: 'var(--primary)',
                              fontWeight: 650,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.path}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--success, #10B981)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-code)',
                            fontWeight: 600,
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          Parsed
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                }}
              >
                <span>Supply-chain dependencies</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Active Track</span>
              </div>
            </div>

            {/* Card 3: Largest Codebase Files */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '280px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode2 size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Largest Codebase Files
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                    By byte size
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topLargestFiles.map((f) => (
                    <div
                      key={f.id || f.path}
                      onClick={() => navigate('/code')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'border-color 140ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                        <FileText size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'var(--font-code)',
                            color: 'var(--primary)',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.path}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', flexShrink: 0, marginLeft: '12px' }}>
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                }}
              >
                <span>Code Intelligence</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Inspect in Viewer →</span>
              </div>
            </div>

            {/* Card 4: Snapshot Telemetry Stats */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '280px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      Snapshot Telemetry
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                    Live metrics
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}
                >
                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                      Files Ingested
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--success, #10B981)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                      {latestRun?.files_ingested || files.length}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                      Files Skipped
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                      {latestRun?.files_skipped || 0}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                      Avg File Size
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 750, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                      {avgFileSizeBytes} KB
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
                      Security Findings
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 750, color: findings.length > 0 ? 'var(--critical, #EF4444)' : 'var(--success, #10B981)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                      {findings.length}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--muted)',
                }}
              >
                <span>SHA256 Fingerprint</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{commitSha.slice(0, 12)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Integration Jump Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Card 1: Code Intelligence */}
          <div
            onClick={() => navigate('/code')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Code2 size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)' }}>
                  Inspect Source Code
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  Interactive Git tree &amp; syntax viewer
                </div>
              </div>
            </div>
            <ArrowRight size={15} color="var(--muted)" />
          </div>

          {/* Card 2: Analysis */}
          <div
            onClick={() => navigate('/analysis')}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Shield size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)' }}>
                  Scanner Pipeline
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  Execute full containerized vulnerability scan
                </div>
              </div>
            </div>
            <ArrowRight size={15} color="var(--muted)" />
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

export default RepositoryPage;
