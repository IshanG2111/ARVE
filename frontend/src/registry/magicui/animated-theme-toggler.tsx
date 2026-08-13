import React, { useEffect, useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AnimatedThemeTogglerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'circle' | 'square';
  className?: string;
}

export function AnimatedThemeToggler({ variant = 'circle', className = '', ...props }: AnimatedThemeTogglerProps) {
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const isDarkTheme = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const nextDark = !isDark;

    const changeThemeState = () => {
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      }
    };

    const doc = document as unknown as { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition) {
      changeThemeState();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        changeThemeState();
      });
    });

    transition.ready.then(() => {
      let clipPathStart: string, clipPathEnd: string;

      if (variant === 'square') {
        const top = y;
        const left = x;
        const bottom = window.innerHeight - y;
        const right = window.innerWidth - x;
        clipPathStart = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
        clipPathEnd = `inset(0px 0px 0px 0px)`;
      } else {
        const maxRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        clipPathStart = `circle(0px at ${x}px ${y}px)`;
        clipPathEnd = `circle(${maxRadius}px at ${x}px ${y}px)`;
      }

      document.documentElement.animate(
        {
          clipPath: [clipPathStart, clipPathEnd],
        },
        {
          duration: 500,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }, [isDark, variant]);

  const sunVariants = {
    initial: { rotate: -90, scale: 0, opacity: 0 },
    animate: { rotate: 0, scale: 1, opacity: 1 },
    exit: { rotate: 90, scale: 0, opacity: 0 },
  };

  const moonVariants = {
    initial: { rotate: 90, scale: 0, opacity: 0 },
    animate: { rotate: 0, scale: 1, opacity: 1 },
    exit: { rotate: -90, scale: 0, opacity: 0 },
  };

  const buttonShapeClass = variant === 'square' ? 'rounded-md' : 'rounded-full';

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={`relative flex h-10 w-10 cursor-pointer items-center justify-center border border-slate-200 bg-white/80 text-slate-800 backdrop-blur-md transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-900 ${buttonShapeClass} ${className}`}
      aria-label="Toggle theme"
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? 'dark-icon' : 'light-icon'}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <motion.div variants={moonVariants} className="flex items-center justify-center">
              <Moon className="h-[1.2rem] w-[1.2rem] text-slate-200 fill-slate-200" />
            </motion.div>
          ) : (
            <motion.div variants={sunVariants} className="flex items-center justify-center">
              <Sun className="h-[1.2rem] w-[1.2rem] text-amber-500 fill-amber-500" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

export function AnimatedThemeTogglerDemo() {
  return (
    <div className="flex justify-center p-6">
      <AnimatedThemeToggler />
    </div>
  );
}
