import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { useDeleteProject } from '../hooks/useProjects';
import { useToast } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../services/api';
import {
  Settings,
  GitBranch,
  Trash2,
  Globe,
  Save,
  AlertTriangle,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentProject, currentProjectId, displayName, refreshProjects } = useRepository();
  const deleteProject = useDeleteProject();

  const [name, setName] = useState(currentProject?.name || '');
  const [branch, setBranch] = useState(currentProject?.branch || 'main');
  const [deploymentUrl, setDeploymentUrl] = useState(currentProject?.deployment_url || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sync with project on load
  React.useEffect(() => {
    if (currentProject) {
      setName(currentProject.name || '');
      setBranch(currentProject.branch || currentProject.default_branch || 'main');
      setDeploymentUrl(currentProject.deployment_url || '');
    }
  }, [currentProject]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectId) return;
    setSaving(true);
    try {
      await api.updateProject(currentProjectId, {
        name: name.trim() || undefined,
        branch: branch.trim() || 'main',
        deployment_url: deploymentUrl.trim() || undefined,
      });
      toast.success('Repository workspace settings updated.');
      refreshProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentProjectId) return;
    deleteProject.mutate(currentProjectId, {
      onSuccess: () => {
        toast.success(`Repository workspace "${displayName}" disconnected.`);
        setShowDeleteModal(false);
        refreshProjects();
        navigate('/overview');
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to disconnect workspace');
      },
    });
  };

  if (!currentProject || !currentProjectId) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={Settings}
          title="No repository selected"
          description="Select or connect a repository to manage its configuration."
        />
      </div>
    );
  }

  return (
    <div className="settings-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px', maxWidth: '840px' }}>
        {/* Page Header */}
        <PageHeader
          category="Workspace Configuration"
          title="Repository Settings"
          description="Manage workspace parameters, default branch target, and scan pipeline options."
        />

        {/* Unified Settings Surface (Single surface with dividers) */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Section 1: General Parameters */}
          <div style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--primary)', marginBottom: '4px' }}>
              General Parameters
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '18px' }}>
              Update display aliases and branch synchronization targets.
            </p>

            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="field">
                  <label className="label">Workspace Display Name</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workspace Name"
                  />
                </div>

                <div className="field">
                  <label className="label">Default Scanning Branch</label>
                  <div className="input-wrap">
                    <span className="input-icon"><GitBranch size={14} /></span>
                    <input
                      type="text"
                      className="input"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="label">Associated Deployment URL</label>
                  <div className="input-wrap">
                    <span className="input-icon"><Globe size={14} /></span>
                    <input
                      type="text"
                      className="input"
                      value={deploymentUrl}
                      onChange={(e) => setDeploymentUrl(e.target.value)}
                      placeholder="https://app.example.com"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ gap: '6px' }}
                    id="save-settings-btn"
                  >
                    <Save size={13} />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 2: Security Scanner Engines */}
          <div style={{ padding: '24px 28px', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--primary)', marginBottom: '4px' }}>
              Security Scanner Engines
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
              Active scanning components for repository snapshot evaluations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>OSV Scanner Engine</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Analyzes lockfiles and manifests against open source vulnerability databases.</div>
                </div>
                <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>GitLeaks Secret Scanner</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Identifies hardcoded API keys, tokens, credentials, and cryptographic certificates.</div>
                </div>
                <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Semgrep SAST Engine</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Performs syntax and semantic AST rule evaluation for OWASP Top 10 vulnerabilities.</div>
                </div>
                <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
              </div>
            </div>
          </div>

          {/* Section 3: Danger Zone */}
          <div style={{ padding: '24px 28px', borderTop: '1px solid var(--border)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <AlertTriangle size={15} color="var(--critical)" />
              <h3 style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--critical)', margin: 0 }}>
                Danger Zone
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>
              Disconnecting this repository will remove its AST snapshot history, target endpoints, and analysis runs permanently.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteModal(true)}
                style={{ gap: '6px' }}
                id="disconnect-workspace-btn"
              >
                <Trash2 size={13} />
                Disconnect Repository Workspace
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Workspace Modal */}
      {showDeleteModal && (
        <ConfirmModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteWorkspace}
          title="Disconnect repository workspace?"
          message={`Are you sure you want to disconnect "${displayName}"? All associated target domain mappings, AST index snapshots, and security scan history will be permanently deleted.`}
          confirmText="Disconnect Workspace"
          danger
          busy={deleteProject.isPending}
        />
      )}
    </div>
  );
};

export default SettingsPage;
