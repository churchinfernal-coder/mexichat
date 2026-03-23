/**
 * App Lifecycle Service
 *
 * Handles Capacitor app state changes for:
 * - Background/foreground transitions
 * - Keeping call audio alive when backgrounded
 * - Re-syncing data when app returns to foreground
 * - Deep link handling
 */

import { Capacitor } from "@capacitor/core";

let App: any = null;

if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then((mod) => {
    App = mod.App;
    initializeLifecycle();
  });
}

type StateCallback = (isActive: boolean) => void;
const listeners: StateCallback[] = [];

function initializeLifecycle() {
  if (!App) return;

  // App state change (background/foreground)
  App.addListener("appStateChange", (state: { isActive: boolean }) => {
    console.log("[Lifecycle] App state:", state.isActive ? "foreground" : "background");
    listeners.forEach((cb) => {
      try { cb(state.isActive); } catch {}
    });
  });

  // Back button handler (Android)
  App.addListener("backButton", (event: { canGoBack: boolean }) => {
    if (event.canGoBack) {
      window.history.back();
    } else {
      // Minimize app instead of closing
      App.minimizeApp?.();
    }
  });

  // Deep link handler
  App.addListener("appUrlOpen", (data: { url: string }) => {
    console.log("[Lifecycle] Deep link:", data.url);
    try {
      const url = new URL(data.url);
      if (url.pathname) {
        window.location.href = url.pathname + url.search;
      }
    } catch {}
  });
}

/**
 * Register a callback for app state changes.
 */
export function onAppStateChange(callback: StateCallback): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/**
 * Check if running as a native app.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get current platform.
 */
export function getPlatform(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as any;
}
