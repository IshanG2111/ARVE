import React, { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { GitHubIcon } from './GitHubIcon';
import { ProjectWizardModal } from './ProjectWizardModal';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './ui/ToastProvider';
import {
  LogOut,
  ChevronDown,
  Plus,
  GitBranch,
  Check,
  Trash2,
} from 'lucide-react';
import type { User } from '@/types';

interface NavbarProps {
  user: User | null;
  onOpenConnectModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenConnectModal }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { logout } = useAuth();
  const { data: projects = [] } = useProjects();
  const deleteProject = useDeleteProject();

  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [deleteProjectRequest, setDeleteProjectRequest] = useState<{ id: string; name: string } | null>(null);
  
  const pathProjectId = location.pathname.startsWith('/projects/') ? location.pathname.split('/')[2] : null;
  const currentRepoParam = searchParams.get('repo') || pathProjectId;
  const activeProject = projects.find(p => p.id === currentRepoParam) || projects[0];
  const activeRepoName = activeProject?.repo_name || activeProject?.name || 'IshanG2111 / ARVE-Engine';
  const activeBranch = activeProject?.default_branch || 'main';

  const handleOpenConnect = () => {
    if (onOpenConnectModal) {
      onOpenConnectModal();
    } else {
      setShowConnectModal(true);
    }
  };

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    navigate('/');
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'Ishan';

  return (
    <header
      className="navbar"
      style={{
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'background-color 320ms var(--ease-smooth), border-color 320ms var(--ease-smooth)',
      }}
    >
      <div className="page-container navbar-inner" style={{ height: '56px' }}>
        {/* Left: Brand Monogram + Typography */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
            onClick={() => navigate(user ? '/dashboard' : '/')}
            id="brand-link"
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  transition: 'color 320ms var(--ease-smooth)',
                }}
              >
                ARVE
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  transition: 'color 320ms var(--ease-smooth)',
                }}
              >
                ENGINE
              </span>
            </div>
          </button>

          {/* Repository / Workspace Switcher Dropdown */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-code)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                id="repo-switcher-btn"
              >
                <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center' }}>
                  <GitHubIcon size={14} />
                </div>
                <span style={{ fontWeight: 500 }}>{activeRepoName}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    marginLeft: '2px',
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
                    minWidth: '260px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-modal)',
                    padding: '6px',
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-code)',
                      color: 'var(--muted)',
                      padding: '6px 10px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Switch Workspace
                  </div>

                  {projects.length > 0 ? (
                    projects.map((p) => {
                      const isSelected = p.id === activeProject?.id;
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'var(--elevated)' : 'transparent',
                            paddingRight: '4px',
                            gap: '4px',
                          }}
                        >
                          <button
                            onClick={() => {
                              setRepoDropdownOpen(false);
                              navigate(`/dashboard?repo=${p.id}`);
                            }}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'transparent',
                              border: 'none',
                              color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              minWidth: 0,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <GitBranch size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                              <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.name || p.repo_name}
                              </span>
                            </div>
                            {isSelected && <Check size={13} color="var(--accent)" style={{ flexShrink: 0, marginLeft: '6px' }} />}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepoDropdownOpen(false);
                              setDeleteProjectRequest({ id: p.id, name: p.name || p.repo_name || 'Repository' });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--muted)',
                              padding: '6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'color 160ms ease',
                            }}
                            title={`Delete ${p.name || p.repo_name}`}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--critical)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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
                        fontWeight: 500,
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

        {/* Right Navigation & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Docs & GitHub Links */}
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="https://github.com/IshanG2111/ARVE"
              target="_blank"
              rel="noreferrer"
              className="nav-link"
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 320ms var(--ease-smooth)',
              }}
            >
              Docs
            </a>
            <a
              href="https://github.com/IshanG2111/ARVE"
              target="_blank"
              rel="noreferrer"
              className="nav-link"
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 320ms var(--ease-smooth)',
              }}
            >
              GitHub
            </a>
          </div>

          {/* Theme Switcher */}
          <AnimatedThemeToggler variant="circle" />

          {/* User Profile Avatar */}
          {user && (
            <div
              className="user-avatar"
              title={displayName}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'var(--elevated)',
                border: '1px solid var(--border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--primary)',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
              onClick={handleLogout}
            >
              {user.avatar_url || user.github_avatar ? (
                <img
                  src={user.avatar_url || user.github_avatar}
                  alt={displayName}
                  style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                />
              ) : (
                (displayName || 'I')[0].toUpperCase()
              )}
            </div>
          )}

          {/* Connect Repository Primary Button */}
          {user && (
            <button
              onClick={handleOpenConnect}
              className="btn btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              id="header-connect-repo-btn"
            >
              <Plus size={13} />
              Connect Repository
            </button>
          )}

          {/* Sign Out for Mobile/Minimal */}
          {user && (
            <button
              className="btn btn-ghost btn-icon"
              style={{ color: 'var(--muted)', display: 'none' }}
              onClick={handleLogout}
              title="Sign out"
              id="logout-btn"
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Global Project Wizard Modal */}
      {showConnectModal && (
        <ProjectWizardModal
          onClose={() => setShowConnectModal(false)}
          onCreated={() => {
            setShowConnectModal(false);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.success('Repository workspace connected successfully.');
            navigate('/dashboard');
          }}
        />
      )}

      {/* Delete Workspace Confirmation Modal */}
      {deleteProjectRequest && (
        <ConfirmModal
          onCancel={() => setDeleteProjectRequest(null)}
          onConfirm={() => {
            deleteProject.mutate(deleteProjectRequest.id, {
              onSuccess: () => {
                toast.success(`Repository "${deleteProjectRequest.name}" removed.`);
                setDeleteProjectRequest(null);
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                navigate('/dashboard');
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : 'Failed to delete repository');
              },
            });
          }}
          title="Disconnect repository workspace?"
          message={`Are you sure you want to remove "${deleteProjectRequest.name}"? Its target domain mappings and AST index history will also be removed.`}
          confirmText="Disconnect"
          danger
          busy={deleteProject.isPending}
        />
      )}
    </header>
  );
};

export default Navbar;
