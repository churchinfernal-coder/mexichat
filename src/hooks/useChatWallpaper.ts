import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mc_chat_wallpapers';

export interface WallpaperConfig {
  [scopeId: string]: string; // CSS value (color, gradient, or url())
}

const PRESET_WALLPAPERS = [
  'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(180deg, #0d0d0d 0%, #1a0000 100%)',
  'linear-gradient(180deg, #1a1a1a 0%, #2d1b2e 100%)',
  'linear-gradient(180deg, #0a0a0a 0%, #001a0a 100%)',
  'linear-gradient(180deg, #121212 0%, #1e1e1e 100%)',
  '#0d0d0d',
  '#1a1a2e',
  '#1e0a0a',
];

export function useChatWallpaper() {
  const [wallpapers, setWallpapers] = useState<WallpaperConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wallpapers)); } catch {}
  }, [wallpapers]);

  const setWallpaper = useCallback((scopeId: string, value: string) => {
    setWallpapers(prev => ({ ...prev, [scopeId]: value }));
  }, []);

  const getWallpaper = useCallback((scopeId: string): string | null => {
    return wallpapers[scopeId] || null;
  }, [wallpapers]);

  const removeWallpaper = useCallback((scopeId: string) => {
    setWallpapers(prev => {
      const next = { ...prev };
      delete next[scopeId];
      return next;
    });
  }, []);

  return { wallpapers, setWallpaper, getWallpaper, removeWallpaper, presets: PRESET_WALLPAPERS };
}