import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Globe, CheckCircle2, AlertTriangle, ExternalLink, Calendar } from 'lucide-react';
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

  // Compute metrics
  const totalTargets = projects.reduce((acc, p) => acc + (p.targets?.length || 0), 0);
  const verifiedTargets = projects.reduce(
    (acc, p) => acc + (p.targets?.filter((t) => t.is_verified).length || 0),
    0
  );
  const verificationRate = totalTargets > 0 ? Math.round((verifiedTargets / totalTargets) * 100) : 0;

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project and all its targets?')) return;
    setDeletingId(projectId);
    try {
      await api.deleteProject(projectId);
      onRefresh();
    } catch (err) {
      alert('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!window.confirm('Remove this target website from the project?')) return;
    try {
      await api.deleteTarget(targetId);
      onRefresh();
    } catch (err) {
      alert('Failed to remove target');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Overview Metric Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
      }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Active Projects</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#F8FAFC' }}>
            {projects.length}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Target Websites</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#F8FAFC' }}>
            {totalTargets}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Authorized Targets</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#34D399', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {verifiedTargets} <span style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 400 }}>/ {totalTargets}</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Authorization Progress</div>
          <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', color: 'var(--primary)' }}>
            {verificationRate}%
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${verificationRate}%`, height: '100%', background: 'linear-gradient(90deg, #00F0FF, #34D399)', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Security Testing Projects</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Only verified targets with active ownership verification (.well-known) can be scanned.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenNewProject}>
          <Plus size={18} /> Create Project
        </button>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ShieldCheck size={48} color="var(--primary)" style={{ opacity: 0.8, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>No Security Projects Found</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 24px' }}>
            Get started by creating your first project and defining your target website domain.
          </p>
          <button className="btn btn-primary" onClick={onOpenNewProject}>
            <Plus size={18} /> Create Your First Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {projects.map((project) => {
            const projTargets = project.targets || [];
            const projVerifiedCount = projTargets.filter((t) => t.is_verified).length;

            return (
              <div key={project.id} className="glass-card glass-card-interactive" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {project.name}
                    </h3>
                    
                    {/* Linked GitHub Repo Badge */}
                    {project.repo_name && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ExternalLink size={13} /> {project.repo_name}
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>({project.default_branch || 'main'})</span>
                      </div>
                    )}

                    {project.description && (
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>{project.description}</p>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} /> Created {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAddTargetProjectId({ id: project.id, name: project.name })}
                    >
                      <Plus size={15} /> Add Target Website
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={deletingId === project.id}
                      title="Delete Project"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Targets Table / List */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Target Domains ({projVerifiedCount}/{projTargets.length} Authorized)
                    </span>
                  </div>

                  {projTargets.length === 0 ? (
                    <div style={{
                      padding: '16px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-dim)',
                      textAlign: 'center'
                    }}>
                      No target domains added yet. Click "Add Target Website" to add a domain to authorize.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {projTargets.map((target) => (
                        <div
                          key={target.id}
                          style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Globe size={18} color="var(--primary)" />
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {target.domain}
                                <a
                                  href={`http://${target.domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--text-dim)' }}
                                  title="Open website"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }} className="mono">
                                Token: {target.verification_token.substring(0, 24)}...
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-unverified'}`}>
                              {target.is_verified ? (
                                <>
                                  <CheckCircle2 size={13} /> AUTHORIZED
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={13} /> UNVERIFIED
                                </>
                              )}
                            </span>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedTarget(target)}
                            >
                              {target.is_verified ? 'Manage Authorization' : 'Verify Ownership'}
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '6px' }}
                              onClick={() => handleDeleteTarget(target.id)}
                              title="Remove target domain"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Target Verification Modal */}
      {selectedTarget && (
        <VerificationModal
          target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onTargetUpdated={() => {
            onRefresh();
            // refresh selected target state if modal remains open
            api.getProjects().then((projs) => {
              for (const p of projs) {
                const found = p.targets?.find((t) => t.id === selectedTarget.id);
                if (found) setSelectedTarget(found);
              }
            });
          }}
        />
      )}

      {/* Add Target Modal */}
      {addTargetProjectId && (
        <AddTargetModal
          projectId={addTargetProjectId.id}
          projectName={addTargetProjectId.name}
          onClose={() => setAddTargetProjectId(null)}
          onTargetAdded={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
