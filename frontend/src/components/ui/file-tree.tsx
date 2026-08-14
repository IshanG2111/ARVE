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
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FileTreeElement = {
  id: string;
  name: string;
  /** Omit or set to "file" for a leaf node; "folder" renders a collapsible branch. */
  type?: "folder" | "file";
  children?: FileTreeElement[];
  /** Custom icon component (receives a `className` prop). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Highlights the item to mark it as newly added / relevant. */
  highlight?: boolean;
  /** Whether this folder starts expanded. */
  defaultOpen?: boolean;
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

const EXT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tsx: FileCode,
  ts: FileCode,
  jsx: FileCode,
  js: FileCode,
  json: FileJson,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  html: FileCode,
  css: FileCode,
  md: FileText,
  mdx: FileText,
  txt: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  svg: FileImage,
  webp: FileImage,
  config: FileCog,
  toml: FileCog,
  yaml: FileCog,
  yml: FileCog,
  env: FileCog,
};

function resolveFileIcon(
  name: string,
  custom?: React.ComponentType<{ className?: string }>,
): React.ComponentType<{ className?: string }> {
  if (custom) return custom;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICONS[ext] ?? File;
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
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
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
    <span className="inline-flex shrink-0 relative" style={{ width: '1.125rem', height: '1.125rem' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isOpen ? "open" : "close"}
          className="inline-flex"
          initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 15 }}
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
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
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
  const { highlightColor, showIcons } = useFileTree();
  const Icon = resolveFileIcon(node.name, node.icon);
  const highlightTarget = useHighlightTarget();

  return (
    <div
      ref={highlightTarget.ref}
      className="relative z-10"
      onMouseEnter={highlightTarget.onMouseEnter}
    >
      <div
        className="flex items-center gap-2 p-2 pointer-events-none"
        style={node.highlight ? { color: highlightColor } : undefined}
      >
        {showIcons && (
          <span className="inline-flex shrink-0" style={{ color: 'var(--muted)' }}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <span className="text-sm font-mono" style={{ color: 'var(--primary)', fontSize: '12.5px' }}>
          {node.name}
        </span>
      </div>
    </div>
  );
}

function FileTreeFolder({ node }: { node: FileTreeElement }) {
  const { defaultOpenIds, highlightColor, indentSize, showIcons } =
    useFileTree();
  const highlightTarget = useHighlightTarget();
  const [isOpen, setIsOpen] = React.useState(
    node.defaultOpen ?? defaultOpenIds.has(node.id),
  );
  const toggle = React.useCallback(() => setIsOpen((open) => !open), []);

  return (
    <FolderContext.Provider value={{ isOpen, toggle }}>
      <div data-value={node.id} className="relative z-10">
        <button type="button" className="w-full text-start" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} onClick={toggle}>
          <div
            ref={highlightTarget.ref}
            onMouseEnter={highlightTarget.onMouseEnter}
          >
            <div className="flex items-center gap-2 p-2 pointer-events-none">
              {showIcons && (
                <FolderIcon
                  closeIcon={<Folder size={16} style={{ color: 'var(--accent)' }} />}
                  openIcon={<FolderOpen size={16} style={{ color: 'var(--accent)' }} />}
                />
              )}
              <span
                className="text-sm font-medium"
                style={{
                  fontSize: '13px',
                  color: node.highlight ? highlightColor : 'var(--primary)',
                  fontWeight: 600,
                }}
              >
                {node.name}
              </span>
            </div>
          </div>
        </button>
        <div
          className="relative ml-6 before:absolute before:-left-2 before:inset-y-0 before:w-px before:h-full before:bg-border"
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
  /** Highlight color for items with `highlight: true`. Defaults to var(--accent). */
  highlightColor?: string;
  /** Horizontal indent per nesting level in px. Defaults to 24. */
  indentSize?: number;
  /** Whether to show file/folder icons. Defaults to true. */
  showIcons?: boolean;
  /** Folder ids that should be open on first render. */
  defaultOpenIds?: string[];
};

export function FileTree({
  elements,
  className,
  highlightColor = "var(--accent)",
  indentSize = 24,
  showIcons = true,
  defaultOpenIds = [],
}: FileTreeProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [highlightBounds, setHighlightBounds] =
    React.useState<HighlightBounds | null>(null);
  const defaultOpenIdSet = React.useMemo(
    () => new Set(defaultOpenIds),
    [defaultOpenIds],
  );

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
      }}
    >
      <div
        className={cn(
          "rounded-xl border border-border overflow-hidden",
          className,
        )}
        style={{ background: 'var(--surface)' }}
      >
        <div
          ref={containerRef}
          className="p-2 w-full relative isolate"
          onMouseLeave={() => setHighlightBounds(null)}
        >
          <FileTreeHoverHighlight className="rounded-lg border bg-accent/15 border-accent/25 z-0" />
          {elements.map((node) => (
            <FileTreeNode key={node.id} node={node} />
          ))}
        </div>
      </div>
    </FileTreeContext.Provider>
  );
}

export function buildFileTree(files: { id?: string; path: string; status?: string }[]): FileTreeElement[] {
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
