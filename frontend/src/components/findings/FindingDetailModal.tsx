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
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { JsonViewer } from '../ui/JsonViewer';
import { MarkdownContent } from '../ui/MarkdownContent';
import { useToast } from '../ui/ToastProvider';
import { api } from '../../services/api';
import type { SecurityFinding } from '@/types';

interface FindingDetailModalProps {
  finding: SecurityFinding | null;
  onClose: () => void;
  onStatusChange?: (findingId: string, newStatus: string) => void;
  onOpenInCode?: (filePath?: string, lineStart?: number) => void;
}

const SUPPRESSION_REASONS = [
  'False positive',
  'Not exploitable in this application',
  'Accepted risk',
  'Compensating control in place',
  'Vulnerable function not used',
  'Other',
];

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({
  finding,
  onClose,
  onStatusChange,
  onOpenInCode,
}) => {
  const toast = useToast();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Suppression dialog state
  const [showSuppressDialog, setShowSuppressDialog] = useState(false);
  const [suppressReason, setSuppressReason] = useState(SUPPRESSION_REASONS[0]);
  const [suppressJustification, setSuppressJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSuppressDialog) setShowSuppressDialog(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSuppressDialog]);

  if (!finding) return null;

  const copyFingerprint = () => {
    if (finding.fingerprint) {
      navigator.clipboard.writeText(finding.fingerprint);
      setCopiedFingerprint(true);
      toast.success('Finding fingerprint copied.');
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  // Generate actionable upgrade CLI command
  const getUpgradeCommand = (): string | null => {
    if (!finding.package_name) return null;
    const eco = (finding.ecosystem || '').toLowerCase();
    const pkg = finding.package_name;
    const fixVer = finding.fixed_version;

    if (eco.includes('npm') || eco.includes('node') || eco.includes('javascript')) {
      return fixVer ? `npm install ${pkg}@^${fixVer}` : `npm update ${pkg}`;
    }
    if (eco.includes('pypi') || eco.includes('python') || eco.includes('pip')) {
      return fixVer ? `pip install --upgrade ${pkg}>=${fixVer}` : `pip install --upgrade ${pkg}`;
    }
    if (eco.includes('go') || eco.includes('golang')) {
      return fixVer ? `go get ${pkg}@v${fixVer}` : `go get -u ${pkg}`;
    }
    if (eco.includes('cargo') || eco.includes('crates') || eco.includes('rust')) {
      return fixVer ? `cargo update -p ${pkg} --precise ${fixVer}` : `cargo update -p ${pkg}`;
    }
    return fixVer ? `Upgrade ${pkg} to ${fixVer}+` : null;
  };

  const upgradeCommand = getUpgradeCommand();

  const handleCopyCommand = () => {
    if (upgradeCommand) {
      navigator.clipboard.writeText(upgradeCommand);
      setCopiedCommand(true);
      toast.success('Upgrade command copied to clipboard.');
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  const handleAcknowledge = async () => {
    try {
      setIsSubmitting(true);
      await api.updateFindingStatus(finding.id, { status: 'ACKNOWLEDGED' });
      if (onStatusChange) onStatusChange(finding.id, 'ACKNOWLEDGED');
      toast.success('Finding marked as acknowledged.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    try {
      setIsSubmitting(true);
      await api.updateFindingStatus(finding.id, { status: 'OPEN' });
      if (onStatusChange) onStatusChange(finding.id, 'OPEN');
      toast.success('Finding reopened.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reopen finding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSuppress = async () => {
    try {
      setIsSubmitting(true);
      await api.updateFindingStatus(finding.id, {
        status: 'SUPPRESSED',
        suppression_reason: suppressReason,
        suppression_justification: suppressJustification || undefined,
      });
      if (onStatusChange) onStatusChange(finding.id, 'SUPPRESSED');
      toast.success('Finding suppressed.');
      setShowSuppressDialog(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to suppress finding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal anim-fade-up"
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Layer 1: Header (What is wrong? Where is it?) */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <SeverityBadge severity={finding.severity} size="md" />
              <StatusBadge status={finding.status} size="sm" />
            </div>

            <h2
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--primary)',
                letterSpacing: '-0.015em',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {finding.title}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
              {finding.package_name && (
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {finding.package_name} {finding.package_version || ''}
                </span>
              )}
              {finding.package_name && finding.file_path && <span>•</span>}
              {finding.file_path && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <FileCode size={13} color="var(--accent)" />
                  {finding.file_path}
                </span>
              )}
            </div>
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

        {/* Scrollable Body (Structured & Formatted) */}
        <div
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: 1,
          }}
        >
          {/* Section 1: Actionable Remediation Banner (What should I do?) */}
          <div
            style={{
              padding: '16px 18px',
              background: 'rgba(0, 82, 255, 0.05)',
              border: '1px solid rgba(0, 82, 255, 0.25)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-code)' }}>
                  Recommended Remediation
                </span>
              </div>

              {finding.file_path && onOpenInCode && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px', gap: '4px' }}
                  onClick={() => {
                    onClose();
                    onOpenInCode(finding.file_path, finding.line_start);
                  }}
                >
                  <Code size={11} /> Inspect in Code
                </button>
              )}
            </div>

            <div style={{ fontSize: '13px', color: 'var(--primary)', lineHeight: 1.5 }}>
              {finding.fixed_version ? (
                <span>
                  Upgrade <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>{finding.package_name}</strong> from version <span style={{ fontFamily: 'var(--font-code)', color: '#ef4444' }}>{finding.package_version || 'current'}</span> to <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-code)' }}>{finding.fixed_version}</strong> or higher.
                </span>
              ) : finding.finding_type === 'secret' ? (
                'Immediately revoke and rotate the exposed credential, purge it from git history, and store it in an environment secret manager.'
              ) : (
                'Review the flagged code and apply necessary input validation or dependency security updates.'
              )}
            </div>

            {/* Quick 1-Click Upgrade Command */}
            {upgradeCommand && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--terminal-bg, #0B0F19)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  marginTop: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Terminal size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <code style={{ fontSize: '12px', fontFamily: 'var(--font-code)', color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {upgradeCommand}
                  </code>
                </div>
                <button
                  onClick={handleCopyCommand}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '2px 8px', gap: '4px', color: copiedCommand ? 'var(--success)' : 'var(--muted)', flexShrink: 0 }}
                  title="Copy command to clipboard"
                >
                  {copiedCommand ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCommand ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Version & Exposure Matrix */}
          {finding.package_name && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                padding: '14px 16px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Installed Version</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {finding.package_version || 'unknown'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Fixed In</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: finding.fixed_version ? 'var(--accent)' : 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {finding.fixed_version ? `${finding.fixed_version}+` : 'Pending'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Ecosystem</div>
                <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {finding.ecosystem || 'npm'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Exposure Status</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  Vulnerable
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Advisory Description (Rich Formatted Markdown) */}
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-code)', marginBottom: '8px' }}>
              Vulnerability Overview &amp; Impact
            </h4>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
              }}
            >
              <MarkdownContent content={finding.description || 'This dependency has a known security vulnerability in the installed version.'} />
            </div>
          </div>

          {/* Section 4: Progressive Disclosure (Technical Security Metadata ▾) */}
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
                padding: '4px 0',
              }}
            >
              {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Technical security metadata ▾
            </button>

            {showTechnicalDetails && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '16px',
                  background: 'var(--elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  fontSize: '12px',
                }}
              >
                {/* Identifiers Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {finding.cve && (
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>CVE Identifier</span>
                      <div style={{ marginTop: '3px' }}>
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${finding.cve}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#ef4444', fontFamily: 'var(--font-code)', fontWeight: 650, textDecoration: 'underline' }}
                        >
                          {finding.cve} ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {finding.ghsa && (
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>GitHub Advisory</span>
                      <div style={{ marginTop: '3px' }}>
                        <a
                          href={`https://github.com/advisories/${finding.ghsa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', fontFamily: 'var(--font-code)', fontWeight: 650, textDecoration: 'underline' }}
                        >
                          {finding.ghsa} ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {finding.cwe && (
                    <div>
                      <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>CWE Weakness</span>
                      <div style={{ color: 'var(--primary)', fontFamily: 'var(--font-code)', fontWeight: 600, marginTop: '3px' }}>
                        {finding.cwe}
                      </div>
                    </div>
                  )}

                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Detection Source</span>
                    <div style={{ color: 'var(--primary)', fontFamily: 'var(--font-code)', fontWeight: 600, marginTop: '3px' }}>
                      {finding.engine?.toUpperCase() || 'OSV'} (Confidence: {finding.confidence || 'High'})
                    </div>
                  </div>
                </div>

                {/* Fingerprint */}
                {finding.fingerprint && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-code)', fontSize: '11px', color: 'var(--muted)' }}>
                      SHA-256 Fingerprint: {finding.fingerprint.slice(0, 24)}…
                    </span>
                    <button
                      onClick={copyFingerprint}
                      className="btn btn-ghost"
                      style={{ padding: '2px 8px', fontSize: '11px', gap: '4px' }}
                    >
                      {copiedFingerprint ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                      <span>{copiedFingerprint ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                {/* Raw JSON viewer */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginBottom: '8px' }}>
                    Raw Advisory JSON Payload
                  </div>
                  <JsonViewer
                    data={finding.raw_json || finding}
                    title={finding.cve || finding.ghsa || finding.title}
                    maxHeight="240px"
                    initialExpandedDepth={1}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Modal Footer Actions (Clear separation from scrollable content) */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--elevated)',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {finding.status === 'OPEN' && (
              <>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', gap: '6px' }}
                  onClick={handleAcknowledge}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 size={13} color="var(--accent)" /> Acknowledge
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', gap: '6px', color: 'var(--muted)' }}
                  onClick={() => setShowSuppressDialog(true)}
                  disabled={isSubmitting}
                >
                  <EyeOff size={13} /> Suppress
                </button>
              </>
            )}

            {(finding.status === 'ACKNOWLEDGED' || finding.status === 'SUPPRESSED' || finding.status === 'RESOLVED') && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', gap: '6px' }}
                onClick={handleReopen}
                disabled={isSubmitting}
              >
                <RotateCcw size={13} /> Reopen Finding
              </button>
            )}
          </div>

          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>

        {/* ── Suppression Modal Sub-Dialog ── */}
        {showSuppressDialog && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(4px)',
              zIndex: 10,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  Suppress Finding
                </h3>
                <button
                  onClick={() => setShowSuppressDialog(false)}
                  className="btn btn-ghost btn-icon"
                  style={{ color: 'var(--muted)' }}
                >
                  <X size={15} />
                </button>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 650, color: 'var(--muted)', fontFamily: 'var(--font-code)', display: 'block', marginBottom: '8px' }}>
                  Reason for suppression
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {SUPPRESSION_REASONS.map((r) => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12.5px',
                        color: suppressReason === r ? 'var(--primary)' : 'var(--secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="suppressReason"
                        checked={suppressReason === r}
                        onChange={() => setSuppressReason(r)}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 650, color: 'var(--muted)', fontFamily: 'var(--font-code)', display: 'block', marginBottom: '6px' }}>
                  Justification / Notes (Optional)
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Vulnerable template function is only invoked with static strings in dev build."
                  value={suppressJustification}
                  onChange={(e) => setSuppressJustification(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', padding: '8px 10px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowSuppressDialog(false)}
                  style={{ fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmSuppress}
                  disabled={isSubmitting}
                  style={{ fontSize: '12px' }}
                >
                  Confirm Suppression
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FindingDetailModal;
