import React, { useEffect, useState } from 'react';
import heroImg from '@/assets/arve-hero-1920x1080.png';

export const LandingBackground: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const offsetX = (mousePos.x - 0.5) * -12;
  const offsetY = (mousePos.y - 0.5) * -8;
  const glowX = mousePos.x * 100;
  const glowY = mousePos.y * 100;

  return (
    <div
      className="hero-background"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        background: '#07101F',
      }}
    >
      {/* Halftone texture overlay */}
      <div className="halftone" />

      {/* Main dark halftone hero artwork (arve-hero-1920x1080.png) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '68vw',
          height: '68vh',
          maxWidth: '960px',
          maxHeight: '660px',
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}
      >
        <img
          src={heroImg}
          alt=""
          className="hero-art"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'top right',
            filter: 'contrast(1.1) brightness(1.02)',
          }}
        />
      </div>

      {/* Noise grain texture */}
      <div className="noise" />

      {/* Radial vignette for editorial depth and focus */}
      <div
        className="vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at ${glowX}% ${glowY}%, transparent 30%, color-mix(in srgb, #07101F 35%, transparent) 60%, rgba(7, 16, 31, 0.92) 100%)`,
        }}
      />

      {/* Top-left content readability gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(7, 16, 31, 0.95) 0%, rgba(7, 16, 31, 0.6) 45%, transparent 75%)',
        }}
      />

      {/* Bottom fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(to top, #07101F 0%, transparent 100%)',
        }}
      />
    </div>
  );
};

export default LandingBackground;
