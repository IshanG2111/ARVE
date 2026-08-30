import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../context/RepositoryContext';
import { PageHeader } from '../components/common/PageHeader';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { FindingDetailModal } from '../components/findings/FindingDetailModal';
import {
  ShieldAlert,
  Search,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import type { SecurityFinding } from '@/types';

export const FindingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentProject, currentProjectId, findings, setFindings } = useRepository();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedEngine, setSelectedEngine] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortField] = useState<'severity' | 'date' | 'title'>('severity');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');

  const [inspectingFinding, setInspectingFinding] = useState<SecurityFinding | null>(null);

  const repoQuery = currentProjectId ? `?repo=${currentProjectId}` : '';

  // Filter & Search Logic
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(q);
        const matchesDesc = f.description ? f.description.toLowerCase().includes(q) : false;
        const matchesFile = f.file_path ? f.file_path.toLowerCase().includes(q) : false;
        const matchesPkg = f.package_name ? f.package_name.toLowerCase().includes(q) : false;
        const matchesCve = f.cve ? f.cve.toLowerCase().includes(q) : false;
        const matchesRule = f.rule_id ? f.rule_id.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesDesc && !matchesFile && !matchesPkg && !matchesCve && !matchesRule) {
          return false;
        }
      }

      // Severity filter
      if (selectedSeverity !== 'ALL' && f.severity?.toUpperCase() !== selectedSeverity) {
        return false;
      }

      // Engine filter
      if (selectedEngine !== 'ALL' && f.engine?.toLowerCase() !== selectedEngine.toLowerCase()) {
        return false;
      }

      // Type filter
      if (selectedType !== 'ALL' && f.finding_type?.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL' && f.status?.toUpperCase() !== selectedStatus) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'severity') {
        const severityRank: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
          INFO: 0,
        };
        const rankA = severityRank[a.severity?.toUpperCase()] ?? 0;
        const rankB = severityRank[b.severity?.toUpperCase()] ?? 0;
        return sortDirection === 'desc' ? rankB - rankA : rankA - rankB;
      }
      if (sortField === 'title') {
        return sortDirection === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [findings, searchQuery, selectedSeverity, selectedEngine, selectedType, selectedStatus, sortField, sortDirection]);

  const handleStatusChange = (findingId: string, newStatus: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: newStatus } : f))
    );
    if (inspectingFinding && inspectingFinding.id === findingId) {
      setInspectingFinding({ ...inspectingFinding, status: newStatus });
    }
  };

  const handleOpenInCode = (filePath?: string) => {
    if (filePath) {
      navigate(`/code${repoQuery}&file=${encodeURIComponent(filePath)}`);
    } else {
      navigate(`/code${repoQuery}`);
    }
  };

  if (!currentProject) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={ShieldAlert}
          title="No repository selected"
          description="Select or connect a repository to view security findings."
        />
      </div>
    );
  }

  return (
    <div className="findings-page anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* Page Header */}
        <PageHeader
          category="Security Vulnerabilities"
          title="Security Findings"
          description="Normalized security findings across SAST, secret detection, and dependency composition scanners."
          badge={
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-code)',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              {findings.length} total
            </span>
          }
        />

        {/* Filter Bar */}
        <div
          className="card filter-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Box */}
          <div className="input-wrap" style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <span className="input-icon">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="input"
              placeholder="Search findings by title, file, package, CVE, or rule…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '12.5px', padding: '6px 12px 6px 32px' }}
              id="findings-search-input"
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                fontFamily: 'var(--font-code)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
              id="severity-filter"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Engine Filter */}
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                fontFamily: 'var(--font-code)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
              id="engine-filter"
            >
              <option value="ALL">All Engines</option>
              <option value="osv">OSV Scanner</option>
              <option value="gitleaks">GitLeaks</option>
              <option value="semgrep">Semgrep SAST</option>
            </select>

            {/* Finding Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                fontFamily: 'var(--font-code)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
              id="type-filter"
            >
              <option value="ALL">All Types</option>
              <option value="dependency">Dependency (SCA)</option>
              <option value="secret">Secret</option>
              <option value="sast">SAST</option>
              <option value="configuration">Configuration</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '11.5px',
                fontFamily: 'var(--font-code)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
              id="status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="SUPPRESSED">Suppressed</option>
            </select>
          </div>
        </div>

        {/* Findings Data Table */}
        {filteredFindings.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={searchQuery || selectedSeverity !== 'ALL' ? 'No matching findings' : 'No security findings detected'}
            description={
              searchQuery || selectedSeverity !== 'ALL'
                ? 'Try adjusting your search query or filter options.'
                : "ARVE hasn't identified any security vulnerabilities in the current analysis snapshot."
            }
            action={
              searchQuery || selectedSeverity !== 'ALL' ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSeverity('ALL');
                    setSelectedEngine('ALL');
                    setSelectedType('ALL');
                    setSelectedStatus('ALL');
                  }}
                >
                  Clear Filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Severity</th>
                  <th>Finding Title &amp; Details</th>
                  <th>Location / Target</th>
                  <th>Engine</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((f) => (
                  <tr
                    key={f.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setInspectingFinding(f)}
                  >
                    <td>
                      <SeverityBadge severity={f.severity} size="sm" />
                    </td>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--primary)', fontSize: '13px' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                        {f.rule_id && <span>Rule: {f.rule_id}</span>}
                        {f.cve && <span style={{ color: 'var(--critical)' }}>{f.cve}</span>}
                        {f.cwe && <span>{f.cwe}</span>}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-code)', color: 'var(--secondary)', fontSize: '12px' }}>
                      {f.file_path ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <FileCode size={13} color="var(--accent)" />
                          {f.file_path}
                          {f.line_start ? ` : ${f.line_start}` : ''}
                        </span>
                      ) : f.package_name ? (
                        <span>{f.package_name} {f.package_version ? `@ ${f.package_version}` : ''}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-code)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {f.engine}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={f.status} size="sm" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '11.5px', padding: '3px 8px', color: 'var(--accent)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingFinding(f);
                        }}
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finding Detail Modal */}
      {inspectingFinding && (
        <FindingDetailModal
          finding={inspectingFinding}
          onClose={() => setInspectingFinding(null)}
          onStatusChange={handleStatusChange}
          onOpenInCode={handleOpenInCode}
        />
      )}
    </div>
  );
};

export default FindingsPage;
