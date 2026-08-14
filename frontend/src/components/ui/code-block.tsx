import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CodeTab {
  label: string;
  code: string;
  language?: string;
}

export interface CodeBlockProps {
  code?: string;
  language?: string;
  tabs?: CodeTab[];
}

export function CodeBlock({ code, language, tabs }: CodeBlockProps) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const hasTabs = tabs && tabs.length > 0;
  const currentCode = hasTabs ? tabs[activeTabIdx].code : (code || '');
  const currentLanguage = hasTabs ? tabs[activeTabIdx].language : language;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--terminal-bg)',
        color: 'var(--terminal-text)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Tabs / Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          {hasTabs ? (
            tabs.map((tab, idx) => {
              const isActive = idx === activeTabIdx;
              return (
                <button
                  key={tab.label}
                  onClick={() => {
                    setActiveTabIdx(idx);
                    setCopied(false);
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-xs)',
                    border: `1px solid ${isActive ? 'var(--border-strong)' : 'transparent'}`,
                    background: isActive ? 'var(--elevated-2)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--muted)',
                    cursor: 'pointer',
                    transition: 'all 160ms ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })
          ) : (
            <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)', textTransform: 'uppercase' }}>
              {currentLanguage || 'code'}
            </span>
          )}
        </div>

        {/* Copy action */}
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            height: '24px',
            width: '24px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: 0,
          }}
          title="Copy code"
        >
          {copied ? (
            <Check size={12} color="var(--success)" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      </div>

      {/* Code Display */}
      <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '12px 16px', fontSize: '12px', fontFamily: 'var(--font-code)', lineHeight: 1.65, overflowX: 'auto' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre', userSelect: 'all' }}>{currentCode}</pre>
      </div>
    </div>
  );
}
