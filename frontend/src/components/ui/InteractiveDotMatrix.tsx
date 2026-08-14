import React, { useEffect, useRef } from 'react';

interface InteractiveDotMatrixProps {
  dotSize?: number;
  gap?: number;
  hoverRadius?: number;
}

export const InteractiveDotMatrix: React.FC<InteractiveDotMatrixProps> = ({
  dotSize = 1.6,
  gap = 24,
  hoverRadius = 130,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      // Smooth lerp mouse position
      mouseX += (targetMouseX - mouseX) * 0.12;
      mouseY += (targetMouseY - mouseY) * 0.12;

      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains('dark');
      const baseAlpha = isDark ? 0.08 : 0.06;
      const baseColor = isDark ? '237, 237, 240' : '18, 19, 22';
      const highlightColor = isDark ? '99, 102, 241' : '79, 91, 213';

      const cols = Math.ceil(width / gap);
      const rows = Math.ceil(height / gap);

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const x = i * gap;
          const y = j * gap;

          const dx = mouseX - x;
          const dy = mouseY - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let currentDotSize = dotSize;
          let alpha = baseAlpha;
          let color = baseColor;

          if (dist < hoverRadius) {
            const factor = 1 - dist / hoverRadius;
            // Smooth ease out curve
            const easeFactor = factor * factor;
            alpha = baseAlpha + easeFactor * 0.45;
            currentDotSize = dotSize + easeFactor * 1.5;
            color = highlightColor;
          }

          ctx.fillStyle = `rgba(${color}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotSize, gap, hoverRadius]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
