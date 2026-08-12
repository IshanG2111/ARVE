import React, { useEffect, useRef, useState } from 'react';

interface HalftoneBackgroundProps {
  interactive?: boolean;
  showHero?: boolean;
}

export const HalftoneBackground: React.FC<HalftoneBackgroundProps> = ({
  interactive = true,
  showHero = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive]);

  // Subtle parallax offset based on mouse position
  const offsetX = (mousePos.x - 0.5) * -20;
  const offsetY = (mousePos.y - 0.5) * -12;
  const glowX = mousePos.x * 100;
  const glowY = mousePos.y * 100;

  return (
    <div
      ref={containerRef}
      className="hero-background"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {/* Hero artwork with parallax */}
      {showHero && (
        <img
          src="/assets/arve-hero-1920x1080.png"
          alt=""
          className="hero-art"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '70% 60%',
            transform: `translate(${offsetX}px, ${offsetY}px) scale(1.05)`,
            transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
            opacity: 0.9,
          }}
        />
      )}

      {/* Halftone dot pattern overlay */}
      <div
        className="halftone"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/assets/halftone.svg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '120px 120px',
          opacity: 0.5,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="noise"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/assets/noise.svg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.35,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Radial vignette */}
      <div
        className="vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at ${glowX}% ${glowY}%, transparent 0%, rgba(8, 11, 18, 0.3) 50%, rgba(8, 11, 18, 0.85) 100%)`,
          transition: 'background 0.8s ease',
        }}
      />

      {/* Top-left fade for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(8, 11, 18, 0.7) 0%, rgba(8, 11, 18, 0.3) 35%, transparent 65%)',
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
          background: 'linear-gradient(to top, rgba(8, 11, 18, 1) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};
