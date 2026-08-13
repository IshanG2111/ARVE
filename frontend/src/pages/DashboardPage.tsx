import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddTargetModal } from '../components/AddTargetModal';
import { VerificationModal } from '../components/VerificationModal';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { SecurityMetricsWidget } from '../components/SecurityMetricsWidget';
import { LiveScanSimulator } from '../components/LiveScanSimulator';
import { RemediationWorkbench } from '../components/RemediationWorkbench';
import { useToast } from '../components/ui/ToastProvider';
import { api, type TargetWebsite } from '../services/api';
import {
  Plus,
  Search,
  GitBranch,
  Trash2,
  ArrowUpRight,
  Globe,
  ExternalLink,
  ShieldCheck,
  Layers,
  Cpu,
  Zap,
  Copy,
  Check,
  Filter,
} from 'lucide-react';
import type { Project } from '@/types';

function projectDisplayName(p: Project): string {
  if (p.name) return p.name;
  if (p.repository?.name) return p.repository.name;
  if (p.repo_name) return p.repo_name.split('/').pop() || p.repo_name;
  return 'Untitled project';
}

function projectRepoLabel(p: Project): string {
  if (p.repository?.full_name) return p.repository.full_name;
  if (p.repo_name) return p.repo_name;
  return '';
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  const [activeTab, setActiveTab] = useState<'overview' | 'scans' | 'workbench'>('overview');
  const [showWizard, setShowWizard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');

  const [selectedTarget, setSelectedTarget] = useState<TargetWebsite | null>(null);
  const [addTargetProjectId, setAddTargetProjectId] = useState<{ id: string; name: string } | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
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

  const copyToken = (token: string, targetId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(targetId);
    toast.success('Verification token copied');
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const name = projectDisplayName(p).toLowerCase();
      const repo = projectRepoLabel(p).toLowerCase();
      const targets = p.targets || [];
      const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || repo.includes(searchTerm.toLowerCase());

      const isVerified = p.verified || targets.some((t) => t.is_verified);
      if (statusFilter === 'verified' && !isVerified) return false;
      if (statusFilter === 'pending' && isVerified) return false;

      return matchesSearch;
    });
  }, [projects, searchTerm, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 56px)' }}>
      <HalftoneBackground interactive={false} showHero={false} />

      <div className="dashboard anim-fade-up">
        {/* Workspace Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-sub">
              {projects.length} connected repository workspace{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowWizard(true)}
            id="create-project-btn"
            style={{ fontSize: '12.5px', padding: '8px 16px', gap: '8px' }}
          >
            <Plus size={15} />
            Connect Repository
          </button>
        </div>

        {/* Security Metrics Widget */}
        <SecurityMetricsWidget projects={projects} />

        {/* Tab Navigation */}
        <div className="dashboard-nav-tabs">
          <button
            className={`dashboard-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="tab-overview"
          >
            <Layers size={14} /> Repositories & Endpoints
          </button>
          <button
            className={`dashboard-tab-btn ${activeTab === 'scans' ? 'active' : ''}`}
            onClick={() => setActiveTab('scans')}
            id="tab-scans"
          >
            <Cpu size={14} /> Security Scans
          </button>
          <button
            className={`dashboard-tab-btn ${activeTab === 'workbench' ? 'active' : ''}`}
            onClick={() => setActiveTab('workbench')}
            id="tab-workbench"
          >
            <Zap size={14} /> Remediation Workbench
          </button>
        </div>

        {/* TAB 1: OVERVIEW & REPOSITORIES */}
        {activeTab === 'overview' && (
          <div>
            {/* Search & Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div className="dashboard-search" style={{ margin: 0, flex: 1, maxWidth: '360px' }}>
                <Search className="search-icon" size={14} />
                <input
                  type="text"
                  className="input search-input"
                  placeholder="Filter repositories or domain targets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  id="project-search-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} color="var(--muted)" />
                <div className="filter-tabs">
                  <button
                    className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({projects.length})
                  </button>
                  <button
                    className={`filter-tab ${statusFilter === 'verified' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('verified')}
                  >
                    Authorized
                  </button>
                  <button
                    className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pending Auth
                  </button>
                </div>
              </div>
            </div>

            {/* Content Loading */}
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <LoadingAnimation fullScreen={false} />
              </div>
            ) : projects.length === 0 ? (
              <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.06)">
                <div className="empty-state anim-fade-up" style={{ padding: '56px 24px' }}>
                  <ShieldCheck size={40} color="var(--accent)" style={{ marginBottom: '14px', opacity: 0.8 }} />
                  <h2 className="empty-title">No GitHub repositories connected yet</h2>
                  <p className="empty-sub">
                    Link your GitHub repository and configure target domain URLs for security analysis.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowWizard(true)}
                    id="empty-create-btn"
                  >
                    <Plus size={14} /> Connect Repository
                  </button>
                </div>
              </SpotlightCard>
            ) : filteredProjects.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No projects match your filter criteria.</p>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                  style={{ marginTop: '12px' }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredProjects.map((project) => {
                  const targets = project.targets || [];
                  const name = projectDisplayName(project);
                  const repoLabel = projectRepoLabel(project);
                  const branch = project.branch || project.default_branch || 'main';

                  return (
                    <SpotlightCard key={project.id} spotlightColor="rgba(126, 139, 245, 0.06)">
                      <div style={{ padding: '22px 24px' }}>
                        {/* Card Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3
                                style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                                onClick={() => navigate(`/projects/${project.id}`)}
                              >
                                {name}
                              </h3>
                              <span className={`badge ${project.verified || targets.some(t => t.is_verified) ? 'badge-verified' : 'badge-pending'}`}>
                                <span className={`dot ${project.verified || targets.some(t => t.is_verified) ? 'dot-green' : 'dot-amber'}`} />
                                {project.verified || targets.some(t => t.is_verified) ? 'Authorized' : 'Pending Auth'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                              {repoLabel && (
                                <a
                                  href={project.repo_url || `https://github.com/${repoLabel}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--accent)', textDecoration: 'none' }}
                                >
                                  {repoLabel}
                                </a>
                              )}
                              <span>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <GitBranch size={11} /> {branch}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setAddTargetProjectId({ id: project.id, name })}
                              id={`add-target-${project.id}`}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              <Plus size={13} /> Add Target Domain
                            </button>

                            <button
                              className="btn btn-ghost"
                              onClick={() => navigate(`/projects/${project.id}`)}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Details <ArrowUpRight size={13} />
                            </button>

                            <button
                              className="btn btn-danger btn-icon"
                              onClick={() => setDeleteProjectRequest({ id: project.id, name })}
                              disabled={deletingId === project.id}
                              title="Delete project"
                              id={`delete-project-${project.id}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Targets Section */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                            Configured Target Domains ({targets.length})
                          </div>

                          {targets.length === 0 ? (
                            <div
                              style={{
                                padding: '12px 14px',
                                background: 'var(--elevated)',
                                border: '1px dashed var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '12.5px',
                                color: 'var(--muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>No target domain connected.</span>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: '11.5px', padding: '4px 10px', color: 'var(--accent)' }}
                                onClick={() => setAddTargetProjectId({ id: project.id, name })}
                              >
                                + Add Target
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {targets.map((target) => (
                                <div key={target.id} className="target-pill">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <Globe size={15} color="var(--accent)" />
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--primary)' }}>
                                        {target.domain}
                                        <a
                                          href={`https://${target.domain}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ color: 'var(--muted)' }}
                                        >
                                          <ExternalLink size={11} />
                                        </a>
                                      </div>
                                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        Token: {target.verification_token.substring(0, 24)}…
                                        <button
                                          onClick={() => copyToken(target.verification_token, target.id)}
                                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px' }}
                                          title="Copy verification token"
                                        >
                                          {copiedTokenId === target.id ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                                      <span className={`dot ${target.is_verified ? 'dot-green' : 'dot-amber'}`} />
                                      {target.is_verified ? 'Authorized' : 'Pending Auth'}
                                    </span>

                                    <button
                                      className="btn btn-secondary"
                                      style={{ fontSize: '11.5px', padding: '4px 10px' }}
                                      onClick={() => setSelectedTarget(target)}
                                      id={`verify-target-${target.id}`}
                                    >
                                      {target.is_verified ? 'Details' : 'Verify'}
                                    </button>

                                    <button
                                      className="btn btn-danger btn-icon"
                                      onClick={() => setDeleteTargetRequest({ id: target.id, domain: target.domain })}
                                      title="Remove target"
                                      style={{ padding: '5px' }}
                                      id={`delete-target-${target.id}`}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </SpotlightCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCANS */}
        {activeTab === 'scans' && (
          <LiveScanSimulator projectName={projects[0] ? projectDisplayName(projects[0]) : 'ARVE Repository'} />
        )}

        {/* TAB 3: WORKBENCH */}
        {activeTab === 'workbench' && (
          <RemediationWorkbench />
        )}

        {/* Modals */}
        {showWizard && (
          <ProjectWizardModal
            onClose={() => setShowWizard(false)}
            onCreated={() => {
              setShowWizard(false);
              refreshProjects();
              toast.success('New repository connected!');
            }}
          />
        )}

        {addTargetProjectId && (
          <AddTargetModal
            projectId={addTargetProjectId.id}
            projectName={addTargetProjectId.name}
            onClose={() => setAddTargetProjectId(null)}
            onTargetAdded={() => {
              setAddTargetProjectId(null);
              refreshProjects();
              toast.success('Target domain added!');
            }}
          />
        )}

        {selectedTarget && (
          <VerificationModal
            target={selectedTarget}
            onClose={() => setSelectedTarget(null)}
            onTargetUpdated={() => {
              refreshProjects();
              toast.success('Authorization status updated!');
            }}
          />
        )}
        {deleteProjectRequest && (
          <ConfirmModal
            title="Delete project?"
            message={`Are you sure you want to permanently delete project \"${deleteProjectRequest.name}\"? Its targets and ingestion history will also be removed.`}
            confirmText="Delete project"
            danger
            busy={deletingId === deleteProjectRequest.id}
            onConfirm={handleDeleteProject}
            onCancel={() => setDeleteProjectRequest(null)}
          />
        )}

        {deleteTargetRequest && (
          <ConfirmModal
            title="Remove target domain?"
            message={`Are you sure you want to remove \"${deleteTargetRequest.domain}\" from this project?`}
            confirmText="Remove target"
            danger
            onConfirm={handleDeleteTarget}
            onCancel={() => setDeleteTargetRequest(null)}
          />
        )}

      </div>
    </div>
  );
};
