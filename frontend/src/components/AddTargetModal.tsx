import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  onTargetAdded,
}) => {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const newTarget = await api.addTarget(projectId, domain.trim());
      onTargetAdded(newTarget);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add target website';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-fade-up" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={16} color="var(--accent)" />
              Add Target Endpoint Domain
            </div>
            <div className="modal-sub">{projectName}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="close-add-target">
            <X size={15} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '14px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: '18px' }}>
            <label className="label">Target Domain / Hostname</label>
            <div className="input-wrap">
              <span className="input-icon"><Globe size={14} /></span>
              <input
                type="text"
                required
                className="input"
                placeholder="app.example.com or https://staging.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                autoFocus
                id="target-domain-input"
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
              Only add domains you own or have explicit authorization to verify.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} id="submit-add-target">
              Add Endpoint &amp; Generate Token
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
