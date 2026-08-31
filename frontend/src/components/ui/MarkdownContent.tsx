import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lightweight, zero-dependency Markdown renderer for security advisories and descriptions.
 * Handles headings, bold, italics, code spans, code blocks, lists, links, and paragraphs.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className, style }) => {
  if (!content) return null;

  // Process text into structured tokens/blocks
  const renderFormattedText = (text: string) => {
    // Replace inline code, bold, links, italics
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 1. Inline code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={keyIdx++}
            style={{
              background: 'var(--elevated, rgba(255, 255, 255, 0.08))',
              border: '1px solid var(--border)',
              padding: '1px 5px',
              borderRadius: '4px',
              fontFamily: 'var(--font-code, Consolas, monospace)',
              fontSize: '0.9em',
              color: 'var(--accent, #38BDF8)',
            }}
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // 2. Bold: **text** or __text__
      const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
      if (boldMatch) {
        parts.push(
          <strong key={keyIdx++} style={{ fontWeight: 700, color: 'var(--primary)' }}>
            {boldMatch[2]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // 3. Links: [text](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={keyIdx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent, #38BDF8)',
              textDecoration: 'underline',
              fontWeight: 600,
            }}
          >
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // 4. Normal text chunk until next special character
      const nextSpecial = remaining.search(/[`*_\[]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Single stray formatting char
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  // Split into lines/blocks
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} style={{ margin: '8px 0 12px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.55 }}>
              {renderFormattedText(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Code block fences ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`codeblock-${idx}`}
            style={{
              margin: '10px 0',
              padding: '12px 14px',
              background: 'var(--terminal-bg, #0B0F19)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              overflowX: 'auto',
              fontFamily: 'var(--font-code)',
              fontSize: '12px',
              color: 'var(--terminal-text, #E2E8F0)',
              lineHeight: 1.5,
            }}
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushList(idx);
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // List item (- item or * item)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      currentList.push(trimmed.slice(2));
      return;
    }

    flushList(idx);

    if (!trimmed) {
      return;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4
          key={`h4-${idx}`}
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--primary)',
            margin: '14px 0 6px',
            letterSpacing: '-0.01em',
          }}
        >
          {trimmed.slice(4)}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3
          key={`h3-${idx}`}
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--primary)',
            margin: '16px 0 6px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '4px',
          }}
        >
          {trimmed.slice(3)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2
          key={`h2-${idx}`}
          style={{
            fontSize: '15px',
            fontWeight: 750,
            color: 'var(--primary)',
            margin: '18px 0 8px',
          }}
        >
          {trimmed.slice(2)}
        </h2>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: '0 0 10px',
          lineHeight: 1.6,
          color: 'var(--primary)',
          fontSize: '13px',
        }}
      >
        {renderFormattedText(line)}
      </p>
    );
  });

  flushList(lines.length);

  return (
    <div
      className={className}
      style={{
        fontSize: '13px',
        color: 'var(--primary)',
        lineHeight: 1.6,
        ...style,
      }}
    >
      {elements}
    </div>
  );
};
