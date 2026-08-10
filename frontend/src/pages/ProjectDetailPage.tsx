import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';

const FUTURE_MODULES = [
  { title: 'Static Analysis', desc: 'Scan source code for security vulnerabilities.' },
  { title: 'Dynamic Analysis', desc: 'Runtime security testing against the live deployment.' },
  { title: 'Reports', desc: 'Detailed findings and remediation guidance.' },
  { title: 'Settings', desc: 'Project configuration and access controls.' },
];

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, error } = useProject(id ?? '');

  if (isLoading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail">
        <div className="card empty-state">
          <div className="empty-title">Project not found</div>
          <p className="empty-sub">This project does not exist or you don't have access.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} id="back-dashboard">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const name = project.name || project.repository?.name || project.repo_name?.split('/').pop() || 'Untitled';
  const repoFull = project.repository?.full_name || project.repo_name || '—';
  const branch = project.branch || project.default_branch || 'main';
  const repoUrl = project.repository?.html_url || project.repo_url;
  const language = project.repository?.language;
  const isPrivate = project.repository?.private;

  return (
    <div className="project-detail anim-fade-up">

      {/* Back */}
      <button
        className="btn btn-ghost"
        style={{ marginBottom: '24px', paddingLeft: 0, color: 'var(--muted)', fontSize: '12px' }}
        onClick={() => navigate('/dashboard')}
        id="back-btn"
      >
        ← Dashboard
      </button>

      {/* Header */}
      <div className="project-detail-header">
        <h1 className="project-detail-name">{name}</h1>
        <div className="project-detail-meta">
          <span className="badge badge-neutral">{branch}</span>
          {language && <span className="badge badge-neutral">{language}</span>}
          {isPrivate && <span className="badge badge-lock">Private</span>}
          {project.verified
            ? <span className="badge badge-ok">Verified</span>
            : <span className="badge badge-warn">Unverified</span>
          }
        </div>
      </div>

      {/* Repository info */}
      <div className="detail-section card card-flat" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div className="detail-section-title">Repository</div>

        <div className="detail-field">
          <span className="detail-field-key">Repository</span>
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="detail-field-val"
              style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              {repoFull}
            </a>
          ) : (
            <span className="detail-field-val">{repoFull}</span>
          )}
        </div>

        <div className="detail-field">
          <span className="detail-field-key">Branch</span>
          <span className="detail-field-val">{branch}</span>
        </div>

        {language && (
          <div className="detail-field">
            <span className="detail-field-key">Language</span>
            <span className="detail-field-val">{language}</span>
          </div>
        )}

        <div className="detail-field">
          <span className="detail-field-key">Deployment URL</span>
          <span className="detail-field-val">
            {project.deployment_url || <span style={{ color: 'var(--dim)' }}>—</span>}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-field-key">Verification</span>
          <span className="detail-field-val">
            {project.verified
              ? <span style={{ color: 'var(--success)' }}>Verified</span>
              : <span style={{ color: 'var(--dim)' }}>Pending</span>
            }
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-field-key">Created</span>
          <span className="detail-field-val">
            {new Date(project.created_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          </span>
        </div>
      </div>

      {/* Future modules */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--dim)', marginBottom: '12px' }}>
          Upcoming modules
        </div>
        <div className="modules-grid">
          {FUTURE_MODULES.map((m) => (
            <div key={m.title} className="card module-card" title="Coming in a future sprint">
              <div className="module-card-title">{m.title}</div>
              <div className="module-card-sub">{m.desc}</div>
              <div style={{ marginTop: '10px' }}>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>Coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
