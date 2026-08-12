import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { Plus, Search, GitBranch, Trash2, ArrowUpRight } from 'lucide-react';
import type { Project } from '../types';

function projectDisplayName(p: Project): string {
  if (p.name) return p.name;
  if (p.repository?.name) return p.repository.name;
  return 'Untitled project';
}

function projectRepoLabel(p: Project): string {
  if (p.repository?.full_name) return p.repository.full_name;
  return '';
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const [showWizard, setShowWizard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project?')) return;
    setDeletingId(id);
    deleteProject.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'you';

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const q = searchTerm.toLowerCase();
    return projects.filter((p) => {
      const name = projectDisplayName(p).toLowerCase();
      const repo = projectRepoLabel(p).toLowerCase();
      return name.includes(q) || repo.includes(q);
    });
  }, [projects, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)' }}>
      <HalftoneBackground interactive={false} showHero={false} />

      <div className="dashboard anim-fade-up">

        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">{displayName}'s workspace</h1>
            <p className="dashboard-sub">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>

          <button
            className="hero-cta"
            onClick={() => setShowWizard(true)}
            id="create-project-btn"
            style={{ fontSize: '12.5px', padding: '9px 18px' }}
          >
            <Plus size={14} />
            New project
          </button>
        </div>

        {/* Search — only if there are projects */}
        {projects.length > 0 && (
          <div className="dashboard-search">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              className="input search-input"
              placeholder="Search projects…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="project-search-input"
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <LoadingAnimation fullScreen={false} />
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state anim-fade-up" style={{ padding: '80px 24px' }}>
            <h2 className="empty-title">No projects yet</h2>
            <p className="empty-sub">
              Connect a GitHub repository to start security analysis.
            </p>
            <button
              className="hero-cta"
              onClick={() => setShowWizard(true)}
              id="empty-create-btn"
            >
              Create first project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No projects match "{searchTerm}"</p>
            <button
              className="btn btn-ghost"
              onClick={() => setSearchTerm('')}
              style={{ marginTop: '12px' }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => navigate(`/projects/${project.id}`)}
                id={`project-card-${project.id}`}
              >
                <div>
                  <div className="project-card-name">{projectDisplayName(project)}</div>
                  <div className="project-card-repo">{projectRepoLabel(project)}</div>
                </div>

                <div className="project-card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--dim)' }}>
                    {project.branch && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GitBranch size={10} />
                        {project.branch}
                      </span>
                    )}
                    <span style={{ color: project.verified ? 'var(--success)' : 'var(--dim)' }}>
                      {project.verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '3px 6px' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}
                    >
                      <ArrowUpRight size={11} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '11px', padding: '3px 6px' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                      disabled={deletingId === project.id}
                      id={`delete-project-${project.id}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
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
    </div>
  );
};
