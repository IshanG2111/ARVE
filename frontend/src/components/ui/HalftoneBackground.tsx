import React, { useEffect, useRef, useState } from 'react';

interface HalftoneBackgroundProps {
  interactive?: boolean;
  showHero?: boolean;
}

export const HalftoneBackground: React.FC<HalftoneBackgroundProps> = ({
  interactive = true,
  showHero = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // Trigger smooth fade-in after mounting
    const timer = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = {
      x: width * 0.5,
      y: height * 0.3,
      targetX: width * 0.5,
      targetY: height * 0.3,
      normX: 0,
      normY: 0,
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;

      // Normalized coordinates (-1 to 1) for clean hero image parallax
      mouse.normX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.normY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('resize', handleResize);
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Simple subtle white dot matrix grid settings
    const spacing = 24;
    const minRadius = 1.0;
    const maxRadius = 2.2;
    const hoverRadius = 140;

    let time = 0;

    const render = () => {
      time += 0.015;

      // Ultra-smooth lerp inertia for background hero image move
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      setParallax((prev) => ({
        x: prev.x + (mouse.normX - prev.x) * 0.04,
        y: prev.y + (mouse.normY - prev.y) * 0.04,
      }));

      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;

          // Distance from smooth mouse position
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Subtle ambient pulse for idle dots
          const pulse = Math.sin(time + (x * 0.008 + y * 0.008)) * 0.5 + 0.5;

          let r = minRadius;
          let alpha = 0.05 + pulse * 0.03;

          if (dist < hoverRadius && interactive) {
            const factor = 1 - dist / hoverRadius;
            const ease = factor * factor * (3 - 2 * factor); // smoothstep curve
            r = minRadius + (maxRadius - minRadius) * ease;
            alpha = 0.08 + 0.42 * ease; // Subtle white highlight
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [interactive]);

  return (
    <div
      className="hero-background"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 1s cubic-bezier(0.23, 1, 0.32, 1)',
      }}
    >
      {/* Background Hero Artwork — Only this image moves with clean lerped parallax */}
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
            transform: `translate3d(${-parallax.x * 16}px, ${-parallax.y * 10}px, 0) scale(1.04)`,
            transition: 'transform 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
            opacity: 0.85,
          }}
        />
      )}

      {/* Subtle White Dot Matrix Canvas Overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
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
          opacity: 0.25,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Ambient gradient vignette */}
      <div
        className="vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 30%, transparent 0%, rgba(8, 11, 18, 0.4) 60%, rgba(8, 11, 18, 0.9) 100%)',
        }}
      />

      {/* Top fade for clean text contrast */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(8, 11, 18, 0.75) 0%, rgba(8, 11, 18, 0.35) 45%, transparent 75%)',
        }}
      />

      {/* Bottom fade */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '140px',
          background: 'linear-gradient(to top, rgba(8, 11, 18, 1) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};
