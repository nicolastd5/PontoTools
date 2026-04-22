import { createContext, useContext, useState, useEffect } from 'react';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color = theme.textPrimary;
  }, [theme.bg, theme.textPrimary]);

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
