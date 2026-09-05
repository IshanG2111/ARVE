import React, {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useRepository} from '../context/RepositoryContext';
import {PageHeader} from '../components/common/PageHeader';
import {SeverityBadge} from '../components/common/SeverityBadge';
import {StatusBadge} from '../components/common/StatusBadge';
import {EmptyState} from '../components/common/EmptyState';
import {FindingDetailModal} from '../components/findings/FindingDetailModal';
import {FileCode, Filter, Search, ShieldAlert, ShieldCheck,} from 'lucide-react';
import type {SecurityFinding} from '@/types';

export const FindingsPage: React.FC = () => {
    const navigate = useNavigate();
    const {currentProject, currentProjectId, findings, setFindings, isProjectLoading} = useRepository();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
    const [selectedEngine, setSelectedEngine] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [sortField] = useState<'severity' | 'date' | 'title'>('severity');
    const [sortDirection] = useState<'asc' | 'desc'>('desc');

    const [inspectingFinding, setInspectingFinding] = useState<SecurityFinding | null>(null);

    const repoQuery = currentProjectId ? `?repo=${currentProjectId}` : '';

    const osvFindings = useMemo(() => findings.filter((f) => f.engine?.toLowerCase() === 'osv'), [findings]);

    const availableEngines = useMemo(() => {
        const engines = new Set<string>();

        findings.forEach((finding) => {
            const engine = finding.engine?.toLowerCase();

            if (engine === 'osv') {
                engines.add('OSV-Scanner');
            }

            if (engine === 'gitleaks') {
                engines.add('Gitleaks');
            }

            if (engine === 'semgrep') {
                engines.add('Semgrep');
            }
        });

        // Phase 4A engines should still be visible on a clean scan
        // where there are zero findings.
        if (engines.size === 0) {
            engines.add('OSV-Scanner');
            engines.add('Gitleaks');
        }

        return Array.from(engines);
    }, [findings]);

    // Distinct ecosystems for OSV
    const osvEcosystems = useMemo(() => {
        const set = new Set<string>();
        osvFindings.forEach((f) => {
            if (f.ecosystem) set.add(f.ecosystem);
        });
        return Array.from(set);
    }, [osvFindings]);

    // Counts respect search + engine + status filters, while intentionally
    // ignoring the active severity selection so the severity distribution remains visible.
    const contextFilteredFindings = useMemo(() => {
        return findings.filter((f) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                if (![f.title, f.description, f.file_path, f.package_name, f.cve, f.rule_id]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(q))) return false;
            }
            if (selectedEngine !== 'ALL' && f.engine?.toLowerCase() !== selectedEngine.toLowerCase()) return false;
            if (selectedStatus !== 'ALL' && f.status?.toUpperCase() !== selectedStatus) return false;
            return true;
        });
    }, [findings, searchQuery, selectedEngine, selectedStatus]);

    const uniquePackagesCount = useMemo(
        () => new Set(contextFilteredFindings.map((f) => f.package_name).filter(Boolean)).size,
        [contextFilteredFindings]
    );
    const uniqueAdvisoriesCount = useMemo(
        () => new Set(contextFilteredFindings.map((f) => f.cve || f.ghsa || f.rule_id || f.title).filter(Boolean)).size,
        [contextFilteredFindings]
    );

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
    }, [findings, searchQuery, selectedSeverity, selectedEngine, selectedStatus, sortField, sortDirection]);

    const handleStatusChange = (findingId: string, newStatus: string) => {
        setFindings((prev) =>
            prev.map((f) => (f.id === findingId ? {...f, status: newStatus} : f))
        );
        if (inspectingFinding && inspectingFinding.id === findingId) {
            setInspectingFinding({...inspectingFinding, status: newStatus});
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
            <div className="page-container" style={{padding: '40px 24px'}}>
                <EmptyState
                    icon={ShieldAlert}
                    title="No repository selected"
                    description="Select or connect a repository to view security findings."
                />
            </div>
        );
    }

    return (
        <div className="findings-page anim-fade-up" style={{padding: '24px 0 64px'}}>
            <div className="page-container" style={{padding: '0 24px'}}>
                {/* Page Header */}
                <PageHeader
                    category="Security Findings"
                    title="Security Issues"
                    description={
                        contextFilteredFindings.length > 0
                            ? `${contextFilteredFindings.length} security issues found across ${uniquePackagesCount} affected package${uniquePackagesCount === 1 ? '' : 's'} · ${uniqueAdvisoriesCount} unique advisories`
                            : 'No security vulnerabilities identified in the current analysis snapshot.'
                    }
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
              {contextFilteredFindings.length} total
            </span>
                    }
                />

                {/* ── Severity & Vulnerability Metric Bar ── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '18px',
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                        {/* Total Count */}
                        <button
                            onClick={() => setSelectedSeverity('ALL')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: selectedSeverity === 'ALL' ? 'var(--elevated-2)' : 'var(--surface)',
                                border: selectedSeverity === 'ALL' ? '1px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                fontWeight: 650,
                                color: 'var(--primary)',
                                cursor: 'pointer',
                            }}
                        >
                            <span>All Findings</span>
                            <span style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-code)',
                                color: 'var(--muted)',
                                background: 'var(--elevated)',
                                padding: '1px 6px',
                                borderRadius: '3px'
                            }}>
                {contextFilteredFindings.length}
              </span>
                        </button>

                        {/* Critical Count */}
                        <button
                            onClick={() => setSelectedSeverity(selectedSeverity === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: selectedSeverity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface)',
                                border: selectedSeverity === 'CRITICAL' ? '1px solid #ef4444' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                fontWeight: 650,
                                color: '#ef4444',
                                cursor: 'pointer',
                            }}
                        >
                            <span>Critical</span>
                            <span style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-code)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444'
                            }}>
                {contextFilteredFindings.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length}
              </span>
                        </button>

                        {/* High Count */}
                        <button
                            onClick={() => setSelectedSeverity(selectedSeverity === 'HIGH' ? 'ALL' : 'HIGH')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: selectedSeverity === 'HIGH' ? 'rgba(249, 115, 22, 0.15)' : 'var(--surface)',
                                border: selectedSeverity === 'HIGH' ? '1px solid #f97316' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                fontWeight: 650,
                                color: '#f97316',
                                cursor: 'pointer',
                            }}
                        >
                            <span>High</span>
                            <span style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-code)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                background: 'rgba(249, 115, 22, 0.2)',
                                color: '#f97316'
                            }}>
                {contextFilteredFindings.filter(f => f.severity?.toUpperCase() === 'HIGH').length}
              </span>
                        </button>

                        {/* Medium Count */}
                        <button
                            onClick={() => setSelectedSeverity(selectedSeverity === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: selectedSeverity === 'MEDIUM' ? 'rgba(234, 179, 8, 0.15)' : 'var(--surface)',
                                border: selectedSeverity === 'MEDIUM' ? '1px solid #eab308' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                fontWeight: 650,
                                color: '#eab308',
                                cursor: 'pointer',
                            }}
                        >
                            <span>Medium</span>
                            <span style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-code)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                background: 'rgba(234, 179, 8, 0.2)',
                                color: '#eab308'
                            }}>
                {contextFilteredFindings.filter(f => f.severity?.toUpperCase() === 'MEDIUM').length}
              </span>
                        </button>

                        {/* Low Count */}
                        <button
                            onClick={() => setSelectedSeverity(selectedSeverity === 'LOW' ? 'ALL' : 'LOW')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: selectedSeverity === 'LOW' ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface)',
                                border: selectedSeverity === 'LOW' ? '1px solid #3b82f6' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                fontWeight: 650,
                                color: '#3b82f6',
                                cursor: 'pointer',
                            }}
                        >
                            <span>Low</span>
                            <span style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-code)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#3b82f6'
                            }}>
                {contextFilteredFindings.filter(f => f.severity?.toUpperCase() === 'LOW').length}
              </span>
                        </button>
                    </div>

                    <div style={{fontSize: '11.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)'}}>
                        Engine:{' '}
                        <span style={{color: 'var(--primary)', fontWeight: 600}}> {availableEngines.join(' • ')}</span> • Ecosystems: <span style={{color: 'var(--accent)'}}>{osvEcosystems.join(', ') || 'npm'}</span>
                    </div>
                </div>

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
                    <div className="input-wrap" style={{flex: '1 1 240px', minWidth: '220px'}}>
            <span className="input-icon">
              <Search size={14}/>
            </span>
                        <input
                            type="text"
                            className="input"
                            placeholder="Search findings by title, file, package, CVE, or rule…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{fontSize: '12.5px', padding: '6px 12px 6px 32px'}}
                            id="findings-search-input"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
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
                            <option value="osv">OSV Scanner (SCA)</option>
                            <option value="gitleaks">GitLeaks (Secrets)</option>
                            <option value="semgrep">Semgrep (SAST)</option>
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

                        {selectedEngine !== 'ALL' && (
                            <button
                                className="btn btn-ghost"
                                onClick={() => setSelectedEngine('ALL')}
                                style={{fontSize: '11px', padding: '4px 8px', gap: '4px'}}
                            >
                                <Filter size={11}/> Reset Engine
                            </button>
                        )}
                    </div>
                </div>

                {/* Findings Data Table */}
                {isProjectLoading && findings.length === 0 ? (
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th style={{width: '110px'}}>Severity</th>
                                <th>Finding</th>
                                <th>Affected File</th>
                                <th>Recommended Fix</th>
                                <th style={{width: '130px'}}>Status</th>
                                <th style={{width: '90px', textAlign: 'right'}}>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="skeleton-shimmer"
                                             style={{width: '60px', height: '20px', borderRadius: '4px'}}/>
                                    </td>
                                    <td>
                                        <div className="skeleton-shimmer" style={{
                                            width: '220px',
                                            height: '16px',
                                            borderRadius: '4px',
                                            marginBottom: '4px'
                                        }}/>
                                        <div className="skeleton-shimmer"
                                             style={{width: '120px', height: '12px', borderRadius: '3px'}}/>
                                    </td>
                                    <td>
                                        <div className="skeleton-shimmer"
                                             style={{width: '140px', height: '14px', borderRadius: '4px'}}/>
                                    </td>
                                    <td>
                                        <div className="skeleton-shimmer"
                                             style={{width: '160px', height: '14px', borderRadius: '4px'}}/>
                                    </td>
                                    <td>
                                        <div className="skeleton-shimmer"
                                             style={{width: '70px', height: '20px', borderRadius: '4px'}}/>
                                    </td>
                                    <td style={{textAlign: 'right'}}>
                                        <div className="skeleton-shimmer" style={{
                                            width: '50px',
                                            height: '16px',
                                            borderRadius: '4px',
                                            marginLeft: 'auto'
                                        }}/>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ) : filteredFindings.length === 0 ? (
                    <EmptyState
                        icon={ShieldCheck}
                        title={searchQuery || selectedSeverity !== 'ALL' || selectedEngine !== 'ALL' ? 'No matching findings' : 'No security findings detected'}
                        description={
                            searchQuery || selectedSeverity !== 'ALL' || selectedEngine !== 'ALL'
                                ? 'Try adjusting your search query or engine filter options.'
                                : "ARVE hasn't identified any security vulnerabilities in the current analysis snapshot."
                        }
                        action={
                            searchQuery || selectedSeverity !== 'ALL' || selectedEngine !== 'ALL' ? (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedSeverity('ALL');
                                        setSelectedEngine('ALL');
                                        setSelectedStatus('ALL');
                                    }}
                                >
                                    Clear All Filters
                                </button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th style={{width: '110px'}}>Severity</th>
                                <th>Finding</th>
                                <th>Affected File</th>
                                <th>Recommended Fix</th>
                                <th style={{width: '120px'}}>Status</th>
                                <th style={{textAlign: 'right', width: '100px'}}>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredFindings.map((f) => (
                                <tr
                                    key={f.id}
                                    style={{cursor: 'pointer'}}
                                    onClick={() => setInspectingFinding(f)}
                                >
                                    <td>
                                        <SeverityBadge severity={f.severity} size="sm"/>
                                    </td>
                                    <td>
                                        <div style={{fontWeight: 650, color: 'var(--primary)', fontSize: '13px'}}>
                                            {f.title}
                                        </div>
                                        <div style={{
                                            fontSize: '11.5px',
                                            color: 'var(--muted)',
                                            fontFamily: 'var(--font-code)',
                                            marginTop: '2px'
                                        }}>
                                            {f.package_name ? `${f.package_name} ${f.package_version || ''}` : f.file_path || '—'}
                                        </div>
                                    </td>
                                    <td style={{
                                        fontFamily: 'var(--font-code)',
                                        color: 'var(--secondary)',
                                        fontSize: '12px'
                                    }}>
                      <span style={{display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
                        <FileCode size={13} color="var(--accent)"/>
                          {f.file_path || '—'}
                      </span>
                                    </td>
                                    <td style={{
                                        fontSize: '12px',
                                        color: f.fixed_version ? 'var(--accent)' : 'var(--muted)'
                                    }}>
                                        {f.fixed_version ? `Upgrade to ${f.fixed_version}+` : 'Review dependency'}
                                    </td>
                                    <td>
                                        <StatusBadge status={f.status} size="sm"/>
                                    </td>
                                    <td style={{textAlign: 'right'}}>
                                        <button
                                            className="btn btn-ghost"
                                            style={{fontSize: '11.5px', padding: '3px 8px', color: 'var(--accent)'}}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setInspectingFinding(f);
                                            }}
                                        >
                                            Inspect →
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
