import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddTargetModal } from '../components/AddTargetModal';
import { VerificationModal } from '../components/VerificationModal';
import { IngestionOverlay } from '../components/ui/IngestionOverlay';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { AppleStyleDock } from '../components/core/AppleStyleDock';
import { useToast } from '../components/ui/ToastProvider';
import { api, type TargetWebsite } from '../services/api';
import {
  Plus,
  GitBranch,
  ArrowUpRight,
  Globe,
  ShieldCheck,
  X,
  Activity,
  Crosshair,
  CheckCircle2,
} from 'lucide-react';
import type { Project } from '@/types';

function projectDisplayName(p?: Project | null): string {
  if (!p) return 'Repository Workspace';
  if (p.name) return p.name;
  if (p.repository?.name) return p.repository.name;
  if (p.repo_name) return p.repo_name.split('/').pop() || p.repo_name;
  return 'Untitled repository';
}

function projectRepoLabel(p?: Project | null): string {
  if (!p) return '';
  if (p.repository?.full_name) return p.repository.full_name;
  if (p.repo_name) return p.repo_name;
  return '';
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  const currentRepoParam = searchParams.get('repo');
  const currentProject = projects.find((p) => p.id === currentRepoParam) || projects[0] || null;

  const [showWizard, setShowWizard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ingestingProjectName, setIngestingProjectName] = useState<string | null>(null);

  const [selectedTarget, setSelectedTarget] = useState<TargetWebsite | null>(null);
  const [addTargetProjectId, setAddTargetProjectId] = useState<{ id: string; name: string } | null>(null);
  const [deleteProjectRequest, setDeleteProjectRequest] = useState<{ id: string; name: string } | null>(null);
  const [deleteTargetRequest, setDeleteTargetRequest] = useState<{ id: string; domain: string } | null>(null);

  const refreshProjects = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectRequest) return;
    const { id, name } = deleteProjectRequest;
    setDeletingId(id);
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.success(`Project "${name}" removed successfully.`);
        setDeleteProjectRequest(null);
        navigate('/dashboard');
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete project');
      },
      onSettled: () => setDeletingId(null),
    });
  };

  const handleDeleteTarget = async () => {
    if (!deleteTargetRequest) return;
    const { id: targetId, domain } = deleteTargetRequest;
    try {
      await api.deleteTarget(targetId);
      refreshProjects();
      toast.success(`Target domain ${domain} removed.`);
      setDeleteTargetRequest(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove target');
    }
  };

  const targets = currentProject?.targets || [];
  const verifiedTargets = targets.filter((t) => t.is_verified);
  const targetCount = targets.length;
  const verificationHealthRate = targetCount > 0 ? Math.round((verifiedTargets.length / targetCount) * 100) : 0;

  // Fetch real analysis runs for active project
  const { data: runs = [] } = useQuery({
    queryKey: ['analysis-runs', currentProject?.id],
    queryFn: () => (currentProject?.id ? api.getAnalysisRuns(currentProject.id) : Promise.resolve([])),
    enabled: !!currentProject?.id,
  });

  const latestRun = runs.length > 0 ? runs[0] : null;
  const filesScannedCount = latestRun?.total_files || 0;
  const astNodesCount = latestRun?.total_lines || 0;
  const scanDurationText = latestRun?.duration_seconds ? `${latestRun.duration_seconds}s` : '—';
  const findingsCount = latestRun?.findings_count ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 56px)', position: 'relative' }}>
      <HalftoneBackground interactive={true} showHero={true} />

      <div className="dashboard anim-fade-up" style={{ paddingBottom: '160px' }}>
        {/* Workspace Command Header (Repo-Specific) */}
        <div className="dashboard-header" style={{ marginBottom: '30px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GitBranch size={15} />
              </div>
              <h1
                className="dashboard-title"
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-ui)',
                  margin: 0,
                }}
              >
                {projectDisplayName(currentProject)}
              </h1>
              {currentProject?.default_branch && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {currentProject.default_branch}
                </span>
              )}
            </div>
            <p
              className="dashboard-sub"
              style={{
                fontSize: '13px',
                color: 'var(--muted)',
                fontFamily: 'var(--font-ui)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{projectRepoLabel(currentProject) || 'Deterministic AST security workspace'}</span>
              <span>•</span>
              <span>AST Invariant Verified</span>
            </p>
          </div>

          {/* Quick Actions for this repository */}
          {currentProject && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setAddTargetProjectId({ id: currentProject.id, name: projectDisplayName(currentProject) })}
                style={{ padding: '7px 14px', fontSize: '12px', gap: '6px' }}
              >
                <Plus size={13} />
                Add Target Domain
              </button>

              <button
                className="btn btn-primary"
                onClick={() => navigate(`/projects/${currentProject.id}`)}
                style={{ padding: '7px 16px', fontSize: '12px', gap: '6px' }}
              >
                Open Code Inspector
                <ArrowUpRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Empty State when no repository connected */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <LoadingAnimation fullScreen={false} />
          </div>
        ) : !currentProject ? (
          <div
            className="duotone-card"
            style={{
              padding: '64px 32px',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              margin: '40px auto',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>
              No connected repository selected
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Connect a GitHub repository to build deterministic AST models, detect vulnerabilities, and map verified attack paths.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setShowWizard(true)}
              style={{ padding: '8px 18px', gap: '8px' }}
            >
              <Plus size={14} /> Connect Repository
            </button>
          </div>
        ) : (
          <>
            {/* 4 Focused Repo-Specific Stat Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Card 1: Security Posture */}
              <div
                className="duotone-card"
                style={{
                  padding: '20px 22px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <ShieldCheck size={15} />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    SECURITY POSTURE
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                    {verifiedTargets.length > 0 ? 'Verified' : 'Active'}
                  </span>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--success, #10B981)',
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
                  AST graph live & monitoring
                </div>
              </div>

              {/* Card 2: Target Endpoints */}
              <div
                className="duotone-card"
                style={{
                  padding: '20px 22px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: 'color-mix(in srgb, var(--info, #0EA5E9) 10%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--info, #0EA5E9)',
                    }}
                  >
                    <Globe size={15} />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    TARGET DOMAINS
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  {targetCount}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
                  {targetCount === 0 ? 'No target domain linked' : `${verifiedTargets.length} authorized`}
                </div>
              </div>

              {/* Card 3: AST Findings */}
              <div
                className="duotone-card"
                style={{
                  padding: '20px 22px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: 'color-mix(in srgb, var(--warning, #F59E0B) 10%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--warning, #D97706)',
                    }}
                  >
                    <Crosshair size={15} />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    AST FINDINGS
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  {findingsCount}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
                  Total vulnerabilities tracked
                </div>
              </div>

              {/* Card 4: Verification Health */}
              <div
                className="duotone-card"
                style={{
                  padding: '20px 22px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)',
                    }}
                  >
                    <Activity size={15} />
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    VERIFICATION HEALTH
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                  {verificationHealthRate}%
                </div>
                <div style={{ fontSize: '12px', color: 'var(--secondary)', marginTop: '4px' }}>
                  Deterministic verification rate
                </div>
              </div>
            </div>

            {/* 3-Column Content Grid: Target Endpoints, Live Scan Telemetry, Workspace Activity */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px',
                marginBottom: '32px',
              }}
            >
              {/* Column 1: Associated Web Target Endpoints */}
              <div
                className="duotone-card"
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-code)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        fontWeight: 600,
                      }}
                    >
                      TARGET ENDPOINTS
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setAddTargetProjectId({ id: currentProject.id, name: projectDisplayName(currentProject) })}
                      style={{ padding: '3px 8px', fontSize: '11px', gap: '4px' }}
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {targets.length > 0 ? (
                      targets.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--elevated)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Globe size={15} color="var(--info)" />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                                {t.domain}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                {t.is_verified ? 'Authorized Production Target' : 'Pending Authorization'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {t.is_verified ? (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: 'var(--success-bg)',
                                  color: 'var(--success)',
                                }}
                              >
                                Verified
                              </span>
                            ) : (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => setSelectedTarget(t)}
                              >
                                Verify
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteTargetRequest({ id: t.id, domain: t.domain })}
                              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '3px' }}
                              title="Remove target"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: '24px 16px',
                          textAlign: 'center',
                          background: 'var(--elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px dashed var(--border-strong)',
                        }}
                      >
                        <div style={{ color: 'var(--muted)', fontSize: '12.5px', marginBottom: '8px' }}>
                          No target website linked to this repository yet.
                        </div>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setAddTargetProjectId({ id: currentProject.id, name: projectDisplayName(currentProject) })}
                          style={{ padding: '4px 12px', fontSize: '11.5px', gap: '4px' }}
                        >
                          <Plus size={12} /> Link Target Domain
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                    {targets.length} connected target endpoint{targets.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setDeleteProjectRequest({ id: currentProject.id, name: projectDisplayName(currentProject) })}
                    style={{ background: 'none', border: 'none', color: 'var(--critical)', fontSize: '11.5px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Disconnect Repository
                  </button>
                </div>
              </div>

              {/* Column 2: Live AST Scan Telemetry & Sparkline */}
              <div
                className="duotone-card"
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      marginBottom: '2px',
                    }}
                  >
                    LIVE SCAN TELEMETRY
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--secondary)', marginBottom: '16px' }}>
                    Deterministic AST call graph for {projectDisplayName(currentProject)}
                  </div>

                  {/* Telemetry Status / Graph */}
                  <div
                    style={{
                      width: '100%',
                      height: '105px',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 'var(--radius-sm)',
                      background: 'color-mix(in srgb, var(--elevated) 40%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                    }}
                  >
                    {runs.length > 0 ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                          Analysis Run #{latestRun?.id?.slice(0, 8) || 'Active'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--success)', fontFamily: 'var(--font-code)' }}>
                          Status: {latestRun?.status || 'COMPLETED'} • {filesScannedCount} files indexed
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '11.5px' }}>
                        No analysis runs recorded yet.<br />
                        Run a security scan to view telemetry.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 Bottom Telemetry Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border)',
                    marginTop: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      FILES SCANNED
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                      {filesScannedCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      LINES OF CODE
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                      {astNodesCount > 0 ? astNodesCount : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      SCAN TIME
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                      {scanDurationText}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      ISSUES FOUND
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                      {findingsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Workspace Activity & Remediation */}
              <div
                id="workspace-activity-card"
                className="duotone-card"
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-code)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      marginBottom: '16px',
                    }}
                  >
                    WORKSPACE ACTIVITY
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {runs.length > 0 || targets.length > 0 ? (
                      <>
                        {runs.slice(0, 2).map((r: any) => (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  background: r.status === 'COMPLETED' ? 'var(--success-bg)' : 'var(--elevated)',
                                  color: r.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {r.status === 'COMPLETED' ? <CheckCircle2 size={16} /> : <Crosshair size={15} />}
                              </div>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>
                                  Analysis Run {r.status?.toLowerCase() || 'completed'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {r.total_files ? `${r.total_files} files analyzed` : 'Ingestion pipeline executed'}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                              {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        ))}

                        {targets.slice(0, 2).map((t: any) => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  background: t.is_verified ? 'var(--success-bg)' : 'var(--elevated)',
                                  color: t.is_verified ? 'var(--success)' : 'var(--info)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Globe size={15} />
                              </div>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>
                                  Target {t.domain} {t.is_verified ? 'verified' : 'linked'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {t.is_verified ? 'Authorized Production Target' : 'Pending verification token'}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div
                        style={{
                          padding: '24px 16px',
                          textAlign: 'center',
                          background: 'var(--elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px dashed var(--border-strong)',
                        }}
                      >
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          No activity recorded yet for this workspace.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/workbench')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '14px 0 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>Open Remediation Workbench</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating AppleStyleDock */}
      <AppleStyleDock />

      {/* Minimalist Sub-Footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          background: 'transparent',
          fontSize: '11px',
          fontFamily: 'var(--font-code)',
          color: 'var(--dim)',
          letterSpacing: '0.06em',
        }}
      >
        <div>ARVE v1.0</div>
        <div>DETERMINISTIC SECURITY ENGINE</div>
      </footer>

      {/* Modals & Overlays */}
      {showWizard && (
        <ProjectWizardModal
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            refreshProjects();
          }}
        />
      )}

      {selectedTarget && (
        <VerificationModal
          target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onTargetUpdated={() => {
            setSelectedTarget(null);
            refreshProjects();
          }}
        />
      )}

      {addTargetProjectId && (
        <AddTargetModal
          projectId={addTargetProjectId.id}
          projectName={addTargetProjectId.name}
          onClose={() => setAddTargetProjectId(null)}
          onTargetAdded={(newTarget: TargetWebsite) => {
            setAddTargetProjectId(null);
            refreshProjects();
            setSelectedTarget(newTarget);
          }}
        />
      )}

      {deleteProjectRequest && (
        <ConfirmModal
          onCancel={() => setDeleteProjectRequest(null)}
          onConfirm={handleDeleteProject}
          title="Disconnect repository workspace?"
          message={`Are you sure you want to disconnect "${deleteProjectRequest.name}"? Its target domain mappings and AST index history will also be removed.`}
          confirmText="Disconnect"
          danger={true}
          busy={deletingId === deleteProjectRequest.id}
        />
      )}

      {deleteTargetRequest && (
        <ConfirmModal
          onCancel={() => setDeleteTargetRequest(null)}
          onConfirm={handleDeleteTarget}
          title="Remove target domain?"
          message={`Are you sure you want to remove "${deleteTargetRequest.domain}" from this repository?`}
          confirmText="Remove Target"
          danger={true}
        />
      )}

      {ingestingProjectName && (
        <IngestionOverlay
          isOpen={true}
          projectName={ingestingProjectName}
          onComplete={() => {
            setIngestingProjectName(null);
            refreshProjects();
          }}
          onClose={() => setIngestingProjectName(null)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
