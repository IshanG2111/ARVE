import React, { useState, useEffect } from 'react';
import {
  FileDown,
  FileText,
  RefreshCw,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  Code2,
  Search,
  X,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import type { ScanReportData, ReportFindingItem } from '@/types';

interface ScanReportViewProps {
  scanId: string;
}

const cleanFindingText = (text?: string | null): string => {
  if (!text) return '';
  return text
    // Remove markdown headers (### Impact, ## Summary, # Overview, etc.)
    .replace(/#+\s*(?:Impact|Summary|Overview|Description|Details|Vulnerability Details|Vulnerability)?\s*/gi, '')
    // Remove leading section labels like "Impact:", "Summary:"
    .replace(/^(?:Impact|Summary|Overview|Description|Details):\s*/gi, '')
    // Remove markdown backticks, asterisks, and underscores
    .replace(/[`*_]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

export const ScanReportView: React.FC<ScanReportViewProps> = ({ scanId }) => {
  const toast = useToast();
  const [report, setReport] = useState<ScanReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'md' | null>(null);
  const [showFullAppendix, setShowFullAppendix] = useState(false);
  const [expandedEvidences, setExpandedEvidences] = useState<Record<string, boolean>>({});

  // Interactive filtering & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [engineFilter, setEngineFilter] = useState<string>('ALL');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);

  // Load existing report
  useEffect(() => {
    let active = true;
    if (scanId) {
      setLoading(true);
      setErrorMsg(null);
      api
        .getScanReport(scanId)
        .then((data: ScanReportData) => {
          if (active) {
            setReport(data);
          }
        })
        .catch(() => {
          if (active) {
            setReport(null);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [scanId]);

  // Generate or refresh report
  const handleGenerateReport = async (forceRefresh: boolean = false) => {
    try {
      setGenerating(true);
      setErrorMsg(null);
      const data = await api.generateScanReport(scanId, forceRefresh);
      setReport(data);
      toast.success(
        data.is_ai_fallback
          ? 'Security report generated with rules engine'
          : `Security report generated with ${data.ai_model || 'Groq AI'}`
      );
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      const msg = err.message || 'Failed to generate security assessment report';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const toggleEvidence = (findingId: string) => {
    setExpandedEvidences((prev) => ({
      ...prev,
      [findingId]: !prev[findingId],
    }));
  };

  const handleDownload = async (format: 'pdf' | 'md') => {
    try {
      setDownloadingFormat(format);
      await api.downloadScanReport(scanId, format);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch (err: any) {
      console.error(`Failed to download ${format}:`, err);
      toast.error(err.message || `Failed to download ${format.toUpperCase()} report`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleSeverityFilterClick = (sev: string) => {
    setSeverityFilter((prev) => (prev === sev ? 'ALL' : sev));
    const el = document.getElementById('section-detailed-findings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ── State 1: Loading Report ──
  if (loading) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
          Loading Security Assessment...
        </p>
      </div>
    );
  }

  // ── State 2: Report Not Yet Generated (Clean, Welcoming Empty State) ──
  if (!report) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 32px',
          textAlign: 'center',
          maxWidth: '520px',
          margin: '32px auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
          }}
        >
          <Shield size={22} />
        </div>
        <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
          Security Assessment Report
        </h4>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
          No consolidated security report exists yet for this scan. Generate a report to view executive insights, priority risks, and remediation roadmaps.
        </p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontSize: '12px',
              marginBottom: '20px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          onClick={() => handleGenerateReport(false)}
          disabled={generating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 24px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            cursor: generating ? 'not-allowed' : 'pointer',
            margin: '0 auto',
            boxShadow: 'var(--shadow-subtle)',
            transition: 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          {generating ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Generating Report...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Generate Report</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // ── State 3: Completed Security Assessment Report ──
  const crit = report.severity_counts?.CRITICAL || 0;
  const high = report.severity_counts?.HIGH || 0;
  const med = report.severity_counts?.MEDIUM || 0;
  const low = (report.severity_counts?.LOW || 0) + (report.severity_counts?.INFO || 0);

  const totalFindings = report.total_findings || 1;
  const critPct = ((crit / totalFindings) * 100).toFixed(1);
  const highPct = ((high / totalFindings) * 100).toFixed(1);
  const medPct = ((med / totalFindings) * 100).toFixed(1);
  const lowPct = ((low / totalFindings) * 100).toFixed(1);

  const filterFinding = (f: ReportFindingItem) => {
    if (selectedRiskFilter) {
      const risk = report.priority_risks?.find((r) => r.title === selectedRiskFilter);
      if (risk && risk.related_finding_ids && risk.related_finding_ids.length > 0) {
        if (!risk.related_finding_ids.includes(f.display_id)) return false;
      }
    }
    if (severityFilter !== 'ALL' && f.severity.toUpperCase() !== severityFilter) {
      return false;
    }
    if (engineFilter !== 'ALL' && f.engine.toLowerCase() !== engineFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = f.display_id.toLowerCase().includes(q);
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchPkg = (f.package_name || '').toLowerCase().includes(q);
      const matchFile = (f.file_path || '').toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchPkg && !matchFile) return false;
    }
    return true;
  };

  const filteredDetailedFindings = (report.appendix_findings || []).filter(filterFinding);
  const filteredAppendixFindings = (report.appendix_findings || []).filter(filterFinding);

  const p1Actions = (report.prioritized_actions || []).filter((a) => a.priority.includes('1'));
  const p2Actions = (report.prioritized_actions || []).filter((a) => a.priority.includes('2'));
  const p3Actions = (report.prioritized_actions || []).filter((a) => a.priority.includes('3'));

  // Provider label & badge styling
  const isGroq =
    report.provenance?.provider?.toLowerCase() === 'groq' ||
    report.ai_model?.toLowerCase().includes('gpt-oss') ||
    report.ai_model?.toLowerCase().includes('llama');

  const providerLabel = isGroq
    ? 'Groq AI Evaluated'
    : report.is_ai_fallback
    ? 'Deterministic Rules'
    : report.ai_model || 'AI Assisted';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Top Header & Action Controls ── */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.01em' }}>
              ARVE Security Assessment Report
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-code)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                background: report.is_ai_fallback ? 'var(--elevated)' : 'rgba(16, 185, 129, 0.08)',
                color: report.is_ai_fallback ? 'var(--muted)' : '#10b981',
                border: report.is_ai_fallback ? '1px solid var(--border)' : '1px solid rgba(16, 185, 129, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: report.is_ai_fallback ? 'var(--muted)' : '#10b981',
                }}
              />
              {providerLabel}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '11.5px',
              color: 'var(--muted)',
              marginTop: '6px',
            }}
          >
            <span>
              Target: <strong style={{ color: 'var(--primary)' }}>{report.repository_name || report.project_name}</strong>
            </span>
            <span>•</span>
            <span>
              Scan: <code style={{ color: 'var(--primary)' }}>#{report.scan_id.slice(0, 8)}</code>
            </span>
            <span>•</span>
            <span>
              Commit: <code style={{ color: 'var(--primary)' }}>{report.commit_sha.slice(0, 8)}</code>
            </span>
            <span>•</span>
            <span>{report.scan_timestamp}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleGenerateReport(true)}
            disabled={generating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              background: 'var(--elevated)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
              cursor: generating ? 'not-allowed' : 'pointer',
              transition: 'background 120ms ease',
            }}
            title="Refresh AI synthesis using Groq / AI provider"
          >
            <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
            <span>{generating ? 'Refreshing...' : 'Refresh AI'}</span>
          </button>

          <button
            onClick={() => handleDownload('md')}
            disabled={downloadingFormat === 'md'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              background: 'var(--elevated)',
              color: 'var(--primary)',
              border: '1px solid var(--border)',
              cursor: downloadingFormat === 'md' ? 'not-allowed' : 'pointer',
            }}
          >
            <FileText size={12} />
            <span>{downloadingFormat === 'md' ? 'Exporting...' : 'Markdown'}</span>
          </button>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloadingFormat === 'pdf'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '11.5px',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              cursor: downloadingFormat === 'pdf' ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <FileDown size={13} />
            <span>{downloadingFormat === 'pdf' ? 'Exporting...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* ── Executive Posture Bar (Clean, Unified, Modern) ── */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Metric stats strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Total Findings */}
          <div
            onClick={() => {
              setSeverityFilter('ALL');
              setSelectedRiskFilter(null);
            }}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: severityFilter === 'ALL' && !selectedRiskFilter ? 'var(--elevated)' : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <div style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Findings
            </div>
            <div style={{ fontSize: '24px', fontWeight: 750, color: 'var(--primary)', margin: '2px 0', fontFamily: 'var(--font-code)' }}>
              {report.total_findings}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Across all tools</div>
          </div>

          {/* Critical */}
          <div
            onClick={() => handleSeverityFilterClick('CRITICAL')}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: severityFilter === 'CRITICAL' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: '10.5px', fontWeight: 650, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Critical
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 750, color: 'var(--primary)', margin: '2px 0', fontFamily: 'var(--font-code)' }}>
              {crit}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Within 24h SLA</div>
          </div>

          {/* High */}
          <div
            onClick={() => handleSeverityFilterClick('HIGH')}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: severityFilter === 'HIGH' ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }} />
              <span style={{ fontSize: '10.5px', fontWeight: 650, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                High
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 750, color: 'var(--primary)', margin: '2px 0', fontFamily: 'var(--font-code)' }}>
              {high}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Within 7 days</div>
          </div>

          {/* Medium */}
          <div
            onClick={() => handleSeverityFilterClick('MEDIUM')}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: severityFilter === 'MEDIUM' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ fontSize: '10.5px', fontWeight: 650, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Medium
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 750, color: 'var(--primary)', margin: '2px 0', fontFamily: 'var(--font-code)' }}>
              {med}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Next sprint</div>
          </div>

          {/* Low / Info */}
          <div
            onClick={() => handleSeverityFilterClick('LOW')}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: severityFilter === 'LOW' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
              transition: 'background 120ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
              <span style={{ fontSize: '10.5px', fontWeight: 650, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Low / Info
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 750, color: 'var(--primary)', margin: '2px 0', fontFamily: 'var(--font-code)' }}>
              {low}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Backlog</div>
          </div>
        </div>

        {/* Proportional distribution bar */}
        <div>
          <div
            style={{
              display: 'flex',
              height: '5px',
              borderRadius: '3px',
              overflow: 'hidden',
              background: 'var(--elevated)',
              gap: '2px',
            }}
          >
            {crit > 0 && <div style={{ width: `${critPct}%`, background: '#ef4444' }} title={`Critical: ${crit} (${critPct}%)`} />}
            {high > 0 && <div style={{ width: `${highPct}%`, background: '#f97316' }} title={`High: ${high} (${highPct}%)`} />}
            {med > 0 && <div style={{ width: `${medPct}%`, background: '#f59e0b' }} title={`Medium: ${med} (${medPct}%)`} />}
            {low > 0 && <div style={{ width: `${lowPct}%`, background: '#3b82f6' }} title={`Low: ${low} (${lowPct}%)`} />}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              color: 'var(--muted)',
              marginTop: '5px',
              fontFamily: 'var(--font-code)',
            }}
          >
            <span>Critical: {crit} ({critPct}%)</span>
            <span>High: {high} ({highPct}%)</span>
            <span>Medium: {med} ({medPct}%)</span>
            <span>Low: {low} ({lowPct}%)</span>
          </div>
        </div>
      </div>

      {/* ── Executive Summary ── */}
      <div
        className="card"
        style={{
          padding: '22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Shield size={16} style={{ color: 'var(--accent)' }} />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.01em' }}>
            Executive Summary
          </h4>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13.5px', lineHeight: '1.65', color: 'var(--primary)' }}>
          {report.executive_summary}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ background: 'var(--elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Risk Concentration
            </span>
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: '1.5', color: 'var(--secondary)' }}>
              {report.risk_overview}
            </p>
          </div>
          <div style={{ background: 'var(--elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Potential Impact
            </span>
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: '1.5', color: 'var(--secondary)' }}>
              {report.impact}
            </p>
          </div>
        </div>

        {report.reachability_assessment && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--elevated)',
              fontSize: '12px',
              color: 'var(--secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <strong style={{ color: 'var(--primary)' }}>Applicability Context:</strong> {report.reachability_assessment}
          </div>
        )}
      </div>

      {/* ── Priority Risks ── */}
      <div
        className="card"
        style={{
          padding: '22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.01em' }}>
              Priority Risks
            </h4>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Grouped by underlying vulnerability & component
          </span>
        </div>

        {report.priority_risks && report.priority_risks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.priority_risks.map((pr, idx) => {
              const isCrit = pr.severity.toLowerCase().includes('crit');
              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-code)', fontSize: '11.5px', fontWeight: 700, color: 'var(--muted)' }}>
                        #{pr.index || idx + 1}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)' }}>
                        {pr.title}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-code)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isCrit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: isCrit ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {pr.severity}
                    </span>
                  </div>

                  <p style={{ margin: '8px 0', fontSize: '12.5px', lineHeight: '1.55', color: 'var(--secondary)' }}>
                    {pr.description}
                  </p>

                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      Target: <code style={{ color: 'var(--primary)' }}>{pr.target}</code>
                    </div>
                    {pr.related_finding_ids && pr.related_finding_ids.length > 0 && (
                      <button
                        onClick={() => {
                          const next = selectedRiskFilter === pr.title ? null : pr.title;
                          setSelectedRiskFilter(next);
                          const el = document.getElementById('section-detailed-findings');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          color: selectedRiskFilter === pr.title ? 'var(--accent)' : 'var(--muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 600,
                        }}
                      >
                        {selectedRiskFilter === pr.title ? (
                          <>
                            <X size={12} /> Clear Filter ({pr.related_finding_ids.length})
                          </>
                        ) : (
                          <>
                            Filter {pr.related_finding_ids.length} Findings <ArrowRight size={12} />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {pr.related_finding_ids && pr.related_finding_ids.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                      {pr.related_finding_ids.map((fid) => (
                        <span
                          key={fid}
                          style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-code)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: 'var(--surface)',
                            color: 'var(--muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {fid}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.main_concerns.map((c, idx) => (
              <div key={idx} style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--primary)' }}>• {c}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Remediation Plan ── */}
      <div
        className="card"
        style={{
          padding: '22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.01em' }}>
            Remediation Plan
          </h4>
        </div>

        {/* 3-Tier Remediation Plan Layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {p1Actions.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Immediate Attention (Priority 1)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Within 24h</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--primary)', lineHeight: '1.6' }}>
                {p1Actions.map((a, idx) => (
                  <li key={idx}>
                    <strong>{a.action}</strong>
                    {a.rationale && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>— {a.rationale}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p2Actions.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f97316' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Short-Term Actions (Priority 2)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Within 7 days</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--primary)', lineHeight: '1.6' }}>
                {p2Actions.map((a, idx) => (
                  <li key={idx}>
                    <strong>{a.action}</strong>
                    {a.rationale && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>— {a.rationale}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p3Actions.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Planned Upgrades (Priority 3)
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>Scheduled Sprint</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--primary)', lineHeight: '1.6' }}>
                {p3Actions.map((a, idx) => (
                  <li key={idx}>
                    <strong>{a.action}</strong>
                    {a.rationale && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>— {a.rationale}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {report.consolidated_remediations && report.consolidated_remediations.length > 0 && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 650, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Consolidated Package Upgrades
            </span>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--primary)' }}>
              {report.consolidated_remediations.map((cr, idx) => (
                <li key={idx} style={{ marginBottom: '3px' }}>
                  {cr}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Detailed Findings ── */}
      <div
        id="section-detailed-findings"
        className="card"
        style={{
          padding: '22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} style={{ color: '#ef4444' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.01em' }}>
              Detailed Findings ({filteredDetailedFindings.length} of {report.total_findings})
            </h4>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Searchable and filterable vulnerability records
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '8px 12px',
            background: 'var(--elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings by ID, package, or title..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '11.5px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Severity Filter Buttons */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border)',
                  background: severityFilter === s ? 'var(--accent)' : 'var(--surface)',
                  color: severityFilter === s ? '#ffffff' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'background 100ms ease',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Engine Filter Dropdown */}
          <select
            value={engineFilter}
            onChange={(e) => setEngineFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              fontSize: '11.5px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">All Tools</option>
            <option value="osv">OSV Scanner</option>
            <option value="gitleaks">Gitleaks</option>
            <option value="semgrep">Semgrep SAST</option>
            <option value="codeql">CodeQL</option>
          </select>

          {/* Active Priority Filter Pill */}
          {selectedRiskFilter && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(0, 82, 255, 0.1)',
                color: 'var(--accent)',
                fontSize: '10.5px',
                fontWeight: 600,
              }}
            >
              Priority: {selectedRiskFilter}
              <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedRiskFilter(null)} />
            </span>
          )}

          {/* Reset Filters button if any active */}
          {(searchQuery || severityFilter !== 'ALL' || engineFilter !== 'ALL' || selectedRiskFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('ALL');
                setEngineFilter('ALL');
                setSelectedRiskFilter(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                color: 'var(--muted)',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
            >
              Reset
            </button>
          )}
        </div>

        {filteredDetailedFindings.length === 0 ? (
          <p style={{ margin: '16px 0', fontSize: '12.5px', color: 'var(--muted)', textAlign: 'center' }}>
            No findings match current search/filter criteria.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredDetailedFindings.slice(0, 20).map((finding) => {
              const isCrit = finding.severity === 'CRITICAL';
              const isHigh = finding.severity === 'HIGH';
              const sevColor = isCrit ? '#ef4444' : isHigh ? '#f97316' : '#f59e0b';
              const sevBg = isCrit ? 'rgba(239, 68, 68, 0.1)' : isHigh ? 'rgba(249, 115, 22, 0.1)' : 'rgba(245, 158, 11, 0.1)';
              const isEvidenceExpanded = !!expandedEvidences[finding.id];

              return (
                <div
                  key={finding.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Finding Title & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 650,
                          color: 'var(--primary)',
                          background: 'var(--surface)',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {finding.display_id}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 650, color: 'var(--primary)', lineHeight: '1.4' }}>
                        {cleanFindingText(finding.title)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 650,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: sevBg,
                          color: sevColor,
                          border: `1px solid ${sevColor}25`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {finding.severity}
                      </span>
                      {finding.ghsa && (
                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                          {finding.ghsa}
                        </span>
                      )}
                      {finding.cve && (
                        <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--muted)' }}>
                          {finding.cve}
                        </span>
                      )}
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--secondary)', textTransform: 'uppercase' }}>
                        {finding.engine}
                      </span>
                    </div>
                  </div>

                  {/* Finding details */}
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--secondary)' }}>
                      {cleanFindingText(finding.issue_summary || finding.description)}
                    </p>

                    {/* Component Info (Clean, Minimal, Professional - No Clunky Monospace or Heavy Nested Boxes) */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '6px 0',
                        fontSize: '11.5px',
                        color: 'var(--muted)',
                        borderTop: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {finding.package_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>Package:</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{finding.package_name}</span>
                        </div>
                      )}
                      {finding.package_version && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>Installed:</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{finding.package_version}</span>
                        </div>
                      )}
                      {finding.fixed_version && finding.fixed_version !== 'None specified' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>Fixed In:</span>
                          <span
                            style={{
                              color: '#10b981',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.08)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                            }}
                          >
                            {finding.fixed_version}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Location:</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                          {finding.file_path || 'package-lock.json'}{finding.line_start ? `:${finding.line_start}` : ''}
                        </span>
                      </div>
                    </div>

                    {finding.recommended_fix && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12px', color: 'var(--secondary)' }}>
                        <strong style={{ color: 'var(--primary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          Fix:
                        </strong>
                        <span>{cleanFindingText(finding.recommended_fix)}</span>
                      </div>
                    )}
                  </div>

                  {/* Collapsible raw evidence */}
                  {finding.raw_evidence && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={() => toggleEvidence(finding.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '11px',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Code2 size={11} />
                        {isEvidenceExpanded ? 'Hide Raw Evidence' : 'View Raw Evidence'}
                        {isEvidenceExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>

                      {isEvidenceExpanded && (
                        <pre
                          style={{
                            margin: '6px 0 0',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--terminal-bg)',
                            color: 'var(--terminal-text)',
                            fontSize: '10.5px',
                            maxHeight: '160px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {finding.raw_evidence}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Analysis Coverage ── */}
      <div
        className="card"
        style={{
          padding: '22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.01em' }}>
              Analysis Coverage
            </h4>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Execution records across containerized scanners and AST engine
          </span>
        </div>

        {/* 1. Scanner Engines Execution Table */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ background: 'var(--elevated)', color: 'var(--muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Scanner Engine</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Status</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Purpose</th>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Security Findings</th>
              </tr>
            </thead>
            <tbody>
              {report.engine_coverage
                .filter((eng) => !eng.engine_name.toLowerCase().includes('ast'))
                .map((eng, idx) => {
                  const isSuccess = eng.status.toLowerCase() === 'completed' || eng.status.toLowerCase() === 'success';

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--primary)' }}>
                        <code>{eng.engine_name.toUpperCase()}</code>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 650,
                            background: isSuccess ? 'var(--success-bg)' : 'var(--elevated-2)',
                            color: isSuccess ? 'var(--success)' : 'var(--muted)',
                          }}
                        >
                          {eng.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--secondary)' }}>
                        {eng.purpose || 'Security engine'}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 650, color: 'var(--primary)', textAlign: 'right', fontFamily: 'var(--font-code)' }}>
                        {eng.findings_count}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 2. AST Code Intelligence Indexing Status (Separated from scanner findings) */}
        {report.ast_coverage && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  AST Code Intelligence Indexing
                </span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 650,
                    background: report.ast_coverage.data_available ? 'var(--success-bg)' : 'var(--elevated-2)',
                    color: report.ast_coverage.data_available ? 'var(--success)' : 'var(--muted)',
                  }}
                >
                  {report.ast_coverage.status}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                {report.ast_coverage.files_parsed} of {report.ast_coverage.files_discovered} files parsed ({report.ast_coverage.files_failed} failed)
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Functions</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {report.ast_coverage.total_functions}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Classes</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {report.ast_coverage.total_classes}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Imports</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {report.ast_coverage.total_imports}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>Relationships</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                  {report.ast_coverage.total_relationships}
                </div>
              </div>
            </div>

            {report.ast_coverage.notes && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>
                {report.ast_coverage.notes}
              </div>
            )}
          </div>
        )}

        {/* Provenance details (collapsible) */}
        {report.provenance && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button
              onClick={() => setShowProvenance(!showProvenance)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '11.5px',
                fontWeight: 600,
              }}
            >
              <span>Report Generation Details</span>
              {showProvenance ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showProvenance && (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '11px' }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Provider: </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{report.provenance.provider.toUpperCase()}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Model: </span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>{report.provenance.model}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Status: </span>
                  <span style={{ color: 'var(--secondary)' }}>{report.provenance.generation_status}</span>
                </div>
                {report.provenance.latency_ms !== undefined && (
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Latency: </span>
                    <span style={{ color: 'var(--accent)' }}>{report.provenance.latency_ms}ms</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Complete Findings Inventory (Collapsible) ── */}
      <div
        className="card"
        style={{
          padding: '18px 22px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <button
          onClick={() => setShowFullAppendix(!showFullAppendix)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--primary)',
            fontSize: '13.5px',
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
        >
          <span>Findings Inventory ({filteredAppendixFindings.length} of {report.appendix_findings.length} Findings)</span>
          {showFullAppendix ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showFullAppendix && (
          <div style={{ marginTop: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
              <thead>
                <tr style={{ background: 'var(--elevated)', color: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', width: '85px' }}>ID</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', width: '70px' }}>Severity</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Vulnerability</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Location / Package</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', width: '70px' }}>Tool</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppendixFindings.map((f, idx) => {
                  const sevColor =
                    f.severity === 'CRITICAL'
                      ? '#ef4444'
                      : f.severity === 'HIGH'
                      ? '#f97316'
                      : f.severity === 'MEDIUM'
                      ? '#f59e0b'
                      : '#3b82f6';

                  const loc = f.file_path || f.package_name || 'N/A';
                  const locWithLine = f.line_start ? `${loc}:${f.line_start}` : loc;

                  return (
                    <tr key={f.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-code)' }}>
                        {f.display_id}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-code)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: `${sevColor}15`,
                            color: sevColor,
                          }}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 550, color: 'var(--primary)', maxWidth: '280px' }}>
                        {f.title}
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          color: 'var(--muted)',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-code)',
                        }}
                        title={locWithLine}
                      >
                        {locWithLine}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--secondary)' }}>
                        <code>{f.engine.toUpperCase()}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
