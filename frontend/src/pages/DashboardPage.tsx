import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { ProjectWizardModal } from '../components/ProjectWizardModal';
import { Footer } from '../components/Footer';
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

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'verified' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name'>('newest');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project?')) return;
    setDeletingId(id);
    deleteProject.mutate(id, { onSettled: () => setDeletingId(null) });
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'you';

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const name = projectDisplayName(p).toLowerCase();
        const repo = projectRepoLabel(p).toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || repo.includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        if (filterTab === 'verified') return p.verified;
        if (filterTab === 'pending') return !p.verified;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return projectDisplayName(a).localeCompare(projectDisplayName(b));
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [projects, searchTerm, filterTab, sortBy]);

  const verifiedCount = useMemo(() => projects.filter(p => p.verified).length, [projects]);
  const uniqueReposCount = useMemo(() => new Set(projects.map(p => p.repo_name || p.repository?.full_name).filter(Boolean)).size, [projects]);
  const healthScore = useMemo(() => {
    if (projects.length === 0) return '100%';
    const ratio = (verifiedCount / projects.length) * 100;
    return `${Math.round(ratio)}%`;
  }, [projects, verifiedCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 54px)' }}>
      <div className="dashboard anim-fade-up">

        {/* Dashboard Header */}
        <div className="dashboard-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="status-pulse">
                <span className="pulse-dot" />
                Engine Operational
              </span>
              <span style={{ fontSize: '12px', color: 'var(--dim)' }}>Security Workstation</span>
            </div>
            <h1 className="dashboard-title">
              {isLoading ? 'Security Dashboard' : `${displayName}'s Security Workspace`}
            </h1>
            <p className="dashboard-sub">
              Manage GitHub repositories linked to ARVE remediation &amp; verification projects
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowWizard(true)}
            id="create-project-btn"
            style={{ padding: '10px 18px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create project
          </button>
        </div>

        {/* Stats Strip */}
        <div className="stats-strip">
          <div className="stat-cell">
            <div className="stat-label">Active Projects</div>
            <div className="stat-value">{projects.length}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Linked Repositories</div>
            <div className="stat-value">{uniqueReposCount}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Verified Security Status</div>
            <div className="stat-value" style={{ color: verifiedCount > 0 ? 'var(--success)' : 'var(--primary)' }}>
              {verifiedCount}
            </div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Security Health Index</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {healthScore}
            </div>
          </div>
        </div>

        {/* Control Toolbar: Search, Filters & Sorting */}
        {projects.length > 0 && (
          <div className="dashboard-toolbar">
            <div className="search-box">
              <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search projects or repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                id="project-search-input"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${filterTab === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterTab('all')}
                  id="filter-all"
                >
                  All ({projects.length})
                </button>
                <button
                  className={`filter-tab ${filterTab === 'verified' ? 'active' : ''}`}
                  onClick={() => setFilterTab('verified')}
                  id="filter-verified"
                >
                  Verified ({verifiedCount})
                </button>
                <button
                  className={`filter-tab ${filterTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setFilterTab('pending')}
                  id="filter-pending"
                >
                  Pending ({projects.length - verifiedCount})
                </button>
              </div>

              <select
                className="input select"
                style={{ width: '130px', padding: '6px 28px 6px 10px', fontSize: '12px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'name')}
                id="sort-select"
              >
                <option value="newest">Sort: Newest</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div className="spinner" />
          </div>
        ) : projects.length === 0 ? (
          <div className="card empty-state anim-fade-up">
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--elevated)', border: '1px solid var(--border-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 className="empty-title">No ARVE projects created yet</h2>
            <p className="empty-sub">
              Connect a GitHub repository to run automated security analysis, AST attack graph mapping, and target verification.
            </p>

            <button
              className="btn btn-primary"
              onClick={() => setShowWizard(true)}
              id="empty-create-btn"
              style={{ padding: '10px 22px' }}
            >
              Create first security project
            </button>

            <div className="quickstart-grid">
              <div className="quickstart-card" onClick={() => setShowWizard(true)}>
                <div className="quickstart-num">STEP 1</div>
                <div className="quickstart-title">Link GitHub Repository</div>
                <div className="quickstart-desc">Select target repo and branch using OAuth access tokens.</div>
              </div>
              <div className="quickstart-card" onClick={() => setShowWizard(true)}>
                <div className="quickstart-num">STEP 2</div>
                <div className="quickstart-title">Set Deployment Endpoint</div>
                <div className="quickstart-desc">Optionally configure API target routes for target sandbox runs.</div>
              </div>
              <div className="quickstart-card" onClick={() => setShowWizard(true)}>
                <div className="quickstart-num">STEP 3</div>
                <div className="quickstart-title">Run Verification Engine</div>
                <div className="quickstart-desc">Verify fixes automatically against CWE vulnerability benchmarks.</div>
              </div>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="card empty-state" style={{ padding: '48px 24px' }}>
            <h3 className="empty-title" style={{ fontSize: '15px' }}>No projects match your filter</h3>
            <p className="empty-sub" style={{ fontSize: '12.5px', marginBottom: '16px' }}>
              Try adjusting your search query or filter tab.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => { setSearchTerm(''); setFilterTab('all'); }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="card card-hover project-card"
                onClick={() => navigate(`/projects/${project.id}`)}
                id={`project-card-${project.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <div className="project-card-name">{projectDisplayName(project)}</div>
                    <div className="project-card-repo">{projectRepoLabel(project)}</div>
                  </div>
                  {project.verified ? (
                    <span className="badge badge-ok" style={{ flexShrink: 0 }}>Verified</span>
                  ) : (
                    <span className="badge badge-neutral" style={{ flexShrink: 0 }}>Pending</span>
                  )}
                </div>

                <div className="project-card-meta">
                  {(project.branch || project.default_branch) && (
                    <span className="badge badge-neutral">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="6" y1="3" x2="6" y2="15"/>
                        <circle cx="18" cy="6" r="3"/>
                        <circle cx="6" cy="18" r="3"/>
                        <path d="M18 9a9 9 0 0 1-9 9"/>
                      </svg>
                      {project.branch || project.default_branch}
                    </span>
                  )}
                  {project.deployment_url && (
                    <span className="badge badge-neutral" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {project.deployment_url.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                </div>

                <div className="project-card-footer">
                  <span className="project-card-date">
                    Created {new Date(project.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                      disabled={deletingId === project.id}
                      id={`delete-project-${project.id}`}
                    >
                      {deletingId === project.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Security Activity Feed Widget */}
        {projects.length > 0 && (
          <div className="dashboard-activity">
            <div className="activity-header">
              <div className="activity-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Recent Security Intelligence Stream
              </div>
              <span className="footer-text">Live Audit Log</span>
            </div>

            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-meta">
                  <span className="badge badge-ok">Sync</span>
                  <span>Repository tree &amp; AST graph synchronized</span>
                </div>
                <span className="activity-time">Just now</span>
              </div>
              <div className="activity-item">
                <div className="activity-meta">
                  <span className="badge badge-neutral">OAuth</span>
                  <span>GitHub session authenticated for {displayName}</span>
                </div>
                <span className="activity-time">Active session</span>
              </div>
            </div>
          </div>
        )}

        {showWizard && (
          <ProjectWizardModal
            onClose={() => setShowWizard(false)}
            onCreated={() => setShowWizard(false)}
          />
        )}
      </div>

      <Footer />
    </div>
  );
};
