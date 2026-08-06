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
    } catch (err: any) {
      setError(err.message || 'Failed to add target website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={24} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Add Security Target</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Project: {projectName}</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#FDA4AF',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Target Website Domain / URL *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="my-site.com or https://staging.my-site.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Only add domains you own or are explicitly authorized to test.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Target & Generate Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
