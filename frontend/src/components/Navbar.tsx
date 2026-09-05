import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { GitHubIcon } from './GitHubIcon';
import { ProjectWizardModal } from './ProjectWizardModal';
import { useToast } from './ui/ToastProvider';
import { StaggeredMenu } from './ui/StaggeredMenu';
import { useRepository } from '../context/RepositoryContext';
import {
  LogOut,
  ChevronDown,
  Plus,
  GitBranch,
  Check,
  Loader2,
} from 'lucide-react';
import type { User } from '@/types';

interface NavbarProps {
  user: User | null;
  onOpenConnectModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenConnectModal }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();
  const {
    projects,
    currentProject: activeProject,
    selectProject,
    isProjectLoading,
  } = useRepository();

  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const repoDropdownRef = useRef<HTMLDivElement | null>(null);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns when clicking anywhere outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRepoDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeRepoName = activeProject?.name || activeProject?.repo_name?.split('/').pop() || 'ARVE Workspace';
  const activeRepoOwner = activeProject?.repo_owner || (activeProject?.repo_name?.includes('/') ? activeProject.repo_name.split('/')[0] : '');
  const activeBranch = activeProject?.branch || activeProject?.default_branch || 'main';

  const handleOpenConnect = () => {
    if (onOpenConnectModal) {
      onOpenConnectModal();
    } else {
      setShowConnectModal(true);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setRepoDropdownOpen(false);
    selectProject(projectId);
  };

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    queryClient.clear();
    navigate('/');
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'User';

  return (
    <header
      className="navbar"
      style={{
        height: '56px',
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="page-container"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        {/* LEFT: ARVE Brand Mark + Repository Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            }}
            onClick={() => navigate(user ? '/overview' : '/')}
            id="brand-link"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 850,
                  letterSpacing: '-0.03em',
                  color: 'var(--primary)',
                  fontFamily: 'var(--font-logo)',
                  lineHeight: 1,
                }}
              >
                ARVE
              </span>
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'inline-block',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-code)',
                color: 'var(--muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginLeft: '2px',
              }}
            >
              SECURITY
            </span>
          </button>

          {/* Vertical Divider */}
          {user && (
            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
          )}

          {/* Repository Selector Dropdown */}
          {user && (
            <div ref={repoDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  transition: 'border-color 160ms ease, background 160ms ease',
                }}
                id="repo-switcher-btn"
              >
                {isProjectLoading ? (
                  <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                ) : (
                  <GitHubIcon size={14} />
                )}
                <span style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeRepoOwner ? `${activeRepoOwner}/${activeRepoName}` : activeRepoName}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-code)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                >
                  {activeBranch}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--muted)', marginLeft: '2px' }} />
              </button>

              {/* Workspace Dropdown Menu */}
              {repoDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: '280px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-modal)',
                    padding: '6px',
                    zIndex: 100,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-code)',
                      color: 'var(--muted)',
                      padding: '6px 8px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    Select Repository
                  </div>

                  {projects.length > 0 ? (
                    projects.map((p) => {
                      const isSelected = p.id === activeProject?.id;
                      const name = p.name || p.repo_name?.split('/').pop() || 'Repository';
                      const owner = p.repo_owner || (p.repo_name?.includes('/') ? p.repo_name.split('/')[0] : '');

                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProject(p.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'var(--elevated)' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <GitBranch size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 450, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {name}
                              </div>
                              {owner && (
                                <div style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                                  {owner}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check size={13} color="var(--accent)" style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--muted)' }}>
                      No connected repositories
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
                    <button
                      onClick={() => {
                        setRepoDropdownOpen(false);
                        handleOpenConnect();
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        fontWeight: 550,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} />
                      Connect new repository
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: Current Repository Context Indicator */}
        {user && activeProject && (
          <div
            className="navbar-repo-context"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--secondary)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <span style={{ fontWeight: 650, color: 'var(--primary)' }}>
              {activeProject?.name || activeProject?.repo_name?.split('/').pop() || 'ARVE Workspace'}
            </span>
          </div>
        )}

        {/* RIGHT: StaggeredMenu, Theme, Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* StaggeredMenu Global Navigation Component */}
          <StaggeredMenu
            position="right"
            items={user ? [
              { label: 'OVERVIEW', ariaLabel: 'Go to workspace overview', link: '/overview' },
              { label: 'REPOSITORY', ariaLabel: 'Repository architecture and posture', link: '/repository' },
              { label: 'CODE INTELLIGENCE', ariaLabel: 'Explore AST and source code', link: '/code' },
              { label: 'ANALYSIS & SCANS', ariaLabel: 'View analysis runs and scan executions', link: '/analysis' },
              { label: 'SECURITY FINDINGS', ariaLabel: 'Inspect and triage vulnerabilities', link: '/findings' },
              { label: 'TARGET ASSETS', ariaLabel: 'Manage target domains and deployments', link: '/targets' },
              { label: 'SETTINGS', ariaLabel: 'Workspace settings and configuration', link: '/settings' },
            ] : [
              { label: 'HOME', ariaLabel: 'Go to home page', link: '/' },
              { label: 'OVERVIEW', ariaLabel: 'Explore security overview', link: '/overview' },
            ]}
            socialItems={[]}
            displaySocials={false}
            displayItemNumbering={true}
            menuButtonColor="var(--primary)"
            openMenuButtonColor="#ffffff"
            changeMenuColorOnOpen={true}
            colors={['#60A5FA', '#0052FF']}
            accentColor="#0052FF"
          />

          {/* Theme Switcher */}
          <AnimatedThemeToggler variant="circle" />

          {/* User Profile Avatar with dropdown */}
          {user ? (
            <div ref={userDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 650,
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title={displayName}
                id="user-profile-btn"
              >
                {user.avatar_url || user.github_avatar ? (
                  <img
                    src={user.avatar_url || user.github_avatar}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                  />
                ) : (
                  (displayName || 'U')[0].toUpperCase()
                )}
              </button>

              {userDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '200px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-modal)',
                    padding: '6px',
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--primary)' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-code)' }}>
                      {user.email}
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--critical)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginTop: '4px',
                    }}
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              Sign In
            </button>
          )}

          {/* Connect Repository ONLY when 0 projects exist */}
          {user && projects.length === 0 && (
            <button
              onClick={handleOpenConnect}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 12px', gap: '6px' }}
              id="header-connect-repo-btn"
            >
              <Plus size={13} />
              Connect Repository
            </button>
          )}
        </div>
      </div>

      {/* Global Project Wizard Modal */}
      {showConnectModal && (
        <ProjectWizardModal
          onClose={() => setShowConnectModal(false)}
          onCreated={(project) => {
            setShowConnectModal(false);
            // Select the new project immediately so all project-scoped queries
            // switch before the route changes.
            selectProject(project.id);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.success('Repository connected successfully.');
            navigate(`/overview?repo=${project.id}`, { replace: true });
          }}
        />
      )}
    </header>
  );
};

export default Navbar;
