import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ----------
// THEME TYPES
// ----------

export type ThemeId = 'platinum' | 'diamond' | 'gold' | 'obsidian';
export type FontFamily = 'inter' | 'roboto' | 'poppins' | 'montserrat' | 'system';

export interface AccentColor {
  name: string;
  primary: string;
  light: string;
  dark: string;
  bg: string;
}

export interface ThemeConfig {
  themeId: ThemeId;
  accentColor: string; // key into ACCENT_COLORS
  fontFamily: FontFamily;
}

// ----------
// ACCENT COLOR PRESETS
// ----------

export const ACCENT_COLORS: Record<string, AccentColor> = {
  blue:    { name: 'Azul',       primary: '#1d4ed8', light: '#3b82f6', dark: '#1e40af', bg: 'rgba(29,78,216,0.08)' },
  sky:     { name: 'Cielo',      primary: '#0284c7', light: '#38bdf8', dark: '#0369a1', bg: 'rgba(2,132,199,0.08)' },
  indigo:  { name: 'Indigo',     primary: '#4f46e5', light: '#818cf8', dark: '#4338ca', bg: 'rgba(79,70,229,0.08)' },
  violet:  { name: 'Violeta',    primary: '#7c3aed', light: '#a78bfa', dark: '#6d28d9', bg: 'rgba(124,58,237,0.08)' },
  emerald: { name: 'Esmeralda',  primary: '#059669', light: '#34d399', dark: '#047857', bg: 'rgba(5,150,105,0.08)' },
  rose:    { name: 'Rosa',       primary: '#e11d48', light: '#fb7185', dark: '#be123c', bg: 'rgba(225,29,72,0.08)' },
  gold:    { name: 'Oro',        primary: '#d97706', light: '#fbbf24', dark: '#b45309', bg: 'rgba(217,119,6,0.08)' },
  black:   { name: 'Negro',      primary: '#18181b', light: '#3f3f46', dark: '#09090b', bg: 'rgba(24,24,27,0.08)' },
};

// ----------
// FONT FAMILIES
// ----------

export const FONT_FAMILIES: Record<FontFamily, { name: string; stack: string }> = {
  inter:      { name: 'Inter',       stack: "'Inter', system-ui, sans-serif" },
  roboto:     { name: 'Roboto',      stack: "'Roboto', system-ui, sans-serif" },
  poppins:    { name: 'Poppins',     stack: "'Poppins', system-ui, sans-serif" },
  montserrat: { name: 'Montserrat',  stack: "'Montserrat', system-ui, sans-serif" },
  system:     { name: 'Sistema',     stack: "system-ui, -apple-system, sans-serif" },
};

// ----------
// STORAGE
// ----------

const STORAGE_KEY = 'mc_theme_config';

function loadConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { themeId: 'platinum', accentColor: 'blue', fontFamily: 'inter' };
}

function saveConfig(config: ThemeConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

// ----------
// CONTEXT
// ----------

interface ThemeContextValue {
  config: ThemeConfig;
  accent: AccentColor;
  fontStack: string;
  setTheme: (id: ThemeId) => void;
  setAccent: (color: string) => void;
  setFont: (font: FontFamily) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ThemeConfig>(loadConfig);

  useEffect(() => { saveConfig(config); }, [config]);

  // Apply CSS variables globally
  useEffect(() => {
    const accent = ACCENT_COLORS[config.accentColor] || ACCENT_COLORS.blue;
    const font = FONT_FAMILIES[config.fontFamily] || FONT_FAMILIES.inter;
    const root = document.documentElement;

    root.style.setProperty('--mc-blue', accent.primary);
    root.style.setProperty('--mc-blue-light', accent.light);
    root.style.setProperty('--mc-blue-dark', accent.dark);
    root.style.setProperty('--mc-accent', accent.primary);
    root.style.setProperty('--mc-accent-bg', accent.bg);
    root.style.setProperty('--mc-font', font.stack);

    root.setAttribute('data-mc-theme', config.themeId);
  }, [config]);

  const setTheme = useCallback((id: ThemeId) => setConfig(prev => ({ ...prev, themeId: id })), []);
  const setAccent = useCallback((color: string) => setConfig(prev => ({ ...prev, accentColor: color })), []);
  const setFont = useCallback((font: FontFamily) => setConfig(prev => ({ ...prev, fontFamily: font })), []);

  const value: ThemeContextValue = {
    config,
    accent: ACCENT_COLORS[config.accentColor] || ACCENT_COLORS.blue,
    fontStack: (FONT_FAMILIES[config.fontFamily] || FONT_FAMILIES.inter).stack,
    setTheme,
    setAccent,
    setFont,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}