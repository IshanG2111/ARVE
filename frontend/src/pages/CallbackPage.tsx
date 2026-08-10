import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { githubCallback } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('No authorization code received from GitHub.');
      return;
    }

    githubCallback(code)
      .then(async () => {
        await refetch();
        navigate('/dashboard');
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [navigate, refetch]);

  if (error) {
    return (
      <div className="screen-center">
        <div className="card" style={{ padding: '32px', maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px', color: 'var(--primary)' }}>
            Authentication failed
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')} id="back-to-home">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <div className="spinner" style={{ width: '24px', height: '24px' }} />
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Completing sign-in…</p>
    </div>
  );
};
