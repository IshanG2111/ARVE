import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { LoadingAnimation } from '../components/ui/LoadingAnimation';
import { ConfirmModal } from '../components/ConfirmModal';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await login();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Firebase sign-in failed. Please try again.');
    }
  };

  return (
    <div className="landing-page">
      <HalftoneBackground interactive={true} showHero={true} />

      <div className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-title anim-fade-up">
            <span className="hero-word">DETECT.</span>
            <span className="hero-word">REMEDIATE.</span>
            <span className="hero-word">VERIFY.</span>
          </h1>

          <p className="hero-subtitle anim-fade-up" style={{ animationDelay: '100ms' }}>
            Adaptive security engine for GitHub repositories.
            <br />
            Map attack paths, auto-generate patches,
            <br />
            verify deterministically.
          </p>

          <button
            className="hero-cta anim-fade-up"
            style={{ animationDelay: '200ms' }}
            onClick={handleLogin}
            disabled={loading}
            id="github-signin-btn"
          >
            {loading ? <LoadingAnimation fullScreen={false} size={20} /> : 'EXPLORE ARVE →'}
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="landing-bottom anim-fade-up" style={{ animationDelay: '300ms' }}>
        <span className="landing-version">ARVE v1.0</span>
        <span className="landing-tagline">
          BUILT FOR DEVELOPERS.
          <strong> SECURING WHAT MATTERS.</strong>
        </span>
      </div>

      {loginError && (
        <ConfirmModal
          title="Sign-in failed"
          message={loginError}
          confirmText="Close"
          cancelText=""
          onConfirm={() => setLoginError(null)}
          onCancel={() => setLoginError(null)}
        />
      )}
    </div>
  );
};
