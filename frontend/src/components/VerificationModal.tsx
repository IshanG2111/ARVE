import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, AlertCircle, RefreshCw, Globe, ExternalLink } from 'lucide-react';
import { api, type TargetWebsite, type VerificationResult } from '../services/api';

interface VerificationModalProps {
  target: TargetWebsite;
  onClose: () => void;
  onTargetUpdated: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ target, onClose, onTargetUpdated }) => {
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const fileName = 'arve-verification.txt';
  const expectedUrl = `http(s)://${target.domain}/.well-known/${fileName}`;

  const copy = (text: string, type: 'file' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'file') {
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      const res = await api.verifyTarget(target.id);
      setResult(res);
      if (res.is_verified) onTargetUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during verification';
      setResult({
        target_id: target.id,
        domain: target.domain,
        is_verified: false,
        message: msg,
        checked_url: expectedUrl
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="card modal" style={{ maxWidth: '580px' }}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={16} color={target.is_verified ? 'var(--green)' : 'var(--amber)'} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="modal-title">{target.domain}</span>
                <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                  <span className={`dot ${target.is_verified ? 'dot-green' : 'dot-amber'}`} />
                  {target.is_verified ? 'Authorized' : 'Pending'}
                </span>
              </div>
              <div className="modal-sub">Domain ownership verification</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="close-verify-modal">
            <X size={16} />
          </button>
        </div>

        {/* Instructions */}
        <div style={{
          background: 'rgba(13,17,23,0.6)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '12px' }}>
            Upload <code style={{ color: 'var(--cyan)' }}>arve-verification.txt</code> to{' '}
            <code style={{ color: 'var(--text-1)' }}>{target.domain}/.well-known/</code>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div className="label" style={{ marginBottom: '4px' }}>Filename</div>
              <div className="code-box">
                <span>{fileName}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => copy(fileName, 'file')} title="Copy filename">
                  {copiedFile ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <div>
              <div className="label" style={{ marginBottom: '4px' }}>File content (token)</div>
              <div className="code-box">
                <span style={{ wordBreak: 'break-all', flex: 1 }}>{target.verification_token}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => copy(target.verification_token, 'token')} title="Copy token">
                  {copiedToken ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <div>
              <div className="label" style={{ marginBottom: '4px' }}>Must be accessible at</div>
              <div style={{ font: 'var(--mono)', fontSize: '11.5px', color: 'var(--text-3)', wordBreak: 'break-all', padding: '6px 0' }}>
                {expectedUrl}
              </div>
            </div>
          </div>
        </div>

        {/* Verification result */}
        {result && (
          <div className={`alert ${result.is_verified ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
            {result.is_verified
              ? <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            }
            <div>
              <div style={{ fontWeight: 600 }}>
                {result.is_verified ? 'Domain authorized.' : 'Verification failed.'}
              </div>
              <div style={{ marginTop: '2px', opacity: 0.85 }}>{result.message}</div>
              <div style={{ marginTop: '3px', fontFamily: 'var(--mono)', fontSize: '11px', opacity: 0.6 }}>
                {result.checked_url}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <a
            href={`http://localhost:8000/mock-verification-file/${target.verification_token}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '11px', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
          >
            Dev: test mock file <ExternalLink size={10} />
          </a>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            <button
              className="btn btn-primary"
              onClick={handleVerify}
              disabled={verifying}
              id="run-verify-btn"
            >
              {verifying
                ? <><RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Verifying…</>
                : <><ShieldCheck size={14} /> Run Verification</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
