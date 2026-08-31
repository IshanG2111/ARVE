import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, ArrowUpRight } from 'lucide-react';

export interface MenuItem {
  label: string;
  ariaLabel?: string;
  link: string;
  badge?: string;
}

export interface SocialItem {
  label: string;
  link: string;
}

export interface StaggeredMenuProps {
  position?: 'left' | 'right';
  items?: MenuItem[];
  socialItems?: SocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  changeMenuColorOnOpen?: boolean;
  colors?: string[];
  logoUrl?: string;
  accentColor?: string;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
  position = 'right',
  items = [
    { label: 'OVERVIEW', ariaLabel: 'Go to workspace overview', link: '/overview' },
    { label: 'REPOSITORY', ariaLabel: 'Repository architecture and posture', link: '/repository' },
    { label: 'CODE INTELLIGENCE', ariaLabel: 'Explore AST and source code', link: '/code' },
    { label: 'ANALYSIS & SCANS', ariaLabel: 'View analysis runs and scan executions', link: '/analysis' },
    { label: 'SECURITY FINDINGS', ariaLabel: 'Inspect and triage vulnerabilities', link: '/findings' },
    { label: 'TARGET ASSETS', ariaLabel: 'Manage target domains and deployments', link: '/targets' },
    { label: 'SETTINGS', ariaLabel: 'Workspace settings and configuration', link: '/settings' },
  ],
  socialItems = [
    { label: 'Twitter', link: 'https://twitter.com' },
    { label: 'GitHub', link: 'https://github.com/IshanG2111/ARVE' },
    { label: 'LinkedIn', link: 'https://linkedin.com' },
  ],
  displaySocials = true,
  displayItemNumbering = true,
  menuButtonColor = 'currentColor',
  openMenuButtonColor = '#ffffff',
  changeMenuColorOnOpen = true,
  accentColor = '#0052FF',
  onMenuOpen,
  onMenuClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = () => {
    if (!isOpen) {
      setIsOpen(true);
      onMenuOpen?.();
    } else {
      setIsOpen(false);
      onMenuClose?.();
    }
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onMenuClose?.();
  }, [onMenuClose]);

  // Keyboard navigation (ESC key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  // Prevent scrolling behind when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleItemClick = (link: string) => {
    closeMenu();
    if (link.startsWith('http')) {
      window.open(link, '_blank', 'noreferrer');
    } else {
      // Preserve repo param if present in current query
      const currentQuery = location.search;
      if (currentQuery && !link.includes('?')) {
        navigate(`${link}${currentQuery}`);
      } else {
        navigate(link);
      }
    }
  };

  const menuModal = (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: position === 'left' ? 'flex-start' : 'flex-end',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Blurred Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={closeMenu}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              zIndex: 1,
            }}
          />

          {/* Sliding Dropdown Menu Panel (Goes down smoothly from top) */}
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.98 }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              maxWidth: '520px',
              background: 'var(--surface)',
              color: 'var(--primary)',
              borderRadius: '24px',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border)',
              padding: '32px 36px 28px',
              marginTop: '8px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 850,
                    letterSpacing: '-0.035em',
                    color: 'var(--primary)',
                    fontFamily: 'var(--font-logo)',
                    lineHeight: 1,
                  }}
                >
                  ARVE
                </span>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: accentColor,
                    display: 'inline-block',
                  }}
                />
              </div>

              {/* Close Button matching Screenshot ("Close ✕") */}
              <button
                onClick={closeMenu}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  transition: 'all 160ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = accentColor;
                  e.currentTarget.style.background = 'var(--elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <span>Close</span>
                <span style={{ fontSize: '15px', lineHeight: 1 }}>✕</span>
              </button>
            </div>

            {/* Menu Items List with Staggered Animations */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                margin: '12px 0 6px',
              }}
            >
              {items.map((item, index) => {
                const numStr = String(index + 1).padStart(2, '0');
                const isCurrent =
                  location.pathname === item.link ||
                  (item.link === '/overview' && location.pathname === '/');

                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{
                      duration: 0.3,
                      delay: 0.05 + index * 0.035,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <button
                      onClick={() => handleItemClick(item.link)}
                      aria-label={item.ariaLabel || item.label}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isCurrent ? 'var(--primary)' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: '4px 0',
                        width: '100%',
                        transition: 'all 180ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(6px)';
                        const titleSpan = e.currentTarget.querySelector('.menu-item-text') as HTMLElement;
                        if (titleSpan) titleSpan.style.color = accentColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0px)';
                        const titleSpan = e.currentTarget.querySelector('.menu-item-text') as HTMLElement;
                        if (titleSpan) titleSpan.style.color = 'var(--primary)';
                      }}
                    >
                      <span
                        className="menu-item-text"
                        style={{
                          fontSize: 'clamp(28px, 5vw, 38px)',
                          fontWeight: 850,
                          letterSpacing: '-0.03em',
                          fontFamily: 'var(--font-ui)',
                          color: 'var(--primary)',
                          textTransform: 'uppercase',
                          lineHeight: 1.15,
                          transition: 'color 160ms ease',
                        }}
                      >
                        {item.label}
                      </span>
                      {displayItemNumbering && (
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-code)',
                            color: accentColor,
                            verticalAlign: 'super',
                            marginLeft: '2px',
                          }}
                        >
                          {numStr}
                        </span>
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Socials & Footer */}
            {displaySocials && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  paddingTop: '18px',
                  borderTop: '1px solid var(--border)',
                  marginTop: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  {socialItems.map((s) => (
                    <a
                      key={s.label}
                      href={s.link}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: 'var(--muted)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-code)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'color 160ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      <span>{s.label}</span>
                      <ArrowUpRight size={11} />
                    </a>
                  ))}
                </div>

                <div style={{ fontSize: '10.5px', fontFamily: 'var(--font-code)', color: 'var(--muted)' }}>
                  ARVE • SECURITY ENGINE
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const currentButtonColor = isOpen && changeMenuColorOnOpen ? openMenuButtonColor : menuButtonColor;

  return (
    <>
      {/* Trigger Button in Header */}
      <button
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="staggered-menu-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: currentButtonColor,
          fontSize: '12px',
          fontFamily: 'var(--font-code)',
          fontWeight: 650,
          cursor: 'pointer',
          transition: 'all 160ms ease',
          boxShadow: 'var(--shadow-subtle)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-strong)';
          e.currentTarget.style.background = 'var(--elevated)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--surface)';
        }}
      >
        <Menu size={14} />
        <span style={{ letterSpacing: '0.04em' }}>MENU</span>
      </button>

      {/* Render via Portal so it never gets clipped or trapped */}
      {createPortal(menuModal, document.body)}
    </>
  );
};

export default StaggeredMenu;
