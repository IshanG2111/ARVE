import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, AlertCircle, RefreshCw, Globe, HelpCircle, ExternalLink } from 'lucide-react';
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

  const verificationFileName = 'arve-verification.txt';
  const expectedUrl = `http(s)://${target.domain}/.well-known/${verificationFileName}`;

  const copyToClipboard = (text: string, type: 'file' | 'token') => {
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
      if (res.is_verified) {
        onTargetUpdated();
      }
    } catch (err: any) {
      setResult({
        target_id: target.id,
        domain: target.domain,
        is_verified: false,
        message: err.message || 'Network error during verification',
        checked_url: expectedUrl
      });
    } finally {
      setVerifying(false);
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
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '620px',
        padding: '28px',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: target.is_verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${target.is_verified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: target.is_verified ? '#34D399' : '#FBBF24'
            }}>
              <Globe size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{target.domain}</h3>
                <span className={`badge ${target.is_verified ? 'badge-verified' : 'badge-unverified'}`}>
                  {target.is_verified ? '✅ AUTHORIZED' : '⚠️ UNVERIFIED'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ownership Verification Setup (.well-known)
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Step Instructions */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={16} color="var(--primary)" /> How to Verify Ownership
          </h4>

          <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li>
              Create a directory named <code className="mono" style={{ color: '#00F0FF' }}>.well-known</code> at the web root of <strong style={{ color: '#F8FAFC' }}>{target.domain}</strong>.
            </li>
            <li>
              Create a plain text file inside it named:
              <div className="code-box" style={{ marginTop: '6px' }}>
                <span>{verificationFileName}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(verificationFileName, 'file')}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  {copiedFile ? <Check size={14} color="#34D399" /> : <Copy size={14} />} Copy Name
                </button>
              </div>
            </li>
            <li>
              Paste the following unique token as the exact file content:
              <div className="code-box" style={{ marginTop: '6px' }}>
                <span>{target.verification_token}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyToClipboard(target.verification_token, 'token')}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  {copiedToken ? <Check size={14} color="#34D399" /> : <Copy size={14} />} Copy Token
                </button>
              </div>
            </li>
            <li>
              File should be publicly accessible at:
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', wordBreak: 'break-all' }} className="mono">
                {expectedUrl}
              </div>
            </li>
          </ol>
        </div>

        {/* Verification Trigger */}
        {result && (
          <div style={{
            background: result.is_verified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${result.is_verified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            {result.is_verified ? (
              <ShieldCheck size={22} color="#34D399" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={22} color="#FDA4AF" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: result.is_verified ? '#34D399' : '#FDA4AF' }}>
                {result.is_verified ? 'Target Domain Successfully Authorized!' : 'Verification Check Failed'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {result.message}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }} className="mono">
                Checked URL: {result.checked_url}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>

          <button
            className="btn btn-primary"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <>
                <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Verifying Target...
              </>
            ) : (
              <>
                <ShieldCheck size={18} /> Run Ownership Verification
              </>
            )}
          </button>
        </div>

        {/* Dev Sandbox Helper Note */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '12px',
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>💡 <strong>Local Test Tip:</strong> Test API verification using ARVE mock token endpoint</span>
          <a
            href={`http://localhost:8000/mock-verification-file/${target.verification_token}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Test Mock File <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};
