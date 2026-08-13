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

      mouse.normX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.normY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('resize', handleResize);
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    const spacing = 36;
    const minRadius = 0.75;
    const maxRadius = 1.8;
    const hoverRadius = 160;

    let time = 0;

    const render = () => {
      time += 0.01;

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      setParallax((prev) => ({
        x: prev.x + (mouse.normX - prev.x) * 0.03,
        y: prev.y + (mouse.normY - prev.y) * 0.03,
      }));

      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      // 1. Draw architectural grid lines
      const isDark = document.documentElement.classList.contains('dark');
      ctx.strokeStyle = isDark ? 'rgba(210, 206, 196, 0.015)' : 'rgba(0, 0, 0, 0.025)';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x = i * spacing;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let j = 0; j < rows; j++) {
        const y = j * spacing;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Draw subtle grid intersection nodes
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;

          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const wave = Math.sin(time + x * 0.004 + y * 0.004) * 0.5 + 0.5;

          let r = minRadius;
          let alpha = 0.04 + wave * 0.03;
          let isHovered = false;

          if (dist < hoverRadius && interactive) {
            const factor = 1 - dist / hoverRadius;
            const ease = factor * factor * (3 - 2 * factor);
            r = minRadius + (maxRadius - minRadius) * ease;
            alpha = 0.08 + 0.32 * ease;
            isHovered = true;
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);

          if (isHovered) {
            ctx.fillStyle = isDark ? `rgba(126, 139, 245, ${alpha})` : `rgba(91, 103, 234, ${alpha})`;
          } else {
            ctx.fillStyle = isDark ? `rgba(210, 206, 196, ${alpha})` : `rgba(31, 41, 55, ${alpha * 0.6})`;
          }

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
      {/* Background Hero Artwork */}
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
            transform: `translate3d(${-parallax.x * 12}px, ${-parallax.y * 8}px, 0) scale(1.03)`,
            transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            opacity: 0.85,
          }}
        />
      )}

      {/* Grid Pattern Canvas Overlay */}
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
          opacity: 0.12,
          mixBlendMode: 'overlay',
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
          background: 'linear-gradient(to top, var(--bg) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};
