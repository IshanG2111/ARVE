import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
        {/* Brand */}
        <button
          className="brand-name"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => navigate(user ? '/dashboard' : '/')}
          id="brand-link"
        >
          <div className="brand-icon">A</div>
          ARVE
          <span className="brand-version">v1.0</span>
        </button>

        {/* Navigation Links for Public View */}
        {!user && (
          <div className="nav-links">
            <a href="#workbench-section" className="nav-link">Workflow</a>
            <a href="#features-section" className="nav-link">Capabilities</a>
            <a href="#trust-section" className="nav-link">Security &amp; OAuth</a>
          </div>
        )}

        {/* Authenticated User Navigation & Controls */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className={`btn btn-ghost ${location.pathname === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
              id="nav-dashboard-link"
              style={{ fontSize: '13px', color: location.pathname === '/dashboard' ? 'var(--primary)' : 'var(--muted)' }}
            >
              Dashboard
            </button>

            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />

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

            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={handleLogout}
              id="logout-btn"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};

