import React, { useEffect, useState } from 'react';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

interface GitHubCallbackViewProps {
  onSuccess: () => void;
}

export const GitHubCallbackView: React.FC<GitHubCallbackViewProps> = ({ onSuccess }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state') || undefined;
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (errorParam) {
      setError(errorDescription || 'GitHub authorization was denied or cancelled.');
      return;
    }

    if (!code) {
      setError('No authorization code received from GitHub.');
      return;
    }

    window.history.replaceState({}, document.title, '/');

    api.githubCallback(code, state)
      .then(() => onSuccess())
      .catch((err: Error) => {
        setError(err.message || 'GitHub authentication failed. Please try again.');
      });
  }, [onSuccess]);

  if (error) {
    return (
      <div className="screen-center">
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'var(--critical-bg)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--critical)'
        }}>
          <AlertCircle size={20} strokeWidth={2} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: '320px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            Authentication Failed
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--secondary)', lineHeight: 1.55 }}>{error}</p>
        </div>

        <button className="btn btn-ghost" onClick={() => window.location.replace('/')}>
          <ArrowLeft size={14} />
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <div className="brand-icon">
        <Shield size={16} strokeWidth={2.2} />
      </div>
      <div className="spinner" />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginBottom: '3px' }}>
          Signing you in…
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Exchanging GitHub authorization code
        </p>
      </div>
    </div>
  );
};
