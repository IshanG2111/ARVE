import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Code2,
  FileText,
} from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  maxHeight?: string;
  initialExpandedDepth?: number;
}

// Color theme for syntax highlighting
const SYNTAX_COLORS = {
  key: 'var(--accent, #38BDF8)',
  string: '#34D399',
  number: '#FBBF24',
  boolean: '#C084FC',
  nullValue: '#94A3B8',
  bracket: 'var(--muted, #64748B)',
};

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title = 'JSON Artifact',
  maxHeight = '500px',
  initialExpandedDepth = 2,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const formattedRawString = useMemo(() => {
    try {
      return typeof data === 'string' ? JSON.stringify(JSON.parse(data), null, 2) : JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const parsedObject = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return { raw: data };
      }
    }
    return data || {};
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedRawString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedRawString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: prev[path] !== undefined ? !prev[path] : false,
    }));
  };

  const isNodeExpanded = (path: string, depth: number) => {
    if (searchQuery.trim().length > 0) return true; // Auto-expand when searching
    if (expandedNodes[path] !== undefined) return expandedNodes[path];
    return depth <= initialExpandedDepth;
  };

  // Render individual tree item
  const renderTree = (val: any, path: string = 'root', depth: number = 1): React.ReactNode => {
    if (val === null) {
      return <span style={{ color: SYNTAX_COLORS.nullValue, fontStyle: 'italic' }}>null</span>;
    }
    if (typeof val === 'boolean') {
      return <span style={{ color: SYNTAX_COLORS.boolean, fontWeight: 600 }}>{val ? 'true' : 'false'}</span>;
    }
    if (typeof val === 'number') {
      return <span style={{ color: SYNTAX_COLORS.number, fontFamily: 'var(--font-code)' }}>{val}</span>;
    }
    if (typeof val === 'string') {
      const isMatch = searchQuery && val.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        <span
          style={{
            color: SYNTAX_COLORS.string,
            background: isMatch ? 'rgba(250, 204, 21, 0.25)' : 'transparent',
            padding: isMatch ? '1px 3px' : '0',
            borderRadius: '2px',
            wordBreak: 'break-word',
          }}
        >
          &quot;{val}&quot;
        </span>
      );
    }

    const isArray = Array.isArray(val);
    const keys = Object.keys(val);
    const isEmpty = keys.length === 0;
    const expanded = isNodeExpanded(path, depth);

    if (isEmpty) {
      return <span style={{ color: SYNTAX_COLORS.bracket }}>{isArray ? '[]' : '{}'}</span>;
    }

    return (
      <div style={{ marginLeft: depth > 1 ? '16px' : '0' }}>
        <span
          onClick={() => toggleNode(path)}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            userSelect: 'none',
            color: 'var(--secondary)',
            fontSize: '11.5px',
          }}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span style={{ color: SYNTAX_COLORS.bracket }}>{isArray ? '[' : '{'}</span>
          {!expanded && (
            <span style={{ color: 'var(--muted)', fontSize: '11px', padding: '0 4px' }}>
              {keys.length} {isArray ? 'items' : 'keys'}
            </span>
          )}
          {!expanded && <span style={{ color: SYNTAX_COLORS.bracket }}>{isArray ? ']' : '}'}</span>}
        </span>

        {expanded && (
          <div style={{ paddingLeft: '8px', borderLeft: '1px dashed var(--border)', margin: '2px 0 2px 6px' }}>
            {keys.map((key, idx) => {
              const childPath = `${path}.${key}`;
              const childVal = val[key];
              const isKeyMatch = searchQuery && key.toLowerCase().includes(searchQuery.toLowerCase());

              return (
                <div key={key} style={{ margin: '3px 0', lineHeight: 1.5, fontSize: '12px' }}>
                  <span
                    style={{
                      color: SYNTAX_COLORS.key,
                      fontWeight: 600,
                      background: isKeyMatch ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                      padding: isKeyMatch ? '1px 3px' : '0',
                      borderRadius: '2px',
                    }}
                  >
                    {!isArray ? `"${key}"` : idx}:
                  </span>{' '}
                  {renderTree(childVal, childPath, depth + 1)}
                  {idx < keys.length - 1 && <span style={{ color: SYNTAX_COLORS.bracket }}>,</span>}
                </div>
              );
            })}
          </div>
        )}

        {expanded && <div style={{ color: SYNTAX_COLORS.bracket, fontSize: '12px' }}>{isArray ? ']' : '}'}</div>}
      </div>
    );
  };

  return (
    <div
      className="json-viewer-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--terminal-bg, #0B0F19)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md, 8px)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-modal)',
      }}
    >
      {/* Action Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--elevated, #111827)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Left: View Mode Toggle & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('tree')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'tree' ? 'var(--elevated)' : 'transparent',
                color: viewMode === 'tree' ? 'var(--primary)' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Code2 size={12} />
              Tree View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'raw' ? 'var(--elevated)' : 'transparent',
                color: viewMode === 'raw' ? 'var(--primary)' : 'var(--muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FileText size={12} />
              Raw JSON
            </button>
          </div>

          {viewMode === 'tree' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0 8px',
                height: '28px',
              }}
            >
              <Search size={12} style={{ color: 'var(--muted)', marginRight: '6px' }} />
              <input
                type="text"
                placeholder="Filter keys or values…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '11.5px',
                  color: 'var(--primary)',
                  width: '140px',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Copy & Download Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ fontSize: '11px', padding: '4px 10px', gap: '5px' }}
          >
            {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownload}
            style={{ fontSize: '11px', padding: '4px 10px', gap: '5px' }}
            title="Download JSON file"
          >
            <Download size={12} />
            Download
          </button>
        </div>
      </div>

      {/* Viewer Body */}
      <div
        style={{
          padding: '16px 18px',
          maxHeight,
          overflowY: 'auto',
          fontFamily: 'var(--font-code, Consolas, Monaco, monospace)',
          fontSize: '12px',
        }}
      >
        {viewMode === 'tree' ? (
          <div>{renderTree(parsedObject)}</div>
        ) : (
          <pre
            style={{
              margin: 0,
              color: 'var(--terminal-text, #E2E8F0)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.6,
            }}
          >
            {formattedRawString}
          </pre>
        )}
      </div>
    </div>
  );
};
