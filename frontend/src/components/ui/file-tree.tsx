import * as React from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  FileCog,
  Search,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FileTreeElement = {
  id: string;
  name: string;
  type?: "folder" | "file";
  children?: FileTreeElement[];
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  defaultOpen?: boolean;
  size?: number;
  language?: string;
  status?: string;
  skipReason?: string;
};

// ─── Context ───────────────────────────────────────────────────────────────────

type FileTreeCtx = {
  highlightColor: string;
  indentSize: number;
  showIcons: boolean;
  defaultOpenIds: Set<string>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlightBounds: HighlightBounds | null;
  setHighlightBounds: React.Dispatch<
    React.SetStateAction<HighlightBounds | null>
  >;
  searchQuery: string;
  allExpanded: boolean | null;
};

type HighlightBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const FileTreeContext = React.createContext<FileTreeCtx | null>(null);

function useFileTree() {
  const context = React.useContext(FileTreeContext);
  if (!context) {
    throw new Error("File tree components must be used within <FileTree />");
  }
  return context;
}

type FolderCtx = {
  isOpen: boolean;
  toggle: () => void;
};

const FolderContext = React.createContext<FolderCtx | null>(null);

function useFolder() {
  const context = React.useContext(FolderContext);
  if (!context) {
    throw new Error("Folder components must be used within a folder item");
  }
  return context;
}

// ─── Icon resolution ───────────────────────────────────────────────────────────

const EXT_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  tsx: { icon: FileCode, color: '#38BDF8' },
  ts: { icon: FileCode, color: '#38BDF8' },
  jsx: { icon: FileCode, color: '#60A5FA' },
  js: { icon: FileCode, color: '#FACC15' },
  json: { icon: FileJson, color: '#F59E0B' },
  py: { icon: FileCode, color: '#10B981' },
  rs: { icon: FileCode, color: '#F97316' },
  go: { icon: FileCode, color: '#06B6D4' },
  html: { icon: FileCode, color: '#EC4899' },
  css: { icon: FileCode, color: '#818CF8' },
  md: { icon: FileText, color: '#94A3B8' },
  mdx: { icon: FileText, color: '#94A3B8' },
  txt: { icon: FileText, color: '#94A3B8' },
  png: { icon: FileImage, color: '#A855F7' },
  jpg: { icon: FileImage, color: '#A855F7' },
  jpeg: { icon: FileImage, color: '#A855F7' },
  svg: { icon: FileImage, color: '#EC4899' },
  webp: { icon: FileImage, color: '#A855F7' },
  config: { icon: FileCog, color: '#EAB308' },
  toml: { icon: FileCog, color: '#EAB308' },
  yaml: { icon: FileCog, color: '#EAB308' },
  yml: { icon: FileCog, color: '#EAB308' },
  env: { icon: FileCog, color: '#10B981' },
};

function resolveFileMeta(name: string, custom?: React.ComponentType<{ className?: string }>) {
  if (custom) return { Icon: custom, color: 'var(--primary)' };
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const match = EXT_ICONS[ext];
  return match ? { Icon: match.icon, color: match.color } : { Icon: File, color: 'var(--muted)' };
}

// ─── Shared highlight/collapse pieces ──────────────────────────────────────────

function FileTreeHoverHighlight({ className }: { className?: string }) {
  const { highlightBounds } = useFileTree();

  return (
    <AnimatePresence>
      {highlightBounds && (
        <motion.div
          className={className}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            top: highlightBounds.top,
            left: highlightBounds.left,
            width: highlightBounds.width,
            height: highlightBounds.height,
          }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 550, damping: 42 }}
          style={{ position: "absolute", pointerEvents: "none", zIndex: 0 }}
        />
      )}
    </AnimatePresence>
  );
}

