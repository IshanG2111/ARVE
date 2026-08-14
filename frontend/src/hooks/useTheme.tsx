import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light') return 'light';
      return 'dark';
    }
    return 'dark';
  });

  const transitionTimerRef = useRef<number | null>(null);

  const applyTheme = (t: Theme, withTransition: boolean = false) => {
    if (typeof document !== 'undefined') {
      if (withTransition) {
        document.documentElement.classList.add('theme-transition');
        if (transitionTimerRef.current) {
          window.clearTimeout(transitionTimerRef.current);
        }
        transitionTimerRef.current = window.setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
          transitionTimerRef.current = null;
        }, 340);
      }

      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', t);
    }
  };

  useEffect(() => {
    applyTheme(theme, false);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      return next;
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme, true);
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    return {
      theme: (isDark ? 'dark' : 'light') as Theme,
      isDark,
      toggleTheme: () => {
        if (typeof document !== 'undefined') {
          const next = !document.documentElement.classList.contains('dark');
          document.documentElement.classList.add('theme-transition');
          if (next) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
          }
          setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
          }, 340);
        }
      },
      setTheme: (t: Theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('theme-transition');
          if (t === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          localStorage.setItem('theme', t);
          setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
          }, 340);
        }
      },
    };
  }
  return context;
};

export default useTheme;
