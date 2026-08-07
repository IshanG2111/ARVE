import React, { useState } from 'react';
import { X, Globe, AlertCircle } from 'lucide-react';
import { api, type TargetWebsite } from '../services/api';

interface AddTargetModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onTargetAdded: (target: TargetWebsite) => void;
}

export const AddTargetModal: React.FC<AddTargetModalProps> = ({
  projectId,
  projectName,
  onClose,
  onTargetAdded
}) => {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const newTarget = await api.addTarget(projectId, domain);
      onTargetAdded(newTarget);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add target website';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="card modal" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} color="var(--cyan)" />
              Add Target Domain
            </div>
            <div className="modal-sub">{projectName}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="close-add-target">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: '20px' }}>
            <label className="label">Target Domain / URL</label>
            <div className="input-wrap">
              <span className="input-icon"><Globe size={14} /></span>
              <input
                type="text"
                required
                className="input"
                placeholder="my-site.com or https://staging.my-site.com"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                autoFocus
                id="target-domain-input"
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
              Only add domains you own or are explicitly authorized to test.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} id="submit-add-target">
              {loading ? 'Adding…' : 'Add & Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
