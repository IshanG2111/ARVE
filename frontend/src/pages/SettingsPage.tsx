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
  ChevronDown,
  ChevronRight,
  Shield,
  Cloud,
  CheckCircle2,
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

  // Progressive disclosure accordion state (collapsed by default for advanced technical items)
  const [enginesOpen, setEnginesOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

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
          description="Configure repository workspace parameters, scanning branch, and security engine preferences."
        />

        {/* ── Section 1: Visible by Default — Essential Workspace Parameters ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <div style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--primary)', marginBottom: '4px' }}>
              General Parameters
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '18px' }}>
              Primary settings for repository identification, default branch, and target URL.
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
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
        </div>

        {/* ── Section 2: Progressive Disclosure — Advanced Scan Engines ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => setEnginesOpen(!enginesOpen)}
            style={{
              width: '100%',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--primary)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={16} style={{ color: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 650 }}>Security Scanner Engines</div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Configured vulnerability detection, secret scanning, and AST engines</div>
              </div>
            </div>
            {enginesOpen ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
          </button>

          {enginesOpen && (
            <div style={{ padding: '0 24px 22px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>OSV Scanner (Open Source Vulnerabilities)</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Automated dependency CVE &amp; GHSA evaluation with fixed-version matrix calculation.</div>
                  </div>
                  <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>GitLeaks Secret Scanner</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Identifies hardcoded API tokens, private keys, and environment credentials.</div>
                  </div>
                  <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>Semgrep SAST Engine</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>AST syntax and semantic pattern matching for OWASP Top 10 web vulnerabilities.</div>
                  </div>
                  <span className="badge badge-verified" style={{ fontSize: '10.5px' }}>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 3: Progressive Disclosure — Cloud Artifact Storage (Backblaze B2) ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => setStorageOpen(!storageOpen)}
            style={{
              width: '100%',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--primary)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cloud size={16} style={{ color: '#38BDF8' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 650 }}>Artifact Storage &amp; Backblaze B2</div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Raw scanner JSON payloads and snapshot audit trail destination</div>
              </div>
            </div>
            {storageOpen ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
          </button>

          {storageOpen && (
            <div style={{ padding: '0 24px 22px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: 'var(--secondary)' }}>
                <div style={{ padding: '12px 14px', background: 'var(--elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                    <span style={{ fontWeight: 650, color: 'var(--primary)' }}>Backblaze B2 S3-Compatible Target Active</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    Scanner outputs are securely uploaded to <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>b2://arve-scan-artifacts/scans/&#123;scan_id&#125;/</code> immediately upon engine completion. Temporary execution disk space is safely wiped after upload.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 4: Progressive Disclosure — Danger Zone ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setDangerOpen(!dangerOpen)}
            style={{
              width: '100%',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--primary)',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--critical)' }} />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--critical)' }}>Danger Zone</div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Disconnect repository workspace and permanently erase AST index snapshots</div>
              </div>
            </div>
            {dangerOpen ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
          </button>

          {dangerOpen && (
            <div style={{ padding: '0 24px 22px', borderTop: '1px solid var(--border)', paddingTop: '16px', background: 'rgba(239, 68, 68, 0.02)' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                Disconnecting this repository will permanently delete its AST snapshot history, target endpoints, and all associated security scan run records from ARVE.
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
          )}
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
