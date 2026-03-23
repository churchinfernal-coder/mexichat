/**
 * MEXICHAT — PWA Install Hook
 *
 * Handles the "beforeinstallprompt" event across all platforms:
 * - Chrome/Edge/Samsung: Native install prompt
 * - iOS Safari: Manual "Add to Home Screen" instructions
 * - Firefox: Manual instructions
 *
 * Tracks install state in localStorage to not annoy users.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  install: () => Promise<boolean>;
  dismiss: () => void;
  dismissed: boolean;
}

const DISMISS_KEY = 'mc-pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePWAInstall(): PWAInstallState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Detect platform
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  const platform: 'ios' | 'android' | 'desktop' | 'unknown' =
    isIOS ? 'ios' : isAndroid ? 'android' : /Windows|Mac|Linux/.test(ua) ? 'desktop' : 'unknown';

  // Check if previously dismissed
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) {
        setDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  // Check if already installed
  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check via getInstalledRelatedApps (Chrome 80+)
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
        if (apps.length > 0) setIsInstalled(true);
      }).catch(() => {});
    }
  }, [isStandalone]);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    // Chrome/Edge/Samsung — native prompt
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const choice = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        return true;
      }
      return false;
    }

    // iOS — can't programmatically install, show instructions
    // (handled in UI component)
    return false;
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  return {
    canInstall: canInstall || (isIOS && !isStandalone && !isInstalled),
    isInstalled,
    isIOS,
    isAndroid,
    isStandalone,
    platform,
    install,
    dismiss,
    dismissed,
  };
}