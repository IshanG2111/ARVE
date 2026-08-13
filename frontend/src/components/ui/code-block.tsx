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
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-950/40 backdrop-blur-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-2 dark:border-slate-800/60 bg-slate-100/30 dark:bg-slate-900/10">
        
        {/* Tabs / Label */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
                  className={`relative px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase rounded-md transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800/50'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/30 dark:hover:bg-slate-800/20'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })
          ) : (
            <span className="text-[10px] font-mono font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
              {currentLanguage || 'code'}
            </span>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={handleCopy}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/60 bg-white/50 text-slate-500 hover:text-slate-800 dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-all duration-200 cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 transition-transform duration-200 scale-110" />
          ) : (
            <Copy className="h-3.5 w-3.5 transition-transform duration-200 hover:scale-105" />
          )}
        </button>
      </div>

      {/* Code Display */}
      <div className="relative max-h-[420px] overflow-y-auto p-4 text-[12.5px] font-mono leading-relaxed text-slate-800 dark:text-slate-200 bg-transparent overflow-x-auto">
        <pre className="whitespace-pre select-all">{currentCode}</pre>
      </div>
    </div>
  );
}
