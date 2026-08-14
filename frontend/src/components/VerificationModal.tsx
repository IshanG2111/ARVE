import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, RefreshCw, Globe, Copy, Check } from 'lucide-react';
import { api, type TargetWebsite, type VerificationResult } from '../services/api';
import { CodeBlock } from './ui/code-block';
import { useToast } from './ui/ToastProvider';

interface VerificationModalProps {
  target: TargetWebsite;
  onClose: () => void;
  onTargetUpdated: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ target, onClose, onTargetUpdated }) => {
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const fileName = 'arve-verification.txt';
  const expectedUrl = `http://${target.domain}/.well-known/${fileName}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      const res = await api.verifyTarget(target.id);
      setResult(res);
      if (res.is_verified) {
        onTargetUpdated();
        toast.success(`Domain ${target.domain} verified and authorized!`);
      } else {
        toast.error(`Verification failed for ${target.domain}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during verification';
      setResult({
        target_id: target.id,
        domain: target.domain,
        is_verified: false,
        message: msg,
        checked_url: expectedUrl,
      });
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const copyExpectedUrl = () => {
    navigator.clipboard.writeText(expectedUrl);
    setCopiedUrl(true);
    toast.success('Verification URL copied');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-fade-up" style={{ maxWidth: '560px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: target.is_verified ? 'var(--success)' : 'var(--info)',
              }}
            >
              <Globe size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="modal-title">{target.domain}</span>
                <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-pending'}`}>
                  <span className={`dot ${target.is_verified ? 'dot-green' : 'dot-amber'}`} />
                  {target.is_verified ? 'Authorized' : 'Pending Verification'}
                </span>
              </div>
              <div className="modal-sub">Domain ownership & target authorization specs</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="close-verify-modal">
            <X size={15} />
          </button>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontSize: '12px', color: 'var(--secondary)', marginBottom: '12px' }}>
            Host the verification file containing your token at the well-known URL path:
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                <span>Target Verification Endpoint</span>
                <button
                  onClick={copyExpectedUrl}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px' }}
                >
                  {copiedUrl ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                  {copiedUrl ? 'Copied' : 'Copy URL'}
                </button>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '11.5px',
                  color: 'var(--primary)',
                  wordBreak: 'break-all',
                  background: 'var(--surface)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                {expectedUrl}
              </div>
            </div>
          </div>
        </div>

        {/* Verification Result Alert */}
        {result && (
          <div className={`alert ${result.is_verified ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '16px' }}>
            {result.is_verified ? (
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            ) : (
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            )}
            <div>
              <div style={{ fontWeight: 600 }}>
                {result.is_verified ? 'Target Domain Authorized' : 'Verification Incomplete'}
              </div>
              <div style={{ marginTop: '2px', fontSize: '12px', opacity: 0.9 }}>{result.message}</div>
              <div style={{ marginTop: '3px', fontFamily: 'var(--font-code)', fontSize: '10.5px', opacity: 0.7 }}>
                Checked: {result.checked_url}
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={handleVerify}
              disabled={verifying}
              id="run-verify-btn"
            >
              {verifying ? (
                <>
                  <RefreshCw size={13} className="spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck size={13} /> Run Verification Probe
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
