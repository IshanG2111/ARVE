import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { ARVELoader } from '../components/ui/ARVELoader';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { LiveScanSimulator } from '../components/LiveScanSimulator';
import { AddTargetModal } from '../components/AddTargetModal';
import { VerificationModal } from '../components/VerificationModal';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { AnimatedTabs } from '../components/ui/AnimatedTabs';
import { FileTree, buildFileTree } from '../components/ui/file-tree';
import { useToast } from '../components/ui/ToastProvider';
import { api, type TargetWebsite } from '../services/api';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  ArrowLeft,
  GitBranch,
  Globe,
  ExternalLink,
  Plus,
  Trash2,
  Code,
  Layers,
  Cpu,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: project, isLoading, error, refetch } = useProject(id ?? '');

  const [activeTab, setActiveTab] = useState<'details' | 'scanner'>('details');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TargetWebsite | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [showIngestionOverlay, setShowIngestionOverlay] = useState(false);

  // Ingestion history states
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [runFiles, setRunFiles] = useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [triggeringIngest, setTriggeringIngest] = useState(false);
  const [deleteTargetRequest, setDeleteTargetRequest] = useState<{ id: string; domain: string } | null>(null);
  const [manifestView, setManifestView] = useState<'tree' | 'table'>('tree');

  const projectId = project?.id;

  const fetchRuns = async () => {
    if (!projectId) return;
    setLoadingRuns(true);
    try {
      const data = await api.getAnalysisRuns(projectId);
      setRuns(data);
      if (data.length > 0) {
        const activeRun = data.find((r: any) => r.status === 'COMPLETED') || data[0];
        setSelectedRun(activeRun);
        try {
          const files = await api.getAnalysisFiles(activeRun.id);
          setRunFiles(files || []);
        } catch {
          setRunFiles([]);
        }
      } else {
        setSelectedRun(null);
        setRunFiles([]);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  const fetchRunFiles = async () => {
    if (!selectedRun?.id) return;
    try {
      const data = await api.getAnalysisFiles(selectedRun.id);
      setRunFiles(data || []);
    } catch (err) {
      console.error('Failed to fetch run files:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchRuns();
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedRun?.id) {
      fetchRunFiles();
    } else {
      setRunFiles([]);
    }
  }, [selectedRun?.id]);

  const handleTriggerIngest = async () => {
    if (!projectId) return;
    setTriggeringIngest(true);
    setShowIngestionOverlay(true);
    try {
      await api.triggerIngestion(projectId);
      toast.success('Codebase ingestion pipeline triggered.');
      
      // Dynamic real-time background polling
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const data = await api.getAnalysisRuns(projectId);
          setRuns(data);
          const completedRun = data.find((r: any) => r.status === 'COMPLETED');
          if (completedRun) {
            setSelectedRun(completedRun);
            const files = await api.getAnalysisFiles(completedRun.id);
            setRunFiles(files || []);
          }
          await refetch();
          if (attempts >= 10 || (data.length > 0 && data[0].status === 'COMPLETED')) {
            clearInterval(pollTimer);
          }
        } catch {
          // ignore
        }
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger ingestion');
    } finally {
      setTriggeringIngest(false);
    }
  };

  const handleDeleteTarget = async () => {
    if (!deleteTargetRequest) return;
    const { id: targetId, domain } = deleteTargetRequest;
    try {
      await api.deleteTarget(targetId);
      refetch();
      toast.success(`Target domain ${domain} removed.`);
      setDeleteTargetRequest(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove target');
    }
  };

  const copyToken = (token: string, targetId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(targetId);
    toast.success('Verification token copied');
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="screen-center" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingAnimation fullScreen={false} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail" style={{ maxWidth: '1160px', margin: '0 auto', padding: '36px 28px' }}>
        <SpotlightCard>
          <div className="empty-state" style={{ padding: '64px 24px' }}>
            <h2 className="empty-title">Project not found</h2>
            <p className="empty-sub">This workspace does not exist or you don't have access.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')} id="back-dashboard">
              Return to Command Center
            </button>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  const name = project.name || project.repo_name?.split('/').pop() || 'Untitled Project';
  const repoFull = project.repo_name || '—';
  const branch = project.branch || project.default_branch || 'main';
  const repoUrl = project.repo_url;
  const language = project.repo_language || 'Unknown';
  const targets = project.targets || [];
  const isVerified = project.verified || targets.some((t) => t.is_verified);

  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '32px 28px 64px', position: 'relative', zIndex: 1 }} className="anim-fade-up">
      <HalftoneBackground interactive={false} showHero={false} />

      {/* Navigation Breadcrumb */}
      <button
        className="btn btn-ghost"
        style={{ marginBottom: '18px', paddingLeft: 0, color: 'var(--muted)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        onClick={() => navigate('/dashboard')}
        id="back-btn"
      >
        <ArrowLeft size={13} /> Return to Command Center
      </button>

      {/* Header Banner */}
      <SpotlightCard style={{ marginBottom: '24px' }}>
        <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 650, color: 'var(--primary)' }}>{name}</h1>
              <span className={`badge ${isVerified ? 'badge-verified' : 'badge-pending'}`}>
                <span className={`dot ${isVerified ? 'dot-green' : 'dot-amber'}`} />
                {isVerified ? 'AST Authorized' : 'Pending Domain Auth'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent)' }}>{repoFull}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <GitBranch size={11} /> {branch}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Code size={11} /> {language}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddTarget(true)}
              style={{ fontSize: '12px', padding: '7px 14px' }}
            >
              <Plus size={13} /> Add Target Endpoint
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <AnimatedTabs
          tabs={[
            { id: 'details', label: 'Codebase Specs & Ingestion', icon: <Layers size={13} /> },
            { id: 'scanner', label: 'Live AST Security Scanner', icon: <Cpu size={13} /> },
          ]}
          activeTab={activeTab}
          onChange={(t) => setActiveTab(t as 'details' | 'scanner')}
          layoutIdPrefix="project-detail-tabs"
        />
      </div>

      {activeTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Metadata Card */}
          <SpotlightCard>
            <div style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '16px' }}>
                Repository Specs & Infrastructure
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>GitHub Repository</span>
                  {repoUrl ? (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', fontFamily: 'var(--font-code)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      {repoFull} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>{repoFull}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>Active Branch</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>{branch}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>Language Runtime</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>{language}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>Detected Frameworks</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>{project.repository?.frameworks || 'Standard Runtime'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>Package Manager</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)', textTransform: 'uppercase' }}>
                    {project.repository?.package_manager || 'None'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--muted)' }}>Created Date</span>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
                    {new Date(project.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
          </SpotlightCard>

          {/* Repository Ingestion Card */}
          <SpotlightCard>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Bar: Title, Run Switcher, and Ingest Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                    REPOSITORY CODEBASE INGESTION & AST INDEX
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 650, color: 'var(--primary)', marginTop: '2px' }}>
                    Deterministic AST File Explorer
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {runs.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Run:</span>
                      <select
                        value={selectedRun?.id || ''}
                        onChange={(e) => {
                          const r = runs.find((item) => item.id === e.target.value);
                          if (r) setSelectedRun(r);
                        }}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontFamily: 'var(--font-code)',
                          background: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {runs.map((r) => (
                          <option key={r.id} value={r.id}>
                            #{r.commit_sha ? r.commit_sha.substring(0, 7) : 'Active'} ({r.files_ingested || 0} files) • {r.status}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--elevated)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setManifestView('tree')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-code)',
                        borderRadius: 'var(--radius-xs)',
                        border: 'none',
                        cursor: 'pointer',
                        background: manifestView === 'tree' ? 'var(--surface)' : 'transparent',
                        color: manifestView === 'tree' ? 'var(--primary)' : 'var(--muted)',
                        boxShadow: manifestView === 'tree' ? 'var(--shadow-subtle)' : 'none',
                        fontWeight: manifestView === 'tree' ? 600 : 400,
                      }}
                    >
                      Tree View
                    </button>
                    <button
                      type="button"
                      onClick={() => setManifestView('table')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-code)',
                        borderRadius: 'var(--radius-xs)',
                        border: 'none',
                        cursor: 'pointer',
                        background: manifestView === 'table' ? 'var(--surface)' : 'transparent',
                        color: manifestView === 'table' ? 'var(--primary)' : 'var(--muted)',
                        boxShadow: manifestView === 'table' ? 'var(--shadow-subtle)' : 'none',
                        fontWeight: manifestView === 'table' ? 600 : 400,
                      }}
                    >
                      List View
                    </button>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={handleTriggerIngest}
                    disabled={triggeringIngest || (selectedRun && ['PENDING', 'FETCHING', 'PROCESSING'].includes(selectedRun.status))}
                  >
                    <RefreshCw size={13} className={triggeringIngest ? 'spin' : ''} />
                    {triggeringIngest ? 'Ingesting…' : 'Trigger Ingestion'}
                  </button>
                </div>
              </div>

              {loadingRuns ? (
                <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                  <ARVELoader size={64} />
                </div>
              ) : runs.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', background: 'var(--elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '14px' }}>
                    No ingestion runs recorded yet. Trigger an ingestion to index this repository's AST.
                  </p>
                  <button className="btn btn-primary" onClick={handleTriggerIngest} disabled={triggeringIngest}>
                    Start First Ingestion
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Top Metric Summary across full width */}
                  {selectedRun && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                          {selectedRun.files_found}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                          Files Discovered
                        </div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)', fontFamily: 'var(--font-code)' }}>
                          {selectedRun.files_ingested}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                          Files Ingested
                        </div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning)', fontFamily: 'var(--font-code)' }}>
                          {selectedRun.files_skipped}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                          Files Skipped
                        </div>
                      </div>
                      <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>
                          {selectedRun.package_manager || 'Standard'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                          Package Manager
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Space File Tree / Manifest View */}
                  {runFiles.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', background: 'var(--elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                      <p style={{ color: 'var(--muted)', fontSize: '12.5px' }}>No files indexed in this run.</p>
                    </div>
                  ) : manifestView === 'tree' ? (
                    <div data-lenis-prevent="true" style={{ width: '100%' }}>
                      <FileTree
                        elements={buildFileTree(runFiles)}
                        highlightColor="var(--accent)"
                        title={`Repository File Tree (${runFiles.length} files)`}
                      />
                    </div>
                  ) : (
                    <div
                      data-lenis-prevent="true"
                      style={{
                        maxHeight: '440px',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        touchAction: 'pan-y',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--elevated)', borderBottom: '1px solid var(--border)', color: 'var(--muted)', height: '32px' }}>
                            <th style={{ padding: '8px 14px' }}>File Path</th>
                            <th style={{ padding: '8px 14px' }}>Language</th>
                            <th style={{ padding: '8px 14px' }}>Size</th>
                            <th style={{ padding: '8px 14px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runFiles.map((f: any) => (
                            <tr key={f.id} style={{ borderBottom: '1px solid var(--border)', height: '32px' }}>
                              <td style={{ padding: '8px 14px', fontFamily: 'var(--font-code)', color: 'var(--primary)', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.path}
                              </td>
                              <td style={{ padding: '8px 14px', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px' }}>{f.language}</td>
                              <td style={{ padding: '8px 14px', color: 'var(--muted)' }}>{(f.size / 1024).toFixed(1)} KB</td>
                              <td style={{ padding: '8px 14px' }}>
                                {f.status === 'INGESTED' ? (
                                  <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Ingested</span>
                                ) : (
                                  <span className="badge badge-pending" style={{ fontSize: '10.5px' }} title={f.skip_reason}>Skipped</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* Configured Endpoints Card */}
          <SpotlightCard>
            <div style={{ padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Configured Target Endpoints ({targets.length})
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  onClick={() => setShowAddTarget(true)}
                >
                  <Plus size={12} /> Add Target
                </button>
              </div>

              {targets.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '12px' }}>No target endpoints configured. Add a website URL to prove domain authorization.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {targets.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={14} color="var(--info)" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 550, color: 'var(--primary)' }}>{t.domain}</div>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span>Token: {t.verification_token.substring(0, 22)}…</span>
                            <button
                              onClick={() => copyToken(t.verification_token, t.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                              title="Copy token"
                            >
                              {copiedTokenId === t.id ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${t.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                          <span className={`dot ${t.is_verified ? 'dot-green' : 'dot-amber'}`} />
                          {t.is_verified ? 'Authorized' : 'Pending'}
                        </span>

                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => setSelectedTarget(t)}
                        >
                          Specs
                        </button>

                        <button
                          className="btn btn-danger btn-icon"
                          onClick={() => setDeleteTargetRequest({ id: t.id, domain: t.domain })}
                          style={{ width: '26px', height: '26px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SpotlightCard>
        </div>
      )}

      {activeTab === 'scanner' && (
        <div className="anim-fade-up">
          <LiveScanSimulator projectName={name} />
        </div>
      )}

      {/* Modals & Ingestion Overlay */}
      <IngestionOverlay
        isOpen={showIngestionOverlay}
        projectName={name}
        onClose={() => {
          setShowIngestionOverlay(false);
          fetchRuns();
          refetch();
        }}
        onComplete={() => {
          fetchRuns();
          refetch();
        }}
      />

      {showAddTarget && (
        <AddTargetModal
          projectId={project.id}
          projectName={name}
          onClose={() => setShowAddTarget(false)}
          onTargetAdded={() => {
            setShowAddTarget(false);
            refetch();
            toast.success('Target domain added.');
          }}
        />
      )}

      {selectedTarget && (
        <VerificationModal
          target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onTargetUpdated={() => {
            refetch();
            toast.success('Domain authorization updated.');
          }}
        />
      )}

      {deleteTargetRequest && (
        <ConfirmModal
          title="Remove target domain?"
          message={`Are you sure you want to remove \"${deleteTargetRequest.domain}\" from this project?`}
          confirmText="Remove Target"
          danger
          onConfirm={handleDeleteTarget}
          onCancel={() => setDeleteTargetRequest(null)}
        />
      )}
    </div>
  );
};
