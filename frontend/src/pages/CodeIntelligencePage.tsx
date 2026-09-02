import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRepository } from '../context/RepositoryContext';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { FileTree, buildFileTree } from '../components/ui/file-tree';
import { CodeBlock } from '../components/ui/code-block';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../services/api';
import {
  Code2,
  FileCode,
  FolderTree,
  Search,
} from 'lucide-react';
import type { RepositoryFile } from '@/types';

function norm(p: string): string {
  return (p || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

export const CodeIntelligencePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentProject, latestRun, findings, isLoading: ctxLoading, isProjectLoading } = useRepository();

  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<RepositoryFile | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'source' | 'findings'>('source');

  const fileParam = searchParams.get('file');

  // Fetch real repository files from backend
  useEffect(() => {
    if (!latestRun?.id) {
      setFiles([]);
      setSelectedFile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.getAnalysisFiles(latestRun.id)
      .then((data: RepositoryFile[]) => {
        if (cancelled) return;
        setFiles(data || []);
        // Auto-select first file or URL param
        if (data && data.length > 0) {
          if (fileParam) {
            const matched = data.find((f) => norm(f.path) === norm(fileParam) || f.id === fileParam);
            setSelectedFile(matched || data[0]);
          } else {
            setSelectedFile(data[0]);
          }
        } else {
          setSelectedFile(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiles([]);
          setSelectedFile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [latestRun?.id, fileParam]);

  // Filter & tree
  const filteredFiles = useMemo(() => {
    if (!fileSearch.trim()) return files;
    return files.filter((f) => norm(f.path).toLowerCase().includes(fileSearch.toLowerCase()));
  }, [files, fileSearch]);

  const treeElements = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  // Findings for selected file
  const fileFindings = useMemo(() => {
    if (!selectedFile) return [];
    const sp = norm(selectedFile.path);
    return findings.filter((f) => norm(f.file_path || '') === sp);
  }, [findings, selectedFile]);

  // Source code to display
  const displayCode = useMemo(() => {
    if (!selectedFile) return '';
    if (selectedFile.content) return selectedFile.content;
    // No content from API — show metadata placeholder
    return [
      `// ${norm(selectedFile.path)}`,
      `// Language: ${selectedFile.language || selectedFile.extension || 'unknown'}`,
      `// Size: ${(selectedFile.size / 1024).toFixed(1)} KB`,
      selectedFile.sha256 ? `// SHA256: ${selectedFile.sha256}` : null,
      `// Status: ${selectedFile.status}`,
      '',
      '// Source code was indexed during repository ingestion snapshot.',
    ].filter(Boolean).join('\n');
  }, [selectedFile]);

  // Loading state
  if (ctxLoading || loading || (!currentProject && isProjectLoading)) {
    return (
      <div className="anim-fade-up" style={{ padding: '24px 0 64px' }}>
        <div className="page-container" style={{ padding: '0 24px' }}>
          {/* Header Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-shimmer" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '220px', height: '28px', borderRadius: '6px' }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '90px', height: '26px', borderRadius: '4px' }} />
          </div>

          {/* Dual-Pane Skeleton */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)',
              gap: '16px',
              minHeight: '580px',
            }}
          >
            {/* Left — File tree skeleton */}
            <div
              className="card"
              style={{
                padding: '16px',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div className="skeleton-shimmer" style={{ width: '100%', height: '34px', borderRadius: '6px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer"
                    style={{
                      width: `${60 + (i % 4) * 10}%`,
                      height: '24px',
                      borderRadius: '4px',
                      marginLeft: i % 2 === 0 ? '12px' : '0',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Right — Code editor skeleton */}
            <div
              className="card"
              style={{
                padding: '20px',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton-shimmer" style={{ width: '200px', height: '20px', borderRadius: '4px' }} />
                <div className="skeleton-shimmer" style={{ width: '80px', height: '24px', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginTop: '8px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer"
                    style={{
                      width: `${30 + ((i * 17) % 65)}%`,
                      height: '18px',
                      borderRadius: '3px',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No project
  if (!currentProject) {
    return (
      <div className="page-container" style={{ padding: '40px 24px' }}>
        <EmptyState
          icon={Code2}
          title="No repository connected"
          description="Connect a GitHub repository to inspect codebase structure and security findings."
        />
      </div>
    );
  }

  // No files indexed
  if (files.length === 0) {
    return (
      <div className="page-container anim-fade-up" style={{ padding: '24px' }}>
        <PageHeader
          category="Code Intelligence"
          title="Code Intelligence"
          description="Inspect repository structure, indexed files, and security findings."
        />
        <EmptyState
          icon={FolderTree}
          title="No files indexed"
          description="Run codebase ingestion from the Overview page to index repository files for inspection."
        />
      </div>
    );
  }

  return (
    <div className="anim-fade-up" style={{ padding: '24px 0 64px' }}>
      <div className="page-container" style={{ padding: '0 24px' }}>
        <PageHeader
          category="Code Intelligence"
          title="Code Intelligence"
          description="Inspect normalized repository structure, AST symbols, and file-level security findings."
          badge={
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-code)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}>
              {files.length} files
            </span>
          }
        />

        {/* Dual pane layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)',
          gap: '16px',
          minHeight: '580px',
          width: '100%',
          maxWidth: '100%',
        }}>
          {/* Left — File tree */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: '720px',
            minWidth: 0,
            overflow: 'hidden',
          }}>
            <div className="input-wrap">
              <span className="input-icon"><Search size={13} /></span>
              <input
                type="text"
                className="input"
                placeholder="Filter files…"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                style={{ fontSize: '11.5px', padding: '5px 10px 5px 30px' }}
                id="code-file-search"
              />
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                borderRadius: 'var(--radius-sm)',
              }}
              data-lenis-prevent="true"
            >
              {treeElements.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '11.5px' }}>
                  No matching files
                </div>
              ) : (
                <FileTree
                  elements={treeElements}
                  highlightColor="var(--accent)"
                  defaultOpenIds={['src', 'app', 'components', 'backend', 'lib', 'frontend']}
                  selectedId={selectedFile?.path}
                  onSelectFile={(path) => {
                    const matched = files.find(
                      (f) => norm(f.path) === norm(path) || f.id === path || f.filename === path
                    );
                    if (matched) {
                      setSelectedFile(matched);
                      setActiveTab('source');
                    }
                  }}
                />
              )}
            </div>

            <div style={{
              fontSize: '10.5px',
              color: 'var(--muted)',
              fontFamily: 'var(--font-code)',
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '4px',
              borderTop: '1px solid var(--border)',
            }}>
              <span>{filteredFiles.length}/{files.length}</span>
              <span>{latestRun?.package_manager || ''}</span>
            </div>
          </div>

          {/* Right — Code viewer */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '580px',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
              transition: 'border-color 200ms ease',
            }}
          >
            <AnimatePresence mode="wait">
              {selectedFile ? (
                <motion.div
                  key={selectedFile.path}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, maxWidth: '100%' }}
                >
                  {/* File metadata + tabs */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <FileCode size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 650,
                            color: 'var(--primary)',
                            fontFamily: 'var(--font-code)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {norm(selectedFile.path)}
                        </div>
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--muted)',
                            fontFamily: 'var(--font-code)',
                            marginTop: '2px',
                            display: 'flex',
                            gap: '6px',
                          }}
                        >
                          <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span style={{ textTransform: 'uppercase' }}>{selectedFile.language || selectedFile.extension || '—'}</span>
                          {selectedFile.sha256 && (
                            <>
                              <span style={{ opacity: 0.4 }}>·</span>
                              <span>{selectedFile.sha256.slice(0, 8)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '2px',
                        background: 'var(--elevated)',
                        padding: '2px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {(['source', 'findings'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-code)',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activeTab === tab ? 'var(--surface)' : 'transparent',
                            color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                            fontWeight: activeTab === tab ? 650 : 450,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: activeTab === tab ? 'var(--shadow-subtle)' : 'none',
                            transition: 'all 160ms ease',
                          }}
                        >
                          {tab === 'source' ? 'Source' : 'Findings'}
                          {tab === 'findings' && fileFindings.length > 0 && (
                            <span
                              style={{
                                background: 'var(--critical)',
                                color: 'white',
                                fontSize: '9px',
                                padding: '0 5px',
                                borderRadius: '99px',
                                lineHeight: '14px',
                                fontWeight: 700,
                              }}
                            >
                              {fileFindings.length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Source tab */}
                  {activeTab === 'source' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <CodeBlock
                        code={displayCode}
                        filename={selectedFile.filename || norm(selectedFile.path).split('/').pop() || ''}
                        language={selectedFile.language?.toLowerCase() || selectedFile.extension || undefined}
                      />
                    </div>
                  )}

                  {/* Findings tab */}
                  {activeTab === 'findings' && (
                    <div>
                      {fileFindings.length === 0 ? (
                        <div
                          style={{
                            padding: '36px 16px',
                            textAlign: 'center',
                            background: 'var(--elevated)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed var(--border)',
                          }}
                        >
                          <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0, fontFamily: 'var(--font-code)' }}>
                            No security findings in this file.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {fileFindings.map((f) => (
                            <div
                              key={f.id}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--elevated)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'border-color 160ms ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <SeverityBadge severity={f.severity} size="sm" />
                                <div>
                                  <div style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--primary)' }}>
                                    {f.title}
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                                    {f.engine} · L{f.line_start || 1}
                                  </div>
                                </div>
                              </div>
                              <StatusBadge status={f.status} size="sm" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-select"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    <FileCode size={36} strokeWidth={1.5} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px', margin: 0, fontFamily: 'var(--font-code)' }}>Select a file from the tree to inspect</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeIntelligencePage;
