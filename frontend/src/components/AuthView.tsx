import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle } from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';
import { api, type User } from '../services/api';

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGitHubSignIn = async (isMock: boolean = false) => {
    setError(null);
    setLoading(true);
    try {
      if (isMock) {
        await api.githubCallback('mock_code', true);
        const currentUser = await api.me();
        onAuthSuccess(currentUser);
      } else {
        // Redirect to GitHub OAuth authorize endpoint
        const res = await fetch('http://localhost:8000/api/github/auth-url');
        const data = await res.json();
        if (data.is_configured) {
          window.location.href = data.auth_url;
        } else {
          // If no GitHub app secret configured in local env, use instant demo login
          await api.githubCallback('mock_code', true);
          const currentUser = await api.me();
          onAuthSuccess(currentUser);
        }
      }
    } catch (err: any) {
      setError(err.message || 'GitHub OAuth failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await api.login(email, password);
        const currentUser = await api.me();
        onAuthSuccess(currentUser);
      } else {
        await api.register(email, password, fullName);
        await api.login(email, password);
        const currentUser = await api.me();
        onAuthSuccess(currentUser);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '36px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '160px',
          height: '160px',
          background: 'rgba(0, 240, 255, 0.15)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(99,102,241,0.2) 100%)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            marginBottom: '16px',
            color: 'var(--primary)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>
            {isLogin ? 'Welcome to ARVE Security' : 'Create ARVE Account'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Adaptive Remediation & Verification Engine
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#FDA4AF',
            fontSize: '13px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Primary GitHub OAuth Sign-in Button */}
        <button
          type="button"
          onClick={() => handleGitHubSignIn(false)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            background: '#24292F',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease',
            marginBottom: '20px'
          }}
        >
          <GitHubIcon size={20} />
          Sign in with GitHub
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or continue with email
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '40px' }}
                  placeholder="Alex Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
              <input
                type="email"
                required
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="dev@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
              <input
                type="password"
                required
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
          >
            {loading ? 'Processing...' : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
};
