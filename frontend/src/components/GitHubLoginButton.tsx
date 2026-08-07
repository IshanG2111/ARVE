import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { GitHubIcon } from './GitHubIcon';

export const GitHubLoginButton: React.FC = () => {
  const { login, loading } = useAuth();
  return (
    <button
      onClick={login}
      className="btn-github"
      disabled={loading}
      id="github-login-btn"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
    >
      <GitHubIcon size={18} />
      Continue with GitHub
    </button>
  );
};
