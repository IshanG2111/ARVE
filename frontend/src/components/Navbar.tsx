import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate('/');
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0];

  return (
    <header className="navbar">
      <div className="page-container navbar-inner">

        {/* Brand — text only, no icon */}
        <button
          className="brand-name"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate(user ? '/dashboard' : '/')}
          id="brand-link"
        >
          ARVE
          <span className="brand-version">Sprint 1</span>
        </button>

        {/* User controls */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <span className="nav-user-name">{displayName}</span>
            </div>

            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={handleLogout}
              id="logout-btn"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
