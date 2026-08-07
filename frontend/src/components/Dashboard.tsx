import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Globe, ExternalLink, Calendar, GitBranch } from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';
import { type Project, type TargetWebsite, api } from '../services/api';
import { VerificationModal } from './VerificationModal';
import { AddTargetModal } from './AddTargetModal';

interface DashboardProps {
  projects: Project[];
  onRefresh: () => void;
  onOpenNewProject: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onRefresh, onOpenNewProject }) => {
  const [selectedTarget, setSelectedTarget] = useState<TargetWebsite | null>(null);
  const [addTargetProjectId, setAddTargetProjectId] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalTargets = projects.reduce((a, p) => a + (p.targets?.length || 0), 0);
  const verifiedTargets = projects.reduce((a, p) => a + (p.targets?.filter((t: TargetWebsite) => t.is_verified).length || 0), 0);
  const verificationRate = totalTargets > 0 ? Math.round((verifiedTargets / totalTargets) * 100) : 0;

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Delete this project and all its targets?')) return;
    setDeletingId(projectId);
    try {
      await api.deleteProject(projectId);
      onRefresh();
    } catch {
      alert('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!window.confirm('Remove this target domain?')) return;
    try {
      await api.deleteTarget(targetId);
      onRefresh();
    } catch {
      alert('Failed to remove target');
    }
  };

  return (
    <div className="dashboard">

      {/* Metrics */}
      <div className="metrics-row">
        <div className="card metric-card">
          <div className="metric-label">Projects</div>
          <div className="metric-value">{projects.length}</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Targets</div>
          <div className="metric-value">{totalTargets}</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Authorized</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>
            {verifiedTargets}
            <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: 400 }}>
              {' '}/{totalTargets}
            </span>
          </div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Auth Rate</div>
          <div className="metric-value" style={{ color: verificationRate === 100 ? 'var(--green)' : 'var(--text-1)' }}>
            {verificationRate}%
          </div>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{ width: `${verificationRate}%` }} />
          </div>
        </div>
      </div>

      {/* Section header */}
      <div className="section-header">
        <div>
          <div className="section-title">Projects</div>
          <div className="section-sub">GitHub repositories linked to verified deployment targets</div>
        </div>
        <button className="btn btn-primary" onClick={onOpenNewProject} id="connect-repo-btn">
          <Plus size={14} />
          Connect Repository
        </button>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">
            <ShieldCheck size={36} />
          </div>
          <div className="empty-title">No repositories connected</div>
          <p className="empty-sub">
            Connect a GitHub repository and specify its deployed website URL to begin security verification.
          </p>
          <button className="btn btn-primary" onClick={onOpenNewProject}>
            <Plus size={14} />
            Connect Repository
          </button>
        </div>
      ) : (
        <div>
          {projects.map((project) => {
            const targets = project.targets || [];
            const verified = targets.filter((t: TargetWebsite) => t.is_verified).length;

            return (
              <div key={project.id} className="card card-interactive project-card">

                {/* Project header */}
                <div className="project-header">
                  <div style={{ minWidth: 0 }}>
                    <div className="project-name">{project.name}</div>

                    {project.repo_name && (
                      <div className="repo-badge">
                        <GitHubIcon size={12} color="var(--cyan)" />
                        <a href={project.repo_url || '#'} target="_blank" rel="noreferrer">
                          {project.repo_name}
                        </a>
                        <span style={{ color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <GitBranch size={10} />
                          {project.default_branch || 'main'}
                        </span>
                      </div>
                    )}

                    {project.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '5px' }}>
                        {project.description}
                      </p>
                    )}

                    <div className="project-meta">
                      <Calendar size={10} />
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="project-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setAddTargetProjectId({ id: project.id, name: project.name || 'Project' })}
                      id={`add-target-${project.id}`}
                    >
                      <Plus size={13} />
                      Add Target
                    </button>
                    <button
                      className="btn btn-danger btn-icon"
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={deletingId === project.id}
                      title="Delete project"
                      id={`delete-project-${project.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Targets */}
                <div className="targets-section">
                  <div className="targets-label">
                    Targets — {verified}/{targets.length} authorized
                  </div>

                  {targets.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(13, 17, 23, 0.5)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      color: 'var(--text-3)',
                      textAlign: 'center'
                    }}>
                      No target URL linked — click "Add Target" to configure a domain.
                    </div>
                  ) : (
                    targets.map((target: TargetWebsite) => (
                      <div key={target.id} className="target-row">
                        <div style={{ minWidth: 0 }}>
                          <div className="target-domain">
                            <Globe size={13} color="var(--text-3)" />
                            {target.domain}
                            <a
                              href={`https://${target.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open website"
                            >
                              <ExternalLink size={10} />
                            </a>
                          </div>
                          <div className="target-token">
                            {target.verification_token.substring(0, 26)}…
                          </div>
                        </div>

                        <div className="target-actions">
                          <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                            <span className={`dot ${target.is_verified ? 'dot-green' : 'dot-amber'}`} />
                            {target.is_verified ? 'Authorized' : 'Pending'}
                          </span>

                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: '12px', padding: '5px 10px' }}
                            onClick={() => setSelectedTarget(target)}
                            id={`verify-target-${target.id}`}
                          >
                            {target.is_verified ? 'Info' : 'Verify'}
                          </button>

                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleDeleteTarget(target.id)}
                            title="Remove target"
                            id={`delete-target-${target.id}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedTarget && (
        <VerificationModal
          target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onTargetUpdated={() => {
            onRefresh();
            api.getProjects().then((projs: Project[]) => {
              for (const p of projs) {
                const found = p.targets?.find((t: TargetWebsite) => t.id === selectedTarget.id);
                if (found) setSelectedTarget(found);
              }
            });
          }}
        />
      )}

      {addTargetProjectId && (
        <AddTargetModal
          projectId={addTargetProjectId.id}
          projectName={addTargetProjectId.name}
          onClose={() => setAddTargetProjectId(null)}
          onTargetAdded={() => { onRefresh(); }}
        />
      )}
    </div>
  );
};
