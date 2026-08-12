import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { LiveScanSimulator } from '../components/LiveScanSimulator';
import { AddTargetModal } from '../components/AddTargetModal';
import { VerificationModal } from '../components/VerificationModal';
import { useToast } from '../components/ui/ToastProvider';
import { api, type TargetWebsite } from '../services/api';
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
} from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: project, isLoading, error, refetch } = useProject(id ?? '');

  const [activeTab, setActiveTab] = useState<'details' | 'scanner'>('details');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TargetWebsite | null>(null);

  const handleDeleteTarget = async (targetId: string, domain: string) => {
    if (!window.confirm(`Remove target domain "${domain}"?`)) return;
    try {
      await api.deleteTarget(targetId);
      refetch();
      toast.success(`Target domain ${domain} removed.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove target');
    }
  };

  if (isLoading) {
    return (
      <div className="screen-center">
        <LoadingAnimation label="PARSING ARVE AST GRAPH & TARGET METADATA…" fullScreen={false} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail">
        <SpotlightCard spotlightColor="rgba(255, 107, 107, 0.1)">
          <div className="empty-state" style={{ padding: '64px 24px' }}>
            <h2 className="empty-title">Project not found</h2>
            <p className="empty-sub">This project does not exist or you don't have permission to view it.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')} id="back-dashboard">
              Back to Security Command Center
            </button>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  const name = project.name || project.repository?.name || project.repo_name?.split('/').pop() || 'Untitled Project';
  const repoFull = project.repository?.full_name || project.repo_name || '—';
  const branch = project.branch || project.default_branch || 'main';
  const repoUrl = project.repository?.html_url || project.repo_url;
  const language = project.repository?.language || 'TypeScript / Python';
  const targets = project.targets || [];
  const isVerified = project.verified || targets.some((t) => t.is_verified);

  return (
    <div className="project-detail anim-fade-up">
      <HalftoneBackground interactive={false} showHero={false} />

      {/* Navigation Breadcrumb */}
      <button
        className="btn btn-ghost"
        style={{ marginBottom: '20px', paddingLeft: 0, color: 'var(--muted)', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        onClick={() => navigate('/dashboard')}
        id="back-btn"
      >
        <ArrowLeft size={13} /> Return to Command Center
      </button>

      {/* Header Banner */}
      <SpotlightCard spotlightColor="rgba(126, 139, 245, 0.12)" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--primary)' }}>{name}</h1>
              <span className={`badge ${isVerified ? 'badge-verified' : 'badge-pending'}`}>
                <span className={`dot ${isVerified ? 'dot-green' : 'dot-amber'}`} />
                {isVerified ? 'AST Authorized' : 'Pending Domain Auth'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', fontSize: '12px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
              <span style={{ color: 'var(--accent)' }}>{repoFull}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <GitBranch size={12} /> {branch}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Code size={12} /> {language}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddTarget(true)}
              style={{ fontSize: '12px', padding: '8px 14px' }}
            >
              <Plus size={14} /> Add Target Endpoint
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* Sub Tabs */}
      <div className="dashboard-nav-tabs">
        <button
          className={`dashboard-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <Layers size={14} /> Project Details & Endpoints
        </button>
        <button
          className={`dashboard-tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          <Cpu size={14} /> Live AST Security Scanner
        </button>
      </div>

      {activeTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Card */}
          <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.1)">
            <div style={{ padding: '24px' }}>
              <div className="detail-section-title">Repository Specs & Infrastructure</div>

              <div className="detail-field">
                <span className="detail-field-key">GitHub Repository</span>
                {repoUrl ? (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="detail-field-val"
                    style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {repoFull} <ExternalLink size={11} style={{ display: 'inline', marginLeft: '4px' }} />
                  </a>
                ) : (
                  <span className="detail-field-val">{repoFull}</span>
                )}
              </div>

              <div className="detail-field">
                <span className="detail-field-key">Active Branch</span>
                <span className="detail-field-val">{branch}</span>
              </div>

              <div className="detail-field">
                <span className="detail-field-key">Language Runtime</span>
                <span className="detail-field-val">{language}</span>
              </div>

              <div className="detail-field">
                <span className="detail-field-key">Created Date</span>
                <span className="detail-field-val">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </SpotlightCard>

          {/* Configured Endpoints Card */}
          <SpotlightCard spotlightColor="rgba(81, 207, 102, 0.1)">
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div className="detail-section-title" style={{ margin: 0 }}>
                  Configured Target Websites ({targets.length})
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
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '12.5px' }}>No targets linked yet. Add a website URL to prove target domain ownership.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {targets.map((t) => (
                    <div key={t.id} className="target-pill">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Globe size={15} color="var(--accent)" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--primary)' }}>{t.domain}</div>
                          <div style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--dim)' }}>
                            Token: {t.verification_token.substring(0, 26)}…
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`badge ${t.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                          {t.is_verified ? 'Authorized' : 'Pending Verification'}
                        </span>

                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => setSelectedTarget(t)}
                        >
                          Verify Token
                        </button>

                        <button
                          className="btn btn-danger btn-icon"
                          onClick={() => handleDeleteTarget(t.id, t.domain)}
                          style={{ padding: '5px' }}
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
        <LiveScanSimulator projectName={name} />
      )}

      {/* Modals */}
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
            toast.success('Verification updated.');
          }}
        />
      )}
    </div>
  );
};
