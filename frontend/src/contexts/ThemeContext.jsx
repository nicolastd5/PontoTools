import { createContext, useContext, useState, useEffect } from 'react';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext(null);

function buildTheme(base) {
  return {
    ...base,
    // aliases de compatibilidade com nomes antigos usados em páginas de admin
    textPrimary:   base.ink,
    textSecondary: base.muted,
    textMuted:     base.subtle,
    accent:        base.primary,
    border:        base.line,
    elevated:      base.surface,
    success:       base.ok,
    warning:       base.warn,
  };
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );
  const theme = isDark ? buildTheme(darkTheme) : buildTheme(lightTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.style.background = theme.bg;
    document.body.style.color      = theme.ink;
  }, [isDark, theme.bg, theme.ink]);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
