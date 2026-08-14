import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyThemeDirect(t: Theme) {
  if (typeof window === 'undefined') return;
  const root = window.document.documentElement;
  root.classList.add('theme-transition');
  if (t === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', t);
  setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 380);
}

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

  const applyThemeDOM = (t: Theme, withTransition: boolean = false) => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;

    if (withTransition) {
      root.classList.add('theme-transition');
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-transition');
        transitionTimerRef.current = null;
      }, 380);
    }

    if (t === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', t);
  };

  useEffect(() => {
    applyThemeDOM(theme, false);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';

    if (typeof window !== 'undefined' && 'startViewTransition' in window.document) {
      (window.document as any).startViewTransition(() => {
        setThemeState(next);
        applyThemeDOM(next, true);
      });
    } else {
      setThemeState(next);
      applyThemeDOM(next, true);
    }
  };

  const setTheme = (newTheme: Theme) => {
    if (typeof window !== 'undefined' && 'startViewTransition' in window.document) {
      (window.document as any).startViewTransition(() => {
        setThemeState(newTheme);
        applyThemeDOM(newTheme, true);
      });
    } else {
      setThemeState(newTheme);
      applyThemeDOM(newTheme, true);
    }
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
    const isDark = typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark');
    return {
      theme: (isDark ? 'dark' : 'light') as Theme,
      isDark,
      toggleTheme: () => {
        if (typeof window !== 'undefined') {
          const next = !window.document.documentElement.classList.contains('dark');
          const nextTheme: Theme = next ? 'dark' : 'light';
          if ('startViewTransition' in window.document) {
            (window.document as any).startViewTransition(() => {
              applyThemeDirect(nextTheme);
            });
          } else {
            applyThemeDirect(nextTheme);
          }
        }
      },
      setTheme: (t: Theme) => {
        if (typeof window !== 'undefined') {
          if ('startViewTransition' in window.document) {
            (window.document as any).startViewTransition(() => {
              applyThemeDirect(t);
            });
          } else {
            applyThemeDirect(t);
          }
        }
      },
    };
  }
  return context;
};

export default useTheme;
