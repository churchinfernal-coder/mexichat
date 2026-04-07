/**
 * App Lifecycle Service — MexiChat (Hardened v2)
 *
 * Handles Capacitor app state changes for:
 * - Background/foreground transitions
 * - Back button handling (Android)
 * - Deep link handling (SPA-safe, no page reloads)
 *
 * GUARANTEES:
 * - Never crashes the app
 * - Never causes full page reloads
 * - Gracefully degrades if @capacitor/app plugin is unavailable
 */

import { Capacitor } from "@capacitor/core";

// ===============================================================================
// STATE
// ===============================================================================

const _isNative = Capacitor.isNativePlatform();

type AppPlugin = {
  addListener: (event: string, cb: (...args: any[]) => void) => Promise<any>;
  minimizeApp: () => Promise<void>;
  removeAllListeners: () => Promise<void>;
};

let _app: AppPlugin | null = null;
let _initialized = false;
let _loadPromise: Promise<void> | null = null;

type StateCallback = (isActive: boolean) => void;
const _listeners: StateCallback[] = [];
const MAX_LISTENERS = 50;

// ===============================================================================
// PLUGIN LOADING
// ===============================================================================

function loadAppPlugin(): Promise<void> {
  if (_loadPromise) return _loadPromise;
  if (!_isNative) {
    _loadPromise = Promise.resolve();
    return _loadPromise;
  }

  _loadPromise = import("@capacitor/app")
    .then((mod) => {
      _app = mod.App as AppPlugin;
      initializeLifecycle();
    })
    .catch((err) => {
      console.warn("[Lifecycle] Failed to load @capacitor/app plugin:", err);
    });

  return _loadPromise;
}

// Start loading immediately but never block app startup
if (_isNative) {
  loadAppPlugin();
}

// ===============================================================================
// INITIALIZATION
// ===============================================================================

function initializeLifecycle(): void {
  if (!_app || _initialized) return;
  _initialized = true;

  // --- App state change (background/foreground) ---
  try {
    _app.addListener("appStateChange", (state: { isActive: boolean }) => {
      try {
        console.log("[Lifecycle] App state:", state.isActive ? "foreground" : "background");

        for (let i = 0; i < _listeners.length; i++) {
          try {
            _listeners[i](state.isActive);
          } catch (cbErr) {
            console.warn("[Lifecycle] State callback error:", cbErr);
          }
        }
      } catch (err) {
        console.warn("[Lifecycle] appStateChange handler error:", err);
      }
    });
  } catch (err) {
    console.warn("[Lifecycle] Failed to register appStateChange listener:", err);
  }

  // --- Back button handler (Android) ---
  try {
    _app.addListener("backButton", (event: { canGoBack: boolean }) => {
      try {
        if (event.canGoBack && window.history.length > 1) {
          window.history.back();
        } else {
          try {
            if (_app && _app.minimizeApp) {
              _app.minimizeApp().catch(() => {});
            }
          } catch {
            // minimizeApp not available — silent
          }
        }
      } catch (err) {
        console.warn("[Lifecycle] backButton handler error:", err);
        try {
          if (_app && _app.minimizeApp) {
            _app.minimizeApp().catch(() => {});
          }
        } catch {
          // Last resort failed — silent
        }
      }
    });
  } catch (err) {
    console.warn("[Lifecycle] Failed to register backButton listener:", err);
  }

  // --- Deep link handler (SPA-safe) ---
  try {
    _app.addListener("appUrlOpen", (data: { url: string }) => {
      try {
        if (!data || !data.url) return;
        console.log("[Lifecycle] Deep link:", data.url);

        const url = new URL(data.url);
        const path = url.pathname + url.search;

        if (path && path !== "/") {
          // SPA navigation — dispatch event instead of full page reload
          window.dispatchEvent(
            new CustomEvent("mc-deep-link", {
              detail: { path: path, url: data.url },
            })
          );

          // Fallback: use history.pushState for React Router compatibility
          try {
            window.history.pushState({}, "", path);
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch {
            // If pushState fails, the CustomEvent above is the fallback
          }
        }
      } catch (err) {
        console.warn("[Lifecycle] Deep link parse error:", err);
      }
    });
  } catch (err) {
    console.warn("[Lifecycle] Failed to register appUrlOpen listener:", err);
  }

  console.log("[Lifecycle] Initialized");
}

// ===============================================================================
// PUBLIC API
// ===============================================================================

/**
 * Register a callback for app state changes (foreground/background).
 * Returns an unsubscribe function.
 *
 * Safe to call before plugin is loaded — callbacks are stored
 * and will fire once the plugin initializes.
 */
export function onAppStateChange(callback: StateCallback): () => void {
  if (typeof callback !== "function") return () => {};

  if (_listeners.length >= MAX_LISTENERS) {
    console.warn("[Lifecycle] Max listeners reached, removing oldest");
    _listeners.shift();
  }

  _listeners.push(callback);

  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/**
 * Check if running as a native app (Android/iOS).
 */
export function isNativeApp(): boolean {
  return _isNative;
}

/**
 * Get current platform.
 */
export function getPlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

/**
 * Cleanup all lifecycle listeners.
 * Call on app teardown or logout if needed.
 */
export async function destroyLifecycle(): Promise<void> {
  try {
    _listeners.length = 0;
    if (_app && _app.removeAllListeners) {
      await _app.removeAllListeners();
    }
    _initialized = false;
  } catch {
    // Never crash on cleanup
  }
}
