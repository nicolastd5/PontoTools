import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, Theme } from '../theme';

interface ThemeContextValue {
  isDark: boolean;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('theme').then((val) => {
      if (!mounted) return;
      if (val === 'light') setIsDark(false);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const theme = isDark ? darkTheme : lightTheme;

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('theme', next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