function useHighlightTarget() {
  const { containerRef, setHighlightBounds } = useFileTree();
  const ref = React.useRef<HTMLDivElement>(null);

  const onMouseEnter = React.useCallback(() => {
    const element = ref.current;
    const container = containerRef.current;
    if (!element || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    setHighlightBounds({
      top: elementRect.top - containerRect.top,
      left: elementRect.left - containerRect.left,
      width: elementRect.width,
      height: elementRect.height,
    });
  }, [containerRef, setHighlightBounds]);

  return { ref, onMouseEnter };
}

function FolderIcon({
  closeIcon,
  openIcon,
}: {
  closeIcon: React.ReactNode;
  openIcon: React.ReactNode;
}) {
  const { isOpen } = useFolder();

  return (
    <span className="inline-flex shrink-0 relative items-center justify-center" style={{ width: '18px', height: '18px' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isOpen ? "open" : "close"}
          className="inline-flex items-center justify-center"
          initial={{ scale: 0.7, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.7, opacity: 0, rotate: 12 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
            mass: 0.8,
          }}
        >
          {isOpen ? openIcon : closeIcon}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FolderContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useFolder();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Node renderers ────────────────────────────────────────────────────────────

function FileTreeFile({ node }: { node: FileTreeElement }) {
  const { highlightColor, showIcons, searchQuery } = useFileTree();
  const { Icon, color } = resolveFileMeta(node.name, node.icon);
  const highlightTarget = useHighlightTarget();

  const isMatched = searchQuery
    ? node.name.toLowerCase().includes(searchQuery.toLowerCase())
    : false;

  return (
    <div
      ref={highlightTarget.ref}
      className="relative z-10 group"
      onMouseEnter={highlightTarget.onMouseEnter}
    >
      <div
        className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors cursor-pointer"
        style={{
          minHeight: '34px',
          background: isMatched ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {showIcons && (
            <span className="inline-flex shrink-0 items-center justify-center" style={{ color }}>
              <Icon className="w-4 h-4" />
            </span>
          )}
          <span
            className="text-sm font-mono truncate"
            style={{
              color: node.highlight ? highlightColor : 'var(--primary)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {node.name}
          </span>
        </div>

        {/* Metadata Badges (File Size, Language, Status) */}
        <div className="flex items-center gap-2 shrink-0 ml-3 opacity-80 group-hover:opacity-100 transition-opacity">
          {node.language && (
            <span
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-code)',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              {node.language}
            </span>
          )}
          {node.size !== undefined && (
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-code)',
                color: 'var(--dim)',
              }}
            >
              {(node.size / 1024).toFixed(1)} KB
            </span>
          )}
          {node.status && (
            <span
              className={`badge ${node.status === 'INGESTED' ? 'badge-verified' : 'badge-pending'}`}
              style={{ fontSize: '10px', padding: '1px 6px' }}
              title={node.skipReason}
            >
              {node.status === 'INGESTED' ? 'Indexed' : 'Skipped'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function countTotalChildren(node: FileTreeElement): number {
  if (!node.children || node.children.length === 0) return 0;
  let count = 0;
  for (const child of node.children) {
    if (child.type === 'file') count++;
    else count += countTotalChildren(child);
  }
  return count;
}

function FileTreeFolder({ node }: { node: FileTreeElement }) {
  const { defaultOpenIds, highlightColor, indentSize, showIcons, allExpanded, searchQuery } =
    useFileTree();
  const highlightTarget = useHighlightTarget();
  const [isOpen, setIsOpen] = React.useState(
    node.defaultOpen ?? defaultOpenIds.has(node.id),
  );

  React.useEffect(() => {
    if (allExpanded !== null) {
      setIsOpen(allExpanded);
    }
  }, [allExpanded]);

  React.useEffect(() => {
    if (searchQuery) {
      setIsOpen(true);
    }
  }, [searchQuery]);

  const toggle = React.useCallback(() => setIsOpen((open) => !open), []);
  const childCount = React.useMemo(() => countTotalChildren(node), [node]);

  return (
    <FolderContext.Provider value={{ isOpen, toggle }}>
      <div data-value={node.id} className="relative z-10 my-0.5">
        <button
          type="button"
          className="w-full text-start group"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={toggle}
        >
          <div
            ref={highlightTarget.ref}
            onMouseEnter={highlightTarget.onMouseEnter}
          >
            <div
              className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors"
              style={{ minHeight: '34px' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {showIcons && (
                  <FolderIcon
                    closeIcon={<Folder size={17} style={{ color: 'var(--gold, #C99A52)' }} />}
                    openIcon={<FolderOpen size={17} style={{ color: 'var(--gold, #C99A52)' }} />}
                  />
                )}
                <span
                  className="text-sm font-semibold truncate"
                  style={{
                    fontSize: '13.5px',
                    color: node.highlight ? highlightColor : 'var(--primary)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {node.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--muted)',
                    background: 'var(--elevated)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {childCount} {childCount === 1 ? 'file' : 'files'}
                </span>
              </div>

              <div className="text-muted opacity-60 group-hover:opacity-100 transition-opacity">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </div>
          </div>
        </button>

        {/* Collapsible Children Container */}
        <div
          className="relative ml-6 pl-2 before:absolute before:left-0 before:inset-y-1 before:w-[1.5px] before:bg-border/60"
          style={indentSize !== 24 ? { marginLeft: indentSize } : undefined}
        >
          <FolderContent>
            {(node.children ?? []).map((child) => (
              <FileTreeNode key={child.id} node={child} />
            ))}
          </FolderContent>
        </div>
      </div>
    </FolderContext.Provider>
  );
}

function FileTreeNode({ node }: { node: FileTreeElement }) {
  if (node.type === "folder") {
    return <FileTreeFolder node={node} />;
  }
  return <FileTreeFile node={node} />;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export type FileTreeProps = {
  elements: FileTreeElement[];
  className?: string;
  highlightColor?: string;
  indentSize?: number;
  showIcons?: boolean;
  defaultOpenIds?: string[];
  showToolbar?: boolean;
  title?: string;
};

export function FileTree({
  elements,
  className,
  highlightColor = "var(--accent)",
  indentSize = 24,
  showIcons = true,
  defaultOpenIds = [],
  showToolbar = true,
  title,
}: FileTreeProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [highlightBounds, setHighlightBounds] =
    React.useState<HighlightBounds | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [allExpanded, setAllExpanded] = React.useState<boolean | null>(null);

  const defaultOpenIdSet = React.useMemo(
    () => new Set(defaultOpenIds),
    [defaultOpenIds],
  );

  // Filter tree based on search query
  const filteredElements = React.useMemo(() => {
    if (!searchQuery.trim()) return elements;
    const q = searchQuery.toLowerCase().trim();

    function filterNode(node: FileTreeElement): FileTreeElement | null {
      if (node.name.toLowerCase().includes(q)) {
        return node;
      }
      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean) as FileTreeElement[];
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }
      return null;
    }

    return elements.map(filterNode).filter(Boolean) as FileTreeElement[];
  }, [elements, searchQuery]);

  return (
    <FileTreeContext.Provider
      value={{
        highlightColor,
        indentSize,
        showIcons,
        defaultOpenIds: defaultOpenIdSet,
        containerRef,
        highlightBounds,
        setHighlightBounds,
        searchQuery,
        allExpanded,
      }}
    >
      <div
        className={cn(
          "rounded-xl border border-border overflow-hidden flex flex-col",
          className,
        )}
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        {/* Professional IDE Toolbar */}
        {showToolbar && (
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            {/* Left: Title & File Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 650, fontFamily: 'var(--font-code)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--primary)' }}>
                {title || 'Repository File Explorer'}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--accent)',
                  background: 'var(--accent-muted)',
                  border: '1px solid var(--accent-border)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                }}
              >
                {filteredElements.length} top-level items
              </span>
            </div>

            {/* Right: Search Filter & Expand/Collapse Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={13} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Filter files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '5px 12px 5px 28px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-code)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--primary)',
                    width: '170px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setAllExpanded(true)}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '4px 8px', height: '28px' }}
                  title="Expand all folders"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => setAllExpanded(false)}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '4px 8px', height: '28px' }}
                  title="Collapse all folders"
                >
                  Collapse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tree Container with Comfortable Breathing Room */}
        <div
          ref={containerRef}
          className="p-3 w-full relative isolate overflow-y-auto"
          style={{
            minHeight: '280px',
            maxHeight: '520px',
          }}
          onMouseLeave={() => setHighlightBounds(null)}
        >
          <FileTreeHoverHighlight className="rounded-lg border bg-accent/10 border-accent/20 z-0" />
          {filteredElements.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12.5px' }}>
              No files found matching "{searchQuery}"
            </div>
          ) : (
            filteredElements.map((node) => (
              <FileTreeNode key={node.id} node={node} />
            ))
          )}
        </div>
      </div>
    </FileTreeContext.Provider>
  );
}

export function buildFileTree(files: { id?: string; path: string; size?: number; language?: string; status?: string; skip_reason?: string }[]): FileTreeElement[] {
  const root: FileTreeElement[] = [];

  for (const f of files) {
    const parts = f.path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let existing = currentLevel.find((item) => item.name === part);

      if (!existing) {
        existing = {
          id: currentPath,
          name: part,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          highlight: f.status === 'INGESTED',
          defaultOpen: i === 0,
          size: isFile ? f.size : undefined,
          language: isFile ? f.language : undefined,
          status: isFile ? f.status : undefined,
          skipReason: isFile ? f.skip_reason : undefined,
        };
        currentLevel.push(existing);
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  const sortTree = (nodes: FileTreeElement[]) => {
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortTree(node.children);
    }
  };

  sortTree(root);
  return root;
}

export default FileTree;
