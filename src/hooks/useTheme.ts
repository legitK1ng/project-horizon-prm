import { useState, useEffect, useCallback } from 'react';
import { APP_CONFIG } from '@/constants';

export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(APP_CONFIG.localStorage.themeKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const newMode = !prev;

      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(APP_CONFIG.localStorage.themeKey, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(APP_CONFIG.localStorage.themeKey, 'light');
      }

      return newMode;
    });
  }, []);

  return { isDarkMode, toggleTheme };
};
