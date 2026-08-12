import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';

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
        <LoadingAnimation label="ANALYZING ARVE PROJECT AST GRAPH…" fullScreen={false} />
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

  const name = project.name || project.repository?.name || 'Untitled project';
  const repoFull = project.repository?.full_name || '—';
  const branch = project.branch || 'main';
  const repoUrl = project.repository?.html_url;
  const language = project.repository?.language;
  const isPrivate = project.repository?.private;

  return (
    <div className="project-detail anim-fade-up">
      <HalftoneBackground interactive={false} showHero={false} />

      <button
        className="btn btn-ghost"
        style={{ marginBottom: '20px', paddingLeft: 0, color: 'var(--muted)', fontSize: '12px' }}
        onClick={() => navigate('/dashboard')}
        id="back-btn"
      >
        ← Dashboard
      </button>

      <div className="project-detail-header">
        <h1 className="project-detail-name">{name}</h1>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
          <span>{branch}</span>
          {language && <>• <span>{language}</span></>}
          {isPrivate && <>• <span>Private</span></>}
          • <span style={{ color: project.verified ? 'var(--success)' : 'var(--muted)' }}>
            {project.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      </div>

      <div className="detail-section card card-flat" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div className="detail-section-title">Repository Metadata</div>

        <div className="detail-field">
          <span className="detail-field-key">Repository</span>
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="detail-field-val"
              style={{ color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
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
              : <span style={{ color: 'var(--dim)' }}>Pending</span>}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-field-key">Created</span>
          <span className="detail-field-val">
            {new Date(project.created_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '12px', fontFamily: 'var(--font-code)' }}>
          Upcoming modules
        </div>
        <div className="modules-grid">
          {FUTURE_MODULES.map((module) => (
            <div key={module.title} className="module-card">
              <div className="module-card-title">{module.title}</div>
              <div className="module-card-sub">{module.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
