import React, { useState } from 'react';
import { useRepository } from '../context/RepositoryContext';
import { useToast } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { AddTargetModal } from '../components/AddTargetModal';
import { VerificationModal } from '../components/VerificationModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { api, type TargetWebsite } from '../services/api';
import {
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

export const TargetsPage: React.FC = () => {
  const toast = useToast();
  const { currentProject, currentProjectId, displayName, targets, refreshProjects } = useRepository();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVerifyTarget, setSelectedVerifyTarget] = useState<TargetWebsite | null>(null);
  const [deleteTargetRequest, setDeleteTargetRequest] = useState<{ id: string; domain: string } | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const copyToken = (token: string, targetId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(targetId);
    toast.success('Verification token copied to clipboard.');
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleDeleteTarget = async () => {
    if (!deleteTargetRequest) return;
    try {
      await api.deleteTarget(deleteTargetRequest.id);
      toast.success(`Target ${deleteTargetRequest.domain} removed.`);
      setDeleteTargetRequest(null);
      refreshProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete target');
    }
  };

  if (!currentProject || !currentProjectId) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={Globe}
          title="No repository selected"
          description="Select or connect a repository to manage its verified deployment targets."
        />
      </div>
    );
  }

  const verifiedCount = targets.filter((t) => t.is_verified).length;

  return (
    <div className="targets-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* Page Header */}
        <PageHeader
          category="Deployment &amp; Domain Verification"
          title="Target Endpoints"
          description="Manage deployment URLs and domain endpoints associated with this repository to verify authorization."
          badge={
            <span
              style={{
                fontSize: '11.5px',
                fontFamily: 'var(--font-code)',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
              }}
            >
              {verifiedCount} / {targets.length} Verified
            </span>
          }
          actions={
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ gap: '6px' }}
              id="add-target-primary-btn"
            >
              <Plus size={13} />
              Add Target
            </button>
          }
        />

        {/* Targets Table / List */}
        {targets.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No target domains configured"
            description="Add a target domain if you want ARVE to associate this repository with a live external application for verified security checks."
            action={
              <button
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ gap: '6px' }}
                id="empty-add-target-btn"
              >
                <Plus size={13} /> Add Target
              </button>
            }
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target Domain</th>
                  <th>Status</th>
                  <th>Verification Token</th>
                  <th>Created</th>
                  <th>Verified At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={15} color="var(--info)" />
                        <span style={{ fontWeight: 650, fontFamily: 'var(--font-code)', color: 'var(--primary)' }}>
                          {t.domain}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={t.is_verified ? 'VERIFIED' : 'PENDING'} size="sm" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-code)', fontSize: '11.5px', color: 'var(--muted)' }}>
                          {t.verification_token.slice(0, 18)}…
                        </span>
                        <button
                          onClick={() => copyToken(t.verification_token, t.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Copy verification token"
                        >
                          {copiedTokenId === t.id ? (
                            <Check size={12} color="var(--success)" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '11.5px', fontFamily: 'var(--font-code)' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '11.5px', fontFamily: 'var(--font-code)' }}>
                      {t.verified_at ? new Date(t.verified_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {!t.is_verified && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '11.5px', padding: '3px 9px' }}
                            onClick={() => setSelectedVerifyTarget(t)}
                          >
                            Verify
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--muted)' }}
                          onClick={() => setDeleteTargetRequest({ id: t.id, domain: t.domain })}
                          title="Remove target"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Target Modal */}
      {showAddModal && (
        <AddTargetModal
          projectId={currentProjectId}
          projectName={displayName}
          onClose={() => setShowAddModal(false)}
          onTargetAdded={(newTarget) => {
            setShowAddModal(false);
            refreshProjects();
            setSelectedVerifyTarget(newTarget);
          }}
        />
      )}

      {/* Verification Modal */}
      {selectedVerifyTarget && (
        <VerificationModal
          target={selectedVerifyTarget}
          onClose={() => setSelectedVerifyTarget(null)}
          onTargetUpdated={() => {
            setSelectedVerifyTarget(null);
            refreshProjects();
          }}
        />
      )}

      {/* Delete Target Modal */}
      {deleteTargetRequest && (
        <ConfirmModal
          onCancel={() => setDeleteTargetRequest(null)}
          onConfirm={handleDeleteTarget}
          title="Remove target endpoint?"
          message={`Are you sure you want to remove "${deleteTargetRequest.domain}" from this workspace?`}
          confirmText="Remove Target"
          danger
        />
      )}
    </div>
  );
};

export default TargetsPage;
