import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle, RefreshCw, Globe, ExternalLink } from 'lucide-react';
import { api, type TargetWebsite, type VerificationResult } from '../services/api';
import { CodeBlock } from './ui/code-block';

interface VerificationModalProps {
  target: TargetWebsite;
  onClose: () => void;
  onTargetUpdated: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ target, onClose, onTargetUpdated }) => {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const fileName = 'arve-verification.txt';
  const expectedUrl = `http://${target.domain}/.well-known/${fileName}`;

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
            <Globe size={16} color={target.is_verified ? 'var(--success)' : 'var(--medium)'} />
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
          <p style={{ fontSize: '12px', color: 'var(--secondary)', marginBottom: '16px' }}>
            Upload <code style={{ color: 'var(--accent)' }}>{fileName}</code> containing the token to the path below:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CodeBlock
              tabs={[
                {
                  label: fileName,
                  code: target.verification_token,
                  language: 'txt',
                },
                {
                  label: 'cURL test',
                  code: `curl -I ${expectedUrl}`,
                  language: 'bash',
                },
              ]}
            />

            <div>
              <div className="label" style={{ marginBottom: '4px', fontSize: '11px', color: 'var(--muted)' }}>
                Target verification URL
              </div>
              <div style={{ fontFamily: 'var(--font-code)', fontSize: '11px', color: 'var(--dim)', wordBreak: 'break-all', background: 'rgba(210,206,196,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px dashed var(--border)' }}>
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
              <div style={{ marginTop: '3px', fontFamily: 'var(--font-code)', fontSize: '11px', opacity: 0.6 }}>
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
            style={{ fontSize: '11px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
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
