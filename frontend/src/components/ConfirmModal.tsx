import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  busy = false,
}) => (
  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
    <div className="card modal" style={{ maxWidth: '430px' }} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: danger ? 'var(--critical-bg)' : 'var(--surface)',
            border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
            color: danger ? 'var(--critical)' : 'var(--primary)',
            flexShrink: 0,
          }}>
            <AlertTriangle size={17} />
          </div>
          <div>
            <div className="modal-title" id="confirm-modal-title">{title}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onCancel} disabled={busy} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--secondary)', lineHeight: 1.6, marginBottom: '22px' }}>
        {message}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {cancelText && (
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
        )}
        <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait…' : confirmText}
        </button>
      </div>
    </div>
  </div>
);
