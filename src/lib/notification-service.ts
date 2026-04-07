/**
 * Notification Service — MexiChat
 *
 * Browser-only notification handling (Web Push display layer).
 * On native (Capacitor), ALL notification logic is handled by capacitor-push.ts.
 * This file NEVER runs notification code on native — guaranteed no-crash.
 */

import { Capacitor } from '@capacitor/core';

// ===============================================================================
// PLATFORM DETECTION
// ===============================================================================

const _isNative = Capacitor.isNativePlatform();

/**
 * Check if browser Notification API is available AND we're on web.
 * Returns false on native — native push is handled elsewhere.
 */
export function areNotificationsSupported(): boolean {
  if (_isNative) return false;
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof Notification !== 'undefined' &&
      'serviceWorker' in navigator
    );
  } catch {
    return false;
  }
}

// ===============================================================================
// PERMISSION
// ===============================================================================

/**
 * Get current browser notification permission.
 * Returns 'denied' on native or unsupported environments.
 */
export function getNotificationPermission(): NotificationPermission {
  if (!areNotificationsSupported()) return 'denied';
  try {
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

/**
 * Request browser notification permission from the user.
 * No-op on native — returns null immediately.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!areNotificationsSupported()) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Notifications] Permission not granted:', permission);
      return null;
    }
    console.log('[Notifications] Browser permission granted');
    return 'browser-only';
  } catch (error) {
    console.error('[Notifications] Permission request error:', error);
    return null;
  }
}

// ===============================================================================
// DISPLAY
// ===============================================================================

/**
 * Show a browser notification. No-op on native.
 * Uses SPA-safe navigation (CustomEvent) instead of window.location.href.
 */
export function showNotification(
  title: string,
  body: string,
  data?: { chatId?: string; conversationId?: string; fromUserId?: string },
): void {
  if (!areNotificationsSupported()) return;

  try {
    if (Notification.permission !== 'granted') return;

    // Don't show browser notifications if the tab is focused —
    // in-app toast handles that (see NotificationProvider)
    if (document.hasFocus()) return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data?.conversationId ? `mc-msg-${data.conversationId}` : 'mc-message',
      requireInteraction: false,
    });

    notification.onclick = () => {
      try {
        window.focus();
        notification.close();

        // SPA navigation — dispatch event instead of full page reload
        if (data?.conversationId || data?.chatId) {
          window.dispatchEvent(
            new CustomEvent('mc-navigate-conversation', {
              detail: {
                conversationId: data.conversationId || data.chatId || '',
                fromUserId: data.fromUserId || '',
              },
            }),
          );
        }
      } catch {
        // Never crash on notification click
      }
    };

    // Auto-close after 8 seconds
    setTimeout(() => {
      try { notification.close(); } catch {}
    }, 8000);

    playNotificationSound();
  } catch (err) {
    // Notification constructor can throw on some WebViews — never crash
    console.warn('[Notifications] showNotification failed:', err);
  }
}

// ===============================================================================
// SOUND
// ===============================================================================

function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 300);
  } catch {
    // AudioContext not available or blocked by autoplay policy — silent fail
  }
}

// ===============================================================================
// STATUS HELPERS
// ===============================================================================

/**
 * Check if browser notifications are currently enabled.
 * Always false on native.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (!areNotificationsSupported()) return false;
  try {
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Disable notifications — revokes permission tracking.
 * Note: browsers don't allow programmatic permission revocation.
 * This only clears the app-level preference.
 */
export async function disableNotifications(): Promise<boolean> {
  // Browser API does not support revoking notification permission.
  // This is a no-op — the user must revoke via browser settings.
  return true;
}

/**
 * No-op — kept for backward compatibility.
 * Message listening is handled by NotificationProvider + useServiceWorker.
 */
export function setupMessageListener(): void {
  // Intentionally empty — listener logic lives in NotificationProvider.tsx
}