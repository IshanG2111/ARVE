import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { GitHubIcon } from '../components/GitHubIcon';
import { BlurText } from '../components/ui/BlurText';
import { motion } from 'framer-motion';
import { ConfirmModal } from '../components/ConfirmModal';
import { ArrowRight } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await login();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed. Please check GitHub OAuth configuration.');
    }
  };

  return (
    <div className="landing-page" style={{ position: 'relative' }}>
      <HalftoneBackground interactive={true} showHero={true} />

      <div className="landing-hero">
        <div className="hero-content">
          {/* Main Iconic Headline Revealed with React Bits BlurText */}
          <h1
            className="hero-title"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              color: 'var(--primary)',
              transition: 'color 320ms var(--ease-smooth)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <BlurText
                text="DETECT"
                delay={40}
                animateBy="letters"
                direction="top"
                stepDuration={0.3}
                className="hero-word"
                style={{ color: 'var(--primary)' }}
              />
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-serif)', transition: 'color 320ms var(--ease-smooth)' }}>.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <BlurText
                text="REMEDIATE"
                delay={40}
                animateBy="letters"
                direction="top"
                stepDuration={0.3}
                className="hero-word"
                style={{ color: 'var(--primary)' }}
              />
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-serif)', transition: 'color 320ms var(--ease-smooth)' }}>.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <BlurText
                text="VERIFY"
                delay={40}
                animateBy="letters"
                direction="top"
                stepDuration={0.3}
                className="hero-word"
                style={{ color: 'var(--primary)' }}
              />
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-serif)', transition: 'color 320ms var(--ease-smooth)' }}>.</span>
            </div>
          </h1>

          {/* Thin Champagne Gold Divider */}
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={mounted ? { opacity: 0.9, width: '32px' } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            style={{ height: '1.5px', background: 'var(--gold)', margin: '20px 0 16px 0', transition: 'background 320ms var(--ease-smooth)' }}
          />

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.45 }}
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13.5px',
              lineHeight: 1.65,
              maxWidth: '380px',
              marginBottom: '32px',
              fontFamily: 'var(--font-ui)',
              transition: 'color 320ms var(--ease-smooth)',
            }}
          >
            Adaptive security engine for GitHub repositories.<br />
            Map attack paths, auto-generate patches,<br />
            verify deterministically.
          </motion.div>

          {/* Single Action: Sign In With GitHub with Champagne Gold Rim & Aura */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              className="hero-cta"
              onClick={handleLogin}
              disabled={loading}
              id="github-signin-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 26px',
                fontSize: '12.5px',
                fontWeight: 600,
                fontFamily: 'var(--font-code)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                background: 'var(--surface)',
                border: '1px solid var(--border-gold)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-subtle)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = 'var(--gold)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 0 24px 2px rgba(201, 154, 82, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = 'var(--border-gold)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-subtle)';
                }
              }}
            >
              <GitHubIcon size={15} />
              <span>SIGN IN WITH GITHUB</span>
              <ArrowRight size={14} style={{ marginLeft: '2px', color: 'var(--gold)' }} />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Bottom Bar */}
      <motion.div
        className="landing-bottom"
        initial={{ opacity: 0 }}
        animate={mounted ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.7 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 32px',
          fontFamily: 'var(--font-code)',
          fontSize: '11px',
          letterSpacing: '0.04em',
          borderTop: '1px solid var(--border)',
          transition: 'border-color 320ms var(--ease-smooth)',
        }}
      >
        <span className="landing-version" style={{ color: 'var(--text-muted)', transition: 'color 320ms var(--ease-smooth)' }}>
          ARVE v1.0 • DETERMINISTIC SECURITY ENGINE
        </span>
        <span className="landing-tagline" style={{ color: 'var(--text-muted)', transition: 'color 320ms var(--ease-smooth)' }}>
          BUILT FOR DEVELOPERS.{' '}
          <strong style={{ color: 'var(--gold)', fontWeight: 600, transition: 'color 320ms var(--ease-smooth)' }}>SECURING WHAT MATTERS.</strong>
        </span>
      </motion.div>

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
