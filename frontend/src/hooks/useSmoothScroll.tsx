import React, { useEffect, useRef } from 'react';
import Lenis from 'lenis';

export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      prevent: (node) => {
        return (
          node.classList?.contains('list-scroll') ||
          node.classList?.contains('modal') ||
          node.classList?.contains('modal-overlay') ||
          node.closest?.('[data-lenis-prevent]') !== null ||
          node.closest?.('.list-scroll') !== null ||
          node.closest?.('.modal') !== null ||
          node.closest?.('.modal-overlay') !== null ||
          node.closest?.('select') !== null ||
          node.closest?.('textarea') !== null
        );
      },
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}

export const SmoothScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useSmoothScroll();
  return <>{children}</>;
};
