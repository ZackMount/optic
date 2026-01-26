"use client";

import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((theme: ResolvedTheme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setResolvedTheme(theme);
  }, []);

  // Initialize
  useEffect(() => {
    const stored = localStorage.getItem('optic-theme-mode') as ThemeMode | null;
    const initialMode = stored || 'system';
    setMode(initialMode);
    
    const theme = initialMode === 'system' ? getSystemTheme() : initialMode;
    applyTheme(theme);
    
    setMounted(true);
  }, [getSystemTheme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') {
        applyTheme(getSystemTheme());
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, mounted, getSystemTheme, applyTheme]);

  // Update theme when mode changes
  useEffect(() => {
    if (!mounted) return;
    
    const theme = mode === 'system' ? getSystemTheme() : mode;
    applyTheme(theme);
    localStorage.setItem('optic-theme-mode', mode);
  }, [mode, mounted, getSystemTheme, applyTheme]);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  const cycleTheme = useCallback(() => {
    setMode(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return { 
    mode, 
    resolvedTheme, 
    setThemeMode, 
    cycleTheme,
    mounted 
  };
}
