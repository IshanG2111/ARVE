import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileCode,
  CheckCircle2,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Code,
} from 'lucide-react';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../ui/ToastProvider';
import type { SecurityFinding } from '@/types';

interface FindingDetailModalProps {
  finding: SecurityFinding | null;
  onClose: () => void;
  onStatusChange?: (findingId: string, newStatus: string) => void;
  onOpenInCode?: (filePath?: string, lineStart?: number) => void;
}

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({
  finding,
  onClose,
  onStatusChange,
  onOpenInCode,
}) => {
  const toast = useToast();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!finding) return null;

  const copyFingerprint = () => {
    if (finding.fingerprint) {
      navigator.clipboard.writeText(finding.fingerprint);
      setCopied(true);
      toast.success('Finding fingerprint copied.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResolve = () => {
    if (onStatusChange) {
      onStatusChange(finding.id, 'RESOLVED');
      toast.success('Finding marked as resolved.');
    }
  };

  const handleSuppress = () => {
    if (onStatusChange) {
      onStatusChange(finding.id, 'SUPPRESSED');
      toast.success('Finding suppressed.');
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal anim-fade-up"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'var(--surface)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <SeverityBadge severity={finding.severity} size="md" />
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Engine: {finding.engine}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  textTransform: 'capitalize',
                }}
              >
                Type: {finding.finding_type}
              </span>
              {finding.confidence && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--secondary)',
                  }}
                >
                  Confidence: {finding.confidence}
                </span>
              )}
              <StatusBadge status={finding.status} size="sm" />
            </div>

            <h2
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--primary)',
                letterSpacing: '-0.015em',
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              {finding.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ color: 'var(--muted)', flexShrink: 0 }}
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '22px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            flex: 1,
          }}
        >
          {/* Spatial File Location */}
          {finding.file_path && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={16} color="var(--accent)" />
                <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-code)', color: 'var(--primary)', fontWeight: 600 }}>
                  {finding.file_path}
                  {finding.line_start ? ` : L${finding.line_start}${finding.line_end ? `-L${finding.line_end}` : ''}` : ''}
                </span>
              </div>

              {onOpenInCode && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px', gap: '5px' }}
                  onClick={() => {
                    onClose();
                    onOpenInCode(finding.file_path, finding.line_start);
                  }}
                >
                  <Code size={12} /> Inspect in Code
                </button>
              )}
            </div>
          )}

          {/* Affected Package / Advisory Info */}
          {(finding.package_name || finding.cve || finding.ghsa || finding.cwe || finding.rule_id) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              {finding.package_name && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Package</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {finding.package_name} {finding.package_version ? `@ ${finding.package_version}` : ''}
                  </div>
                </div>
              )}
              {finding.cve && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>CVE Identifier</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--critical)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {finding.cve}
                  </div>
                </div>
              )}
              {finding.cwe && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>CWE Weakness</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {finding.cwe}
                  </div>
                </div>
              )}
              {finding.rule_id && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Rule ID</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                    {finding.rule_id}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-code)', marginBottom: '6px' }}>
              Description
            </h4>
            <div
              style={{
                fontSize: '13.5px',
                color: 'var(--secondary)',
                lineHeight: 1.6,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
              }}
            >
              {finding.description || 'No extended description provided by the scanner engine.'}
            </div>
          </div>

          {/* Recommended Remediation */}
          <div>
            <h4 style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-code)', marginBottom: '6px' }}>
              Recommended Remediation
            </h4>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--primary)',
                lineHeight: 1.55,
                background: 'var(--elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
              }}
            >
              {finding.finding_type === 'secret'
                ? 'Immediately revoke and rotate the exposed secret credential. Remove the token from git history and configure environment variable secrets management.'
                : finding.finding_type === 'dependency'
                ? `Upgrade ${finding.package_name || 'the affected package'} to the latest secure version patched against ${finding.cve || 'this vulnerability'}.`
                : 'Review the flagged code pattern and ensure proper authorization, input validation, and boundary verification guards are applied.'}
            </div>
          </div>

          {/* Collapsible Technical Details */}
          <div>
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '12px',
                fontFamily: 'var(--font-code)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Technical Details &amp; Raw Output
            </button>

            {showTechnicalDetails && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '14px',
                  background: 'var(--terminal-bg)',
                  color: 'var(--terminal-text)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-code)',
                  fontSize: '11.5px',
                  overflowX: 'auto',
                }}
              >
                {finding.fingerprint && (
                  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Fingerprint: {finding.fingerprint}</span>
                    <button
                      onClick={copyFingerprint}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}
                    >
                      {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  </div>
                )}
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {finding.raw_json ? JSON.stringify(finding.raw_json, null, 2) : JSON.stringify(finding, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--elevated)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', gap: '6px' }}
              onClick={handleResolve}
            >
              <CheckCircle2 size={13} color="var(--success)" /> Mark Resolved
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px', gap: '6px', color: 'var(--muted)' }}
              onClick={handleSuppress}
            >
              <EyeOff size={13} /> Ignore / Suppress
            </button>
          </div>

          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FindingDetailModal;
