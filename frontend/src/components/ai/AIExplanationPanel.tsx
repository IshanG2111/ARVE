import React, { useState } from 'react';
import { Sparkles, AlertTriangle, Copy, Check, RotateCcw } from 'lucide-react';
import { Wave } from '../ui/wave';
import { useToast } from '../ui/ToastProvider';
import { explainFinding } from '../../services/api';
import { fallbackReasonText, isRetryableReason } from './aiReasons';
import type { FindingExplanationResponse } from '@/types';

interface AIExplanationPanelProps {
  scanId: string;
  findingId: string;
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: 'var(--font-code)',
  marginBottom: '5px',
};

const bodyText: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--primary)',
  lineHeight: 1.55,
  margin: 0,
  whiteSpace: 'pre-wrap',
};

// AI text is always rendered as plain React text, never as HTML or markdown.
export const AIExplanationPanel: React.FC<AIExplanationPanelProps> = ({ scanId, findingId }) => {
  const toast = useToast();
  const [result, setResult] = useState<FindingExplanationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExplain = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await explainFinding(scanId, findingId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not get an explanation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    const code = result?.explanation.suggested_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Suggested change copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) {
    return (
      <div
        style={{
          padding: '14px 16px',
          border: '1px dashed var(--accent-border, rgba(0, 82, 255, 0.35))',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '12.5px', color: 'var(--secondary)', lineHeight: 1.45, flex: 1, minWidth: '220px' }}>
          Get a plain-English explanation of this finding and how to fix it, based on the scanner result and the
          surrounding code.
          {error && <div style={{ color: 'var(--critical, #ef4444)', marginTop: '6px' }}>{error}</div>}
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '12px', gap: '6px' }}
          onClick={handleExplain}
          disabled={loading}
          id="explain-with-ai-btn"
        >
          {loading ? (
            <>
              <Wave size="xs" color="currentColor" />
              <span>Explaining…</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>{error ? 'Try again' : 'Explain with AI'}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const { explanation } = result;
  const isAI = result.status === 'VALIDATED';

  return (
    <div
      style={{
        padding: '16px 18px',
        background: 'var(--elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-code)' }}>
            {isAI ? 'AI Explanation' : 'Standard Guidance'}
          </span>
        </div>
        <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
          {isAI
            ? `${result.model ?? 'AI'}${result.code_source === 'ast' && result.code_symbol ? ` · read ${result.code_symbol}` : ''}${result.cached ? ' · cached' : ''}`
            : 'not AI-generated'}
        </span>
      </div>

      {!isAI && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '9px 12px',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.22)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--secondary)',
            lineHeight: 1.45,
          }}
        >
          <AlertTriangle size={14} style={{ color: '#eab308', flexShrink: 0, marginTop: '1px' }} />
          <span style={{ flex: 1 }}>{fallbackReasonText(result.reason)}</span>
          {isRetryableReason(result.reason) && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '1px 8px', gap: '4px' }}
              onClick={handleExplain}
              disabled={loading}
            >
              <RotateCcw size={11} /> Retry
            </button>
          )}
        </div>
      )}

      <div>
        <div style={sectionLabel}>Summary</div>
        <p style={bodyText}>{explanation.summary}</p>
      </div>

      <div>
        <div style={sectionLabel}>Why it matters</div>
        <p style={bodyText}>{explanation.why_it_matters}</p>
      </div>

      {explanation.fix_steps.length > 0 && (
        <div>
          <div style={sectionLabel}>How to fix</div>
          <ol style={{ ...bodyText, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {explanation.fix_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {explanation.suggested_code && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <div style={{ ...sectionLabel, marginBottom: 0 }}>Suggested change, not applied</div>
            <button
              onClick={handleCopyCode}
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '2px 8px', gap: '4px', color: copied ? 'var(--success)' : 'var(--muted)' }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              background: '#070a11',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'var(--font-code)',
              color: '#E2E8F0',
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {explanation.suggested_code}
          </pre>
        </div>
      )}

      {explanation.caveats.length > 0 && (
        <div>
          <div style={sectionLabel}>Caveats</div>
          <ul style={{ ...bodyText, fontSize: '12px', color: 'var(--secondary)', paddingLeft: '18px' }}>
            {explanation.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {isAI && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          AI-generated from the scanner result and nearby code. Review it before changing anything. It does not
          confirm the issue is exploitable or that a fix is complete; re-run the scan after fixing.
        </div>
      )}
    </div>
  );
};

export default AIExplanationPanel;
