import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { GitHubIcon } from '../components/GitHubIcon';
import { BlurText } from '../components/ui/BlurText';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from '../components/ConfirmModal';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { ArrowRight, LayoutDashboard } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login, logout, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Orchestrate the showcase reveal sequence
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowIntro(false);
      setContentVisible(true);
    }, 1200);

    return () => clearTimeout(timer1);
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await login();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed. Please check GitHub OAuth configuration.');
    }
  };

  const displayName = user?.username || user?.github_login || user?.email?.split('@')[0] || 'User';

  return (
    <div
      className="landing-page"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <HalftoneBackground interactive={true} showHero={true} />

      {/* ── Phase 1: Center Showcase Reveal Overlay ── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro-showcase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0.6 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 82, 255, 0.18), transparent 70%)',
                filter: 'blur(30px)',
              }}
            />

            <motion.div
              initial={{ scale: 0.88, opacity: 0, letterSpacing: '0.2em' }}
              animate={{ scale: 1, opacity: 1, letterSpacing: '0.08em' }}
              exit={{ y: -30, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(44px, 8vw, 72px)',
                  fontWeight: 900,
                  fontFamily: 'var(--font-logo)',
                  color: 'var(--primary)',
                  lineHeight: 1,
                }}
              >
                ARVE
              </span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.35, type: 'spring', stiffness: 400 }}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--accent, #0052FF)',
                  boxShadow: '0 0 16px rgba(0, 82, 255, 0.9)',
                  display: 'inline-block',
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-code)',
                color: 'var(--muted)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '12px',
              }}
            >
              Deterministic Remediation Platform
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={contentVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 36px',
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent, #0052FF)',
              boxShadow: '0 0 10px rgba(0, 82, 255, 0.8)',
              display: 'inline-block',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user && (
            <button
              onClick={() => navigate('/overview')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '11.5px',
                fontWeight: 650,
                fontFamily: 'var(--font-code)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <LayoutDashboard size={13} color="var(--accent)" />
              <span>Workspace</span>
            </button>
          )}
          <AnimatedThemeToggler variant="circle" />
        </div>
      </motion.div>

      <div className="landing-hero" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div className="hero-content" style={{ maxWidth: '680px', paddingLeft: '36px' }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={contentVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1
              className="hero-title"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                color: 'var(--primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 850,
                fontSize: 'clamp(44px, 7.5vw, 86px)',
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
                margin: '0 0 18px 0',
                transition: 'color 320ms var(--ease-smooth)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <BlurText
                  text="DETECT"
                  delay={36}
                  initialDelay={0.05}
                  trigger={contentVisible}
                  animateBy="letters"
                  direction="top"
                  stepDuration={0.3}
                  className="hero-word"
                  style={{ color: 'var(--primary)' }}
                />
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={contentVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  style={{
                    color: 'var(--accent, #0052FF)',
                    fontFamily: 'var(--font-serif)',
                    marginLeft: '2px',
                    textShadow: '0 0 24px rgba(0, 82, 255, 0.5)',
                  }}
                >
                  .
                </motion.span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <BlurText
                  text="REMEDIATE"
                  delay={32}
                  initialDelay={0.35}
                  trigger={contentVisible}
                  animateBy="letters"
                  direction="top"
                  stepDuration={0.3}
                  className="hero-word"
                  style={{ color: 'var(--primary)' }}
                />
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={contentVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.7 }}
                  style={{
                    color: 'var(--accent, #0052FF)',
                    fontFamily: 'var(--font-serif)',
                    marginLeft: '2px',
                    textShadow: '0 0 24px rgba(0, 82, 255, 0.5)',
                  }}
                >
                  .
                </motion.span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <BlurText
                  text="VERIFY"
                  delay={36}
                  initialDelay={0.7}
                  trigger={contentVisible}
                  animateBy="letters"
                  direction="top"
                  stepDuration={0.3}
                  className="hero-word"
                  style={{ color: 'var(--primary)' }}
                />
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={contentVisible ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.98 }}
                  style={{
                    color: 'var(--accent, #0052FF)',
                    fontFamily: 'var(--font-serif)',
                    marginLeft: '2px',
                    textShadow: '0 0 24px rgba(0, 82, 255, 0.5)',
                  }}
                >
                  .
                </motion.span>
              </div>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={contentVisible ? { opacity: 1, width: '48px' } : {}}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '2px',
              background: 'linear-gradient(90deg, var(--accent, #0052FF), var(--accent-light, #60A5FA))',
              margin: '22px 0 20px 0',
              borderRadius: '999px',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={contentVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              color: 'var(--secondary)',
              fontSize: '15px',
              lineHeight: 1.7,
              maxWidth: '440px',
              marginBottom: '34px',
              fontFamily: 'var(--font-ui)',
              letterSpacing: '-0.01em',
              transition: 'color 320ms var(--ease-smooth)',
            }}
          >
            Adaptive security intelligence for GitHub repositories.
            Map vulnerability attack paths, generate automated patches,
            and verify code health deterministically.
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={contentVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start' }}>
                <button
                  className="hero-cta"
                  onClick={() => navigate('/overview')}
                  id="enter-workspace-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '13px 28px',
                    fontSize: '12.5px',
                    fontWeight: 650,
                    fontFamily: 'var(--font-code)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                    background: 'var(--accent, #0052FF)',
                    border: '1px solid var(--accent, #0052FF)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 0 28px 2px rgba(0, 82, 255, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 0 34px 4px rgba(0, 82, 255, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 28px 2px rgba(0, 82, 255, 0.35)';
                  }}
                >
                  <LayoutDashboard size={15} />
                  <span>ENTER WORKSPACE</span>
                  <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11.5px',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--muted)',
                  }}
                >
                  <span>
                    Signed in as <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{displayName}</strong>
                  </span>
                  <span>•</span>
                  <button
                    onClick={logout}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="hero-cta"
                onClick={handleLogin}
                disabled={loading}
                id="github-signin-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '13px 28px',
                  fontSize: '12.5px',
                  fontWeight: 650,
                  fontFamily: 'var(--font-code)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-subtle)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.borderColor = 'var(--accent, #0052FF)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 0 28px 2px rgba(0, 82, 255, 0.25)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-subtle)';
                  }
                }}
              >
                <GitHubIcon size={16} />
                <span>SIGN IN WITH GITHUB</span>
                <ArrowRight size={14} style={{ marginLeft: '4px', color: 'var(--accent, #0052FF)' }} />
              </button>
            )}
          </motion.div>
        </div>
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

export default LandingPage;
