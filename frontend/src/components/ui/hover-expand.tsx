import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HoverExpandItem {
  id?: string;
  label: string;
  sublabel?: string;
  image?: string;
  imageAlt?: string;
  description?: string;
  content?: React.ReactNode;
}

export interface HoverExpandProps {
  items: HoverExpandItem[];
  collapsedHeight?: number;
  expandedHeight?: number;
  className?: string;
  defaultExpandedIndex?: number | null;
}

export function HoverExpand({
  items,
  collapsedHeight = 64,
  expandedHeight = 220,
  className,
  defaultExpandedIndex = 1,
}: HoverExpandProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(
    defaultExpandedIndex ?? null,
  );
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const hasContentMode = items.some((item) => !!item.content);

  return (
    <div
      className={cn("w-full overflow-hidden", className)}
      style={{
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-subtle)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {items.map((item, i) => {
        const isExpanded = hasContentMode
          ? activeIndex === i
          : hoveredIndex === i || activeIndex === i;
        const isHovered = hoveredIndex === i;
        const isOtherHovered = hoveredIndex !== null && !isHovered && !isExpanded;

        return (
          <React.Fragment key={item.id ?? i}>
            {item.content ? (
              <div
                style={{
                  width: '100%',
                  background: isExpanded ? 'var(--elevated)' : 'transparent',
                  transition: 'background 200ms ease',
                }}
              >
                {/* Header Clickable Row */}
                <button
                  type="button"
                  onClick={() => setActiveIndex(isExpanded ? null : i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    cursor: 'pointer',
                    background: isHovered && !isExpanded ? 'var(--elevated)' : 'transparent',
                    border: 'none',
                    outline: 'none',
                    minHeight: `${collapsedHeight}px`,
                    transition: 'background 160ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontFamily: 'var(--font-code)',
                        fontWeight: 650,
                        color: isExpanded ? 'var(--accent)' : 'var(--muted)',
                        flexShrink: 0,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span
                      style={{
                        fontSize: '15.5px',
                        fontWeight: 650,
                        color: 'var(--primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {item.label}
                    </span>

                    {item.description && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          fontFamily: 'var(--font-code)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          opacity: 0.8,
                          marginLeft: '4px',
                        }}
                        className="hidden md:inline"
                      >
                        — {item.description}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, marginLeft: '12px' }}>
                    {item.sublabel && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-code)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: isExpanded ? 'var(--accent)' : 'var(--muted)',
                        }}
                      >
                        {item.sublabel}
                      </span>
                    )}

                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isExpanded ? 'var(--accent)' : 'var(--muted)',
                      }}
                    >
                      <ChevronDown size={17} />
                    </motion.div>
                  </div>
                </button>

                {/* Expanded Interactive Body */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { type: "spring", stiffness: 280, damping: 30 },
                        opacity: { duration: 0.22 },
                      }}
                      style={{
                        overflow: 'hidden',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ padding: '24px 26px', width: '100%' }}>
                        {item.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Image / Ambient Card Mode */
              <motion.div
                style={{
                  position: 'relative',
                  width: '100%',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--surface)',
                }}
                animate={{
                  height: isExpanded ? expandedHeight : collapsedHeight,
                  opacity: isOtherHovered ? 0.45 : 1,
                }}
                transition={{
                  height: {
                    type: "spring",
                    stiffness: 280,
                    damping: 32,
                    mass: 0.9,
                  },
                  opacity: { duration: 0.22, ease: "easeOut" },
                }}
                onHoverStart={() => setHoveredIndex(i)}
                onHoverEnd={() => setHoveredIndex(null)}
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
              >
                {item.image && (
                  <motion.div
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    initial={false}
                    animate={{
                      opacity: isExpanded ? 1 : 0,
                      scale: isExpanded ? 1 : 1.06,
                    }}
                    transition={{
                      opacity: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
                      scale: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.imageAlt ?? ""}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                      decoding="async"
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4), rgba(0,0,0,0.2))' }} />
                  </motion.div>
                )}

                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: '16px 24px' }}>
                  <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontFamily: 'var(--font-code)',
                          fontWeight: 650,
                          color: isExpanded ? 'var(--accent)' : 'var(--muted)',
                          flexShrink: 0,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 650,
                          color: isExpanded ? '#ffffff' : 'var(--primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>

                      {item.description && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: isExpanded ? 'rgba(255,255,255,0.75)' : 'var(--muted)',
                            fontFamily: 'var(--font-code)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          className="hidden sm:inline"
                        >
                          — {item.description}
                        </span>
                      )}
                    </div>

                    {item.sublabel && (
                      <span
                        style={{
                          fontSize: '11px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          fontFamily: 'var(--font-code)',
                          color: isExpanded ? 'rgba(255,255,255,0.7)' : 'var(--muted)',
                          flexShrink: 0,
                        }}
                      >
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {i < items.length - 1 && (
              <div style={{ width: '100%', borderTop: '1px solid var(--border)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default HoverExpand;
