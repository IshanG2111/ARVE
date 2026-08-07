import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import type { Project } from '../types';

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
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const [showWizard, setShowWizard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project?')) return;
    setDeletingId(id);
    deleteProject.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'you';

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            {isLoading ? 'Dashboard' : `${displayName}'s projects`}
          </h1>
          <p className="dashboard-sub">
            GitHub repositories linked to ARVE security projects
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowWizard(true)}
          id="create-project-btn"
        >
          Create project
        </button>
      </div>

      {/* Stats strip */}
      <div className="stats-strip">
        <div className="stat-cell">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{projects.length}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Repositories</div>
          <div className="stat-value">
            {new Set(projects.map(p => p.repo_name || p.repository?.full_name).filter(Boolean)).size}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Verified</div>
          <div className="stat-value">{projects.filter(p => p.verified).length}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Scans</div>
          <div className="stat-value" style={{ color: 'var(--ink-30)' }}>—</div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <div className="spinner" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card empty-state">
          <h2 className="empty-title">No projects yet</h2>
          <p className="empty-sub">
            Connect a GitHub repository to create your first ARVE security project.
          </p>
          <button className="btn btn-primary" onClick={() => setShowWizard(true)} id="empty-create-btn">
            Create project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className="card card-hover project-card"
              onClick={() => navigate(`/projects/${project.id}`)}
              id={`project-card-${project.id}`}
            >
              <div className="project-card-name">{projectDisplayName(project)}</div>
              <div className="project-card-repo">{projectRepoLabel(project)}</div>

              <div className="project-card-meta">
                {(project.branch || project.default_branch) && (
                  <span className="badge badge-neutral">
                    {project.branch || project.default_branch}
                  </span>
                )}
                {project.deployment_url && (
                  <span className="badge badge-neutral" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.deployment_url.replace(/^https?:\/\//, '')}
                  </span>
                )}
                {project.verified && (
                  <span className="badge badge-ok">Verified</span>
                )}
              </div>

              <div className="project-card-footer">
                <span className="project-card-date">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                  disabled={deletingId === project.id}
                  id={`delete-project-${project.id}`}
                >
                  {deletingId === project.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showWizard && (
        <ProjectWizardModal
          onClose={() => setShowWizard(false)}
          onCreated={() => setShowWizard(false)}
        />
      )}
    </div>
  );
};
