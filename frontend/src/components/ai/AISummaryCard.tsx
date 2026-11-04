import React, { useState } from 'react';
import { Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { Wave } from '../ui/wave';
import { getAISummary } from '../../services/api';
import { fallbackReasonText, isRetryableReason } from './aiReasons';
import type { ScanSummaryRef, ScanSummaryResponse } from '@/types';

interface AISummaryCardProps {
  scanId: string;
  onOpenFinding?: (findingId: string) => void;
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: 'var(--font-code)',
  marginBottom: '6px',
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  fontSize: '13px',
  color: 'var(--primary)',
  lineHeight: 1.55,
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
};

// Turns "[F2]" markers in AI text into buttons that open that finding. Everything else stays plain text.
function renderWithRefs(
  text: string,
  refs: Record<string, ScanSummaryRef>,
  onOpenFinding?: (findingId: string) => void,
): React.ReactNode[] {
  return text.split(/(\[F\d+\])/).map((part, i) => {
    const ref = /^\[(F\d+)\]$/.exec(part)?.[1];
    const target = ref ? refs[ref] : undefined;
    if (!target) return <React.Fragment key={i}>{part}</React.Fragment>;
    return (
      <button
        key={i}
        type="button"
        onClick={() => onOpenFinding?.(target.finding_id)}
        disabled={!onOpenFinding}
        title={`${target.severity}: ${target.title}`}
        style={{
          background: 'var(--accent-muted, rgba(0, 82, 255, 0.1))',
          color: 'var(--accent)',
          border: 'none',
          borderRadius: '3px',
          padding: '0 5px',
          margin: '0 2px',
          fontFamily: 'var(--font-code)',
          fontSize: '11px',
          fontWeight: 700,
          cursor: onOpenFinding ? 'pointer' : 'default',
        }}
      >
        {ref}
      </button>
    );
  });
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({ scanId, onOpenFinding }) => {
  const [result, setResult] = useState<ScanSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getAISummary(scanId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not get a summary.');
    } finally {
      setLoading(false);
    }
  };

  const isAI = result?.status === 'VALIDATED';

  return (
    <div
      className="card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={16} color="var(--accent)" />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
            AI Summary · Scan #{scanId.slice(0, 8)}
          </h3>
          {result && (
            <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
              {isAI ? `${result.model ?? 'AI'}${result.cached ? ' · cached' : ''}` : 'standard guidance, not AI-generated'}
            </span>
          )}
        </div>
        {!result && (
          <button
            className="btn btn-primary"
            style={{ fontSize: '12px', gap: '6px' }}
            onClick={handleGenerate}
            disabled={loading}
            id="generate-ai-summary-btn"
          >
            {loading ? (
              <>
                <Wave size="xs" color="currentColor" />
                <span>Summarising…</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>{error ? 'Try again' : 'Summarise with AI'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {!result && (
        <div style={{ fontSize: '12.5px', color: 'var(--secondary)', lineHeight: 1.45 }}>
          A short overview of the most severe open findings in this scan and what to fix first.
          {error && <div style={{ color: 'var(--critical, #ef4444)', marginTop: '6px' }}>{error}</div>}
        </div>
      )}

      {result && (
        <>
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
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <RotateCcw size={11} /> Retry
                </button>
              )}
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--primary)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>
            {renderWithRefs(result.summary.overview, result.refs, onOpenFinding)}
          </p>

          {result.summary.top_risks.length > 0 && (
            <div>
              <div style={sectionLabel}>Top risks</div>
              <ol style={listStyle}>
                {result.summary.top_risks.map((risk, i) => (
                  <li key={i}>{renderWithRefs(risk, result.refs, onOpenFinding)}</li>
                ))}
              </ol>
            </div>
          )}

          {result.summary.first_actions.length > 0 && (
            <div>
              <div style={sectionLabel}>Fix first</div>
              <ol style={listStyle}>
                {result.summary.first_actions.map((action, i) => (
                  <li key={i}>{renderWithRefs(action, result.refs, onOpenFinding)}</li>
                ))}
              </ol>
            </div>
          )}

          {isAI && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              AI-generated from up to 10 of the most severe open findings. The findings list and report remain the
              source of truth. Click a reference like F1 to open that finding.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AISummaryCard;
