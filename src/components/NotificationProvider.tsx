/**
 * MEXICHAT — Notification Provider v4 (Hardened)
 *
 * ONLY handles:
 *   - Browser notification permission (WEB ONLY — never on native)
 *   - Message notifications via Supabase broadcast (msg-notify:{userId})
 *   - Browser Notification API for backgrounded tab (WEB ONLY)
 *   - In-app toast for focused tab
 *
 * Call handling is 100% in useGlobalCallManager + GlobalIncomingCallOverlay.
 * Native push is 100% in capacitor-push.ts.
 * This file NEVER runs browser Notification API on native.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

// ===============================================================================
// CONSTANTS
// ===============================================================================

const NOTIFICATION_AUTO_CLOSE_MS = 8_000;
const TOAST_THROTTLE_MS = 500;
const _isNative = Capacitor.isNativePlatform();

// ===============================================================================
// HELPERS
// ===============================================================================

function getActiveConvId(): string | undefined {
  try {
    return (window as any).__mc_active_conv_id as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Safe notification sound — never crashes.
 */
function safePlayNotificationSound(): void {
  try {
    // Dynamic import to avoid crash if module is missing
    import('@/utils/sounds').then((mod) => {
      mod.playNotificationSound?.('message');
    }).catch(() => {});
  } catch {
    // Silent — sound is non-critical
  }
}

/**
 * Check if browser Notification API is safe to use.
 * Returns false on native — native push is handled by capacitor-push.ts.
 */
function canUseBrowserNotifications(): boolean {
  if (_isNative) return false;
  try {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof Notification !== 'undefined' &&
      typeof Notification.requestPermission === 'function'
    );
  } catch {
    return false;
  }
}

// ===============================================================================
// PROVIDER COMPONENT
// ===============================================================================

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const myUserId = user?.id;
  const lastToastRef = useRef<number>(0);

  // ----------
  // REQUEST BROWSER NOTIFICATION PERMISSION (WEB ONLY)
  // ----------

  useEffect(() => {
    if (!myUserId) return;
    if (!canUseBrowserNotifications()) return;

    try {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // Notification API unavailable — silent
    }
  }, [myUserId]);

  // ----------
  // BROWSER NOTIFICATION HELPER (WEB ONLY)
  // ----------

  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    tag: string,
    onClick?: () => void,
    icon?: string | null,
  ) => {
    // Never run on native
    if (!canUseBrowserNotifications()) return;

    try {
      if (Notification.permission !== 'granted') return;

      // Don't show browser notification if tab is focused — toast handles that
      if (document.hasFocus()) return;

      const n = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag,
        silent: false,
        requireInteraction: false,
      });

      n.onclick = () => {
        try {
          window.focus();
          n.close();
          onClick?.();
        } catch {
          // Never crash on click handler
        }
      };

      setTimeout(() => {
        try { n.close(); } catch {}
      }, NOTIFICATION_AUTO_CLOSE_MS);
    } catch {
      // new Notification() can throw on some environments — silent fail
    }
  }, []);

  // ----------
  // MESSAGE NOTIFICATION LISTENER — SOLE OWNER of `msg-notify:{myUserId}`
  // ----------

  useEffect(() => {
    if (!myUserId) return;

    const channelName = `msg-notify:${myUserId}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase.channel(channelName);

      channel
        .on('broadcast', { event: 'new-message' }, ({ payload }: { payload: Record<string, unknown> }) => {
          try {
            if (!payload || payload.to !== myUserId) return;

            const fromName = (typeof payload.fromName === 'string' && payload.fromName) || 'Nuevo mensaje';
            const preview = (typeof payload.preview === 'string' && payload.preview) || 'Tienes un nuevo mensaje';
            const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : undefined;
            const fromUserId = typeof payload.from === 'string' ? payload.from : undefined;
            const avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl : null;

            // In-app toast (only if tab is focused AND not viewing that conversation)
            if (document.hasFocus()) {
              const currentConvId = getActiveConvId();
              if (currentConvId !== conversationId) {
                // Throttle: don't spam toasts if messages arrive rapidly
                const now = Date.now();
                if (now - lastToastRef.current > TOAST_THROTTLE_MS) {
                  lastToastRef.current = now;
                  safePlayNotificationSound();
                  toast.message(fromName, {
                    description: preview,
                    duration: 4000,
                  });
                }
              }
            }

            // Browser notification (only if tab is NOT focused, WEB ONLY)
            showBrowserNotification(
              fromName,
              preview,
              conversationId ? `mc-msg-${conversationId}` : 'mc-message',
              () => {
                if (conversationId && fromUserId) {
                  window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
                    detail: { conversationId, fromUserId },
                  }));
                }
              },
              avatarUrl,
            );
          } catch (err) {
            // Never crash on incoming message processing
            console.warn('[NotificationProvider] Message handler error:', err);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[NotificationProvider] Channel ready: ${channelName}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[NotificationProvider] Channel ${channelName} failed: ${status}`);
          }
        });
    } catch (err) {
      console.error('[NotificationProvider] Failed to create channel:', err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        // Channel already removed or Supabase unavailable — silent
      }
    };
  }, [myUserId, showBrowserNotification]);

  // ----------
  // REPORT ALERT LISTENER — realtime safety alerts from other users
  // ----------
  useEffect(() => {
    if (!myUserId) return;
    const channelName = 'report-alert:' + myUserId + ':listen';
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase.channel(channelName);
      channel
        .on('broadcast', { event: 'report-alert' }, (msg: any) => {
          const p = msg?.payload;
          if (!p) return;
          const name = p.reportedName || 'Un usuario';
          const cat = p.category || 'conducta';
          const total = p.totalReports || 1;
          const toastMsg = name + ' ha sido reportado por ' + cat + '. ' + total + ' reporte(s) en total.';

          toast.warning(toastMsg, { duration: 8000 });

          if (!isNative && document.hidden && Notification.permission === 'granted') {
            try {
              new Notification('⚠️ Alerta de Seguridad — MexiChat', {
                body: toastMsg,
                icon: p.reportedAvatar || '/favicon.ico',
                tag: 'report-' + p.reportedUserId,
              });
            } catch {}
          }
        })
        .subscribe();
    } catch (err) {
      console.error('[NotificationProvider] Report alert channel failed:', err);
    }

    return () => {
      try { if (channel) supabase.removeChannel(channel); } catch {}
    };
  }, [myUserId]);

  // ----------
  // RENDER — Just children, no call UI
  // ----------

  return <>{children}</>;
};

export default NotificationProvider;