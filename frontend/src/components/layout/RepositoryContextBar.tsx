import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRepository } from '../../context/RepositoryContext';
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Code2,
  Globe,
  FolderGit2,
  Settings,
  RefreshCw,
} from 'lucide-react';

export const RepositoryContextBar: React.FC = () => {
  const { currentProject, isScanActive, latestScan, runs } = useRepository();
  const location = useLocation();

  if (!currentProject) return null;

  const repoQuery = currentProject.id ? `?repo=${currentProject.id}` : '';

  const navItems = [
    { path: '/overview', label: 'Overview', icon: LayoutDashboard },
    { path: '/analysis', label: 'Analysis', icon: Activity },
    { path: '/findings', label: 'Findings', icon: ShieldAlert },
    { path: '/code', label: 'Code Intelligence', icon: Code2 },
    { path: '/targets', label: 'Targets', icon: Globe },
    { path: '/repository', label: 'Repository', icon: FolderGit2 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Helper to match active route considering aliases (/dashboard -> /overview, /scans -> /analysis, etc.)
  const isItemActive = (itemPath: string) => {
    const current = location.pathname;
    if (itemPath === '/overview' && (current === '/overview' || current === '/dashboard' || current === '/')) return true;
    if (itemPath === '/analysis' && (current === '/analysis' || current === '/scans')) return true;
    if (itemPath === '/code' && (current === '/code' || current === '/code-intelligence' || current.startsWith('/projects/'))) return true;
    if (itemPath === '/findings' && current === '/findings') return true;
    if (itemPath === '/targets' && current === '/targets') return true;
    if (itemPath === '/repository' && current === '/repository') return true;
    if (itemPath === '/settings' && current === '/settings') return true;
    return current === itemPath;
  };

  return (
    <div
      className="repository-context-bar"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: '56px',
        zIndex: 40,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="page-container" style={{ padding: '0 24px' }}>
        {/* Navigation Tabs Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            overflowX: 'auto',
          }}
        >
          {/* Left Navigation Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              minHeight: '44px',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={`${item.path}${repoQuery}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    fontWeight: active ? 600 : 450,
                    color: active ? 'var(--primary)' : 'var(--muted)',
                    textDecoration: 'none',
                    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    transition: 'all 160ms var(--ease-smooth)',
                    whiteSpace: 'nowrap',
                  }}
                  className={active ? 'context-nav-item active' : 'context-nav-item'}
                >
                  <Icon size={14} style={{ opacity: active ? 1 : 0.7 }} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Compact State Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 0',
              flexShrink: 0,
            }}
          >
            {isScanActive ? (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <RefreshCw size={11} className="spin" /> Scanning ({latestScan?.progress_percent ?? 0}%)
              </span>
            ) : currentProject.verified ? (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot dot-green" /> Verified
              </span>
            ) : runs.length > 0 ? (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot dot-green" /> Ingested ({runs[0].files_ingested} files)
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-code)', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot dot-yellow" /> Not Ingested
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryContextBar;
