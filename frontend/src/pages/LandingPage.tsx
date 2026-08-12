import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { HalftoneBackground } from '../components/ui/HalftoneBackground';
import { motion } from 'framer-motion';

export const LandingPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="landing-page">
      <HalftoneBackground interactive={true} showHero={true} />

      <div className="landing-hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 40 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="hero-word">DETECT.</span>
            <span className="hero-word">REMEDIATE.</span>
            <span className="hero-word">VERIFY.</span>
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.45 }}
          >
            Adaptive security engine for GitHub repositories.
            <br />
            Map attack paths, auto-generate patches,
            <br />
            verify deterministically.
          </motion.p>

          <motion.button
            className="hero-cta"
            onClick={login}
            disabled={loading}
            id="github-signin-btn"
            initial={{ opacity: 0, y: 16 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.65 }}
          >
            {loading ? 'CONNECTING…' : 'EXPLORE ARVE →'}
          </motion.button>
        </motion.div>
      </div>

      {/* Bottom bar */}
      <motion.div
        className="landing-bottom"
        initial={{ opacity: 0 }}
        animate={mounted ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.9 }}
      >
        <span className="landing-version">ARVE v1.0</span>
        <span className="landing-tagline">
          BUILT FOR DEVELOPERS.
          <strong> SECURING WHAT MATTERS.</strong>
        </span>
      </motion.div>
    </div>
  );
};
