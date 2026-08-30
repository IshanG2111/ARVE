import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, FileCode2 } from 'lucide-react';

export interface CodeBlockProps {
  code?: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const currentCode = code || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API fallback
    }
  };

  const lines = useMemo(() => {
    if (!currentCode) return [''];
    return currentCode.split('\n');
  }, [currentCode]);

  const lineNumWidth = Math.max(String(lines.length).length * 8 + 26, 44);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg, 10px)',
        border: '1px solid var(--border-strong)',
        background: 'var(--surface, #0D1117)',
        boxShadow: 'var(--shadow-subtle, 0 1px 3px rgba(0,0,0,0.12))',
        color: 'var(--primary, #E6EDF3)',
        overflow: 'hidden',
        flex: 1,
        transition: 'border-color 200ms ease',
      }}
    >
      {/* Precision Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          background: 'var(--elevated, #161B22)',
          flexShrink: 0,
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          <FileCode2 size={14} color="var(--accent, #0052FF)" style={{ flexShrink: 0 }} />
          {filename && (
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-code, monospace)',
                color: 'var(--primary, #C9D1D9)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {filename}
            </span>
          )}
          {language && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-code, monospace)',
                color: 'var(--muted, #8B949E)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '1px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {language}
            </span>
          )}
          <span
            style={{
              fontSize: '10.5px',
              fontFamily: 'var(--font-code, monospace)',
              color: 'var(--muted, #484F58)',
              flexShrink: 0,
            }}
          >
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '24px',
              padding: '0 10px',
              borderRadius: '5px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: copied ? 'var(--success, #10B981)' : 'var(--muted, #8B949E)',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-code, monospace)',
              fontWeight: 500,
              transition: 'all 160ms ease',
            }}
            title="Copy source code"
          >
            {copied ? (
              <>
                <Check size={12} strokeWidth={2.5} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body Container — Unified line rows to guarantee 0 overlapping */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          maxWidth: '100%',
          width: '100%',
          maxHeight: '620px',
          fontSize: '12.5px',
          fontFamily: 'var(--font-code, monospace)',
          lineHeight: '21px',
          tabSize: 2,
          background: 'var(--bg, #0D1117)',
          paddingTop: '10px',
          paddingBottom: '10px',
        }}
        data-lenis-prevent="true"
      >
        {lines.map((line, i) => {
          const isSelected = activeLine === i;
          return (
            <div
              key={i}
              onClick={() => setActiveLine(isSelected ? null : i)}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                minHeight: '21px',
                lineHeight: '21px',
                width: 'max-content',
                minWidth: '100%',
                background: isSelected ? 'var(--accent-muted, rgba(0, 82, 255, 0.12))' : 'transparent',
                cursor: 'pointer',
                transition: 'background 100ms ease',
              }}
            >
              {/* Sticky Line Number Gutter */}
              <span
                style={{
                  position: 'sticky',
                  left: 0,
                  width: `${lineNumWidth}px`,
                  minWidth: `${lineNumWidth}px`,
                  textAlign: 'right',
                  paddingRight: '12px',
                  paddingLeft: '10px',
                  userSelect: 'none',
                  color: isSelected ? 'var(--accent, #0052FF)' : 'var(--muted, #484F58)',
                  fontWeight: isSelected ? 750 : 400,
                  fontSize: '11px',
                  background: isSelected ? 'var(--surface, #161B22)' : 'var(--bg, #0D1117)',
                  borderRight: '1px solid var(--border)',
                  flexShrink: 0,
                  zIndex: 2,
                  transition: 'color 100ms ease, background 100ms ease',
                }}
              >
                {i + 1}
              </span>

              {/* Code Line Content */}
              <span
                style={{
                  paddingLeft: '16px',
                  paddingRight: '20px',
                  whiteSpace: 'pre',
                  color: 'var(--primary, #E6EDF3)',
                  flex: 1,
                }}
              >
                <CodeLine line={line} />
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Lightweight syntax tokenizer — zero external dependencies
function CodeLine({ line }: { line: string }) {
  if (!line) return <span>{'\u00A0'}</span>;

  const trimmed = line.trimStart();

  // Full-line comments
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    (trimmed.startsWith('*') && !trimmed.startsWith('**/'))
  ) {
    return <span style={{ color: 'var(--muted, #6E7681)', fontStyle: 'italic' }}>{line}</span>;
  }

  // Tokenize
  const regex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|export|from|def|class|return|const|let|var|if|else|elif|async|await|function|interface|type|try|catch|except|finally|for|while|in|as|with|yield|lambda|raise|pass|break|continue|new|this|self|super)\b|\b(?:None|True|False|null|undefined|true|false)\b|\b\d+(?:\.\d+)?\b)/g;

  const parts: { text: string; type: 'default' | 'string' | 'keyword' | 'literal' | 'number' }[] =
    [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: line.slice(lastIndex, match.index), type: 'default' });
    }
    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      parts.push({ text: token, type: 'string' });
    } else if (/^(?:None|True|False|null|undefined|true|false)$/.test(token)) {
      parts.push({ text: token, type: 'literal' });
    } else if (/^\d/.test(token)) {
      parts.push({ text: token, type: 'number' });
    } else {
      parts.push({ text: token, type: 'keyword' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push({ text: line.slice(lastIndex), type: 'default' });
  }

  if (parts.length === 0) return <span style={{ color: 'var(--primary, #E6EDF3)' }}>{line}</span>;

  const colors = {
    default: 'var(--primary, #E6EDF3)',
    string: '#38BDF8',
    keyword: 'var(--accent, #0052FF)',
    literal: '#F59E0B',
    number: '#34D399',
  };

  return (
    <span>
      {parts.map((p, i) => (
        <span key={i} style={{ color: colors[p.type] }}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

export default CodeBlock;
