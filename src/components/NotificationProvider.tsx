/**
 * MEXICHAT — Notification Provider v3
 * 
 * ONLY handles:
 *   - Browser notification permission
 *   - Message notifications (msg-notify:{userId})
 *   - Browser Notification API for backgrounded tab
 * 
 * Call handling is 100% in useGlobalCallManager + GlobalIncomingCallOverlay.
 * This file NO LONGER touches calls.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound } from '@/utils/sounds';

// ----------
// HELPER: Read active conversation ID from window
// ----------

function getActiveConvId(): string | undefined {
  return (window as unknown as Record<string, unknown>).__mc_active_conv_id as string | undefined;
}

// ----------
// CONSTANTS
// ----------

const NOTIFICATION_AUTO_CLOSE_MS = 8_000;

// ----------
// PROVIDER COMPONENT
// ----------

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const myUserId = user?.id;

  // ----------
  // REQUEST BROWSER NOTIFICATION PERMISSION
  // ----------

  useEffect(() => {
    if (!myUserId) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [myUserId]);

  // ----------
  // BROWSER NOTIFICATION HELPER
  // ----------

  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    tag: string,
    onClick?: () => void,
    icon?: string | null,
  ) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;

    try {
      const n = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag,
        silent: false,
        requireInteraction: false,
      });

      n.onclick = () => {
        window.focus();
        n.close();
        onClick?.();
      };

      setTimeout(() => n.close(), NOTIFICATION_AUTO_CLOSE_MS);
    } catch {
      // Browser doesn't support — silent fail
    }
  }, []);

  // ----------
  // MESSAGE NOTIFICATION LISTENER — SOLE OWNER of `msg-notify:{myUserId}`
  // ----------

  useEffect(() => {
    if (!myUserId) return;

    const channelName = `msg-notify:${myUserId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'new-message' }, ({ payload }: { payload: Record<string, unknown> }) => {
        if (payload.to !== myUserId) return;

        const fromName = (payload.fromName as string) || 'Nuevo mensaje';
        const preview = (payload.preview as string) || 'Tienes un nuevo mensaje';
        const conversationId = payload.conversationId as string | undefined;
        const fromUserId = payload.from as string | undefined;
        const avatarUrl = (payload.avatarUrl as string) || null;

        // In-app toast (only if tab is focused)
        if (document.hasFocus()) {
          const currentConvId = getActiveConvId();
          if (currentConvId !== conversationId) {
            playNotificationSound('message');
            toast.message(fromName, {
              description: preview,
              duration: 4000,
            });
          }
        }

        // Browser notification (only if tab is NOT focused)
        showBrowserNotification(
          fromName,
          preview,
          `mc-msg-${conversationId}`,
          () => {
            if (conversationId && fromUserId) {
              window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
                detail: { conversationId, fromUserId },
              }));
            }
          },
          avatarUrl,
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[NotificationProvider] Message notification channel ready: ${channelName}`);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [myUserId, showBrowserNotification]);

  // ----------
  // RENDER — Just children, no call UI
  // ----------

  return <>{children}</>;
};

export default NotificationProvider;