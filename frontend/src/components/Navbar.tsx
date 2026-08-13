import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import type { User } from '@/types';

interface NavbarProps {
  user: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    navigate('/');
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0];

  return (
    <header className="navbar">
      <div className="page-container navbar-inner">
        {/* Brand */}
        <button
          className="brand-name"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate(user ? '/dashboard' : '/')}
          id="brand-link"
        >
          <img
            src="/assets/arve-mark.svg"
            alt="ARVE"
            style={{ height: '24px', filter: 'var(--brand-filter)', opacity: 0.9 }}
          />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Public Navigation Links */}
          {!user && (
            <div className="nav-links">
              <a
                href="https://github.com/IshanG2111/ARVE"
                target="_blank"
                rel="noreferrer"
                className="nav-link"
              >
                DOCS
              </a>
              <a
                href="https://github.com/IshanG2111/ARVE"
                target="_blank"
                rel="noreferrer"
                className="nav-link"
              >
                GITHUB
              </a>
            </div>
          )}

          {/* Authenticated User Navigation */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                className="nav-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: location.pathname === '/dashboard' ? 'var(--primary)' : 'var(--muted)',
                }}
                onClick={() => navigate('/dashboard')}
                id="nav-dashboard-link"
              >
                DASHBOARD
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="user-avatar">
                  {user.avatar_url || user.github_avatar ? (
                    <img
                      src={user.avatar_url || user.github_avatar}
                      alt={displayName}
                    />
                  ) : (
                    (displayName || 'U')[0].toUpperCase()
                  )}
                </div>
              </div>

              <button
                className="nav-link"
                style={{ background: 'none', border: 'none', color: 'var(--dim)' }}
                onClick={handleLogout}
                id="logout-btn"
              >
                SIGN OUT
              </button>
            </div>
          )}

          {/* Animated Theme Toggler */}
          <AnimatedThemeToggler variant="circle" />
        </div>
      </div>
    </header>
  );
};
