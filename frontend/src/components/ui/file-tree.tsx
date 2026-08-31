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
  type?: "folder" | "file";
  children?: FileTreeElement[];
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
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
  selectedId?: string;
  onSelectFile?: (filePath: string, node: FileTreeElement) => void;
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
    throw new Error("Folder components must be used within <Folder />");
  }
  return context;
}

// ─── Helpers: File icons based on extension ───────────────────────────────────

const EXT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  svg: FileImage,
  gif: FileImage,
  webp: FileImage,
  yml: FileCog,
  yaml: FileCog,
  toml: FileCog,
  lock: FileCog,
  gitignore: FileCog,
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

function FileTreeHoverHighlight() {
  const { highlightBounds } = useFileTree();

  return (
    <AnimatePresence>
      {highlightBounds && (
        <motion.div
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
          style={{
            position: "absolute",
            pointerEvents: "none",
            zIndex: 0,
            borderRadius: "var(--radius-sm, 6px)",
            background: "var(--elevated)",
            border: "1px solid var(--border)",
          }}
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
    <span style={{ display: 'inline-flex', flexShrink: 0, position: 'relative', width: '18px', height: '18px', alignItems: 'center', justifyContent: 'center' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isOpen ? "open" : "close"}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: "inline-flex" }}
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
          animate={{
            height: "auto",
            opacity: 1,
            transition: {
              height: { type: "spring", stiffness: 500, damping: 40 },
              opacity: { duration: 0.2, delay: 0.05 },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: 0.2 },
              opacity: { duration: 0.1 },
            },
          }}
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
  const { highlightColor, showIcons, selectedId, onSelectFile } = useFileTree();
  const Icon = resolveFileIcon(node.name, node.icon);
  const highlightTarget = useHighlightTarget();

  const isSelected = selectedId === node.id || selectedId?.endsWith(`/${node.name}`) || selectedId === node.name;

  return (
    <div
      ref={highlightTarget.ref}
      style={{
        position: 'relative',
        zIndex: 1,
        cursor: 'pointer',
        borderRadius: 'var(--radius-xs, 4px)',
        background: isSelected ? 'var(--accent-muted)' : 'transparent',
        transition: 'background 140ms ease',
      }}
      onMouseEnter={highlightTarget.onMouseEnter}
      onClick={(e) => {
        e.stopPropagation();
        onSelectFile?.(node.id, node);
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 10px',
          color: isSelected
            ? 'var(--accent)'
            : node.highlight
            ? highlightColor
            : 'var(--primary)',
          fontWeight: isSelected ? 650 : 400,
        }}
      >
        {showIcons && (
          <span
            style={{
              display: 'inline-flex',
              flexShrink: 0,
              opacity: isSelected ? 1 : 0.85,
              color: isSelected
                ? 'var(--accent)'
                : node.highlight
                ? highlightColor
                : 'var(--muted)',
            }}
          >
            <Icon className="w-4 h-4" />
          </span>
        )}
        <span style={{ fontSize: '13px', fontFamily: 'var(--font-code)', userSelect: 'none' }}>
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
      <div data-value={node.id} style={{ position: 'relative', zIndex: 1 }}>
        <button
          type="button"
          style={{
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            padding: 0,
            outline: 'none',
          }}
          onClick={toggle}
        >
          <div
            ref={highlightTarget.ref}
            onMouseEnter={highlightTarget.onMouseEnter}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 10px',
                pointerEvents: 'none',
              }}
            >
              {showIcons && (
                <span style={{ color: 'var(--accent)' }}>
                  <FolderIcon
                    closeIcon={<Folder size={16} />}
                    openIcon={<FolderOpen size={16} />}
                  />
                </span>
              )}
              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: 550,
                  color: node.highlight ? highlightColor : 'var(--primary)',
                  userSelect: 'none',
                }}
              >
                {node.name}
              </span>
            </div>
          </div>
        </button>

        {/* Continuous vertical linking branch line */}
        <div
          style={{
            position: 'relative',
            marginLeft: `${indentSize}px`,
            paddingLeft: '12px',
            borderLeft: '1px solid var(--border)',
          }}
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
  selectedId?: string;
  onSelectFile?: (filePath: string, node: FileTreeElement) => void;
};

export function FileTree({
  elements,
  className,
  highlightColor = "var(--accent)",
  indentSize = 20,
  showIcons = true,
  defaultOpenIds = [],
  selectedId,
  onSelectFile,
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
        selectedId,
        onSelectFile,
      }}
    >
      <div
        className={cn("w-full overflow-hidden", className)}
        style={{
          borderRadius: 'var(--radius-md, 10px)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div
          ref={containerRef}
          style={{ padding: '10px', width: '100%', position: 'relative' }}
          onMouseLeave={() => setHighlightBounds(null)}
        >
          <FileTreeHoverHighlight />
          {elements.map((node) => (
            <FileTreeNode key={node.id} node={node} />
          ))}
        </div>
      </div>
    </FileTreeContext.Provider>
  );
}

export function buildFileTree(
  files: { id?: string; path: string; status?: string }[],
  highlightExtensions: string[] = ["tsx", "ts", "py"]
): FileTreeElement[] {
  const root: FileTreeElement[] = [];

  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let existing = currentLevel.find((item) => item.name === part);

      if (!existing) {
        const ext = part.split(".").pop()?.toLowerCase() ?? "";
        const isHighlight = isFile && (highlightExtensions.includes(ext) || f.status === "INGESTED");

        existing = {
          id: currentPath,
          name: part,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
          highlight: isHighlight,
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
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortTree(node.children);
    }
  };

  sortTree(root);
  return root;
}
