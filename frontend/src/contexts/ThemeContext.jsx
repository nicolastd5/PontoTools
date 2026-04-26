import { createContext, useContext, useState, useEffect } from 'react';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    // Limpa overrides inline que possam sobrepor as CSS vars
    document.body.style.background = '';
    document.body.style.color = '';
  }, [isDark]);

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
