/**
 * MEXICHAT — Capacitor Native Push Notifications (Hardened v2)
 *
 * Strategy:
 *   - Native: Try FCM/APNs registration. If it fails (no google-services.json),
 *     fall back silently — Web Push via service worker still works in the WebView.
 *   - Web: Does nothing — useServiceWorker.ts handles web push.
 *
 * ALL operations are wrapped in try/catch to prevent crashes.
 * Push is best-effort — the app must never crash due to push failures.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// ===============================================================================
// DETECTION
// ===============================================================================

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

// ===============================================================================
// DYNAMIC IMPORTS (never crash on web)
// ===============================================================================

let PushNotificationsPlugin: any = null;
let LocalNotificationsPlugin: any = null;
let HapticsPlugin: any = null;

async function loadNativePlugins(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const [pushMod, localMod, hapticsMod] = await Promise.allSettled([
      import('@capacitor/push-notifications'),
      import('@capacitor/local-notifications'),
      import('@capacitor/haptics'),
    ]);
    if (pushMod.status === 'fulfilled') PushNotificationsPlugin = pushMod.value.PushNotifications;
    if (localMod.status === 'fulfilled') LocalNotificationsPlugin = localMod.value.LocalNotifications;
    if (hapticsMod.status === 'fulfilled') HapticsPlugin = hapticsMod.value.Haptics;
    return !!PushNotificationsPlugin;
  } catch {
    console.warn('[CapPush] Failed to load native plugins');
    return false;
  }
}

// ===============================================================================
// REGISTER NATIVE PUSH
// ===============================================================================

let pushRegistered = false;

export async function registerNativePush(userId: string): Promise<void> {
  if (!isNative || pushRegistered) return;

  const loaded = await loadNativePlugins();
  if (!loaded || !PushNotificationsPlugin) {
    console.warn('[CapPush] Push plugin not available — Web Push will handle notifications');
    return;
  }

  try {
    // 1. Request permission
    const permResult = await PushNotificationsPlugin.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[CapPush] Permission denied');
      return;
    }

    // 2. Try to register with FCM/APNs
    // This WILL fail without google-services.json — that is OK
    try {
      await PushNotificationsPlugin.register();
    } catch (regErr: any) {
      console.warn('[CapPush] FCM/APNs registration failed (expected without Firebase):', regErr?.message || regErr);
      console.info('[CapPush] Falling back to Web Push via WebView service worker');
      return;
    }

    // 3. Listen for registration token (only fires if FCM/APNs works)
    PushNotificationsPlugin.addListener('registration', async (token: { value: string }) => {
      console.log('[CapPush] Token received:', token.value.slice(0, 20) + '...');

      try {
        const platform = isIOS ? 'ios' : 'android';
        await (supabase
          .from('push_subscriptions' as any)
          .upsert({
            user_id: userId,
            endpoint: 'native:' + platform + ':' + token.value,
            p256dh: platform,
            auth: token.value,
            updated_at: new Date().toISOString(),
          } as any, {
            onConflict: 'user_id,endpoint',
          }) as any);

        console.log('[CapPush] Token stored in DB');
        pushRegistered = true;
      } catch (err) {
        console.error('[CapPush] DB store failed:', err);
      }
    });

    // 4. Registration error — not a crash, just log
    PushNotificationsPlugin.addListener('registrationError', (err: any) => {
      console.warn('[CapPush] Registration error (non-fatal):', err);
    });

    // 5. Foreground notification received
    PushNotificationsPlugin.addListener('pushNotificationReceived', async (notification: any) => {
      console.log('[CapPush] Foreground push:', notification.title);

      const data = notification.data || {};
      const type = data.type || 'message';
      const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

      if (isCall && HapticsPlugin) {
        try {
          await HapticsPlugin.impact({ style: 'Heavy' });
          const vibrateInterval = setInterval(async () => {
            try { await HapticsPlugin.impact({ style: 'Heavy' }); } catch {}
          }, 3000);
          setTimeout(() => clearInterval(vibrateInterval), 30000);
          (window as any).__callVibrateInterval = vibrateInterval;
        } catch {}
      }

      if (isCall) {
        window.dispatchEvent(new CustomEvent('mc-native-incoming-call', {
          detail: {
            callerId: data.callerId || data.fromUserId || '',
            callerName: data.callerName || notification.title || '',
            callType: data.callType || 'audio',
            conversationId: data.conversationId || '',
          },
        }));
      } else if (LocalNotificationsPlugin) {
        try {
          await LocalNotificationsPlugin.schedule({
            notifications: [{
              title: notification.title || 'MexiChat',
              body: notification.body || 'Nuevo mensaje',
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 100) },
              extra: data,
            }],
          });
        } catch {}
      }
    });

    // 6. Notification tapped
    PushNotificationsPlugin.addListener('pushNotificationActionPerformed', (action: any) => {
      console.log('[CapPush] Notification tapped:', action.notification?.title);

      const data = action.notification?.data || {};
      const type = data.type || 'message';
      const isCall = type === 'call' || type === 'incoming_call' || type === 'video_call';

      stopCallVibration();

      window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
        detail: {
          conversationId: data.conversationId || '',
          fromUserId: isCall ? (data.callerId || data.fromUserId || '') : (data.fromUserId || ''),
          autoAcceptCall: isCall && action.actionId === 'answer',
        },
      }));
    });

    console.log('[CapPush] Native push initialized');
  } catch (err) {
    console.error('[CapPush] Init failed (non-fatal):', err);
  }
}

// ===============================================================================
// UNREGISTER
// ===============================================================================

export async function unregisterNativePush(): Promise<void> {
  if (!isNative || !PushNotificationsPlugin) return;
  try {
    await PushNotificationsPlugin.removeAllListeners();
    pushRegistered = false;
  } catch {}
}

// ===============================================================================
// STOP CALL VIBRATION
// ===============================================================================

export function stopCallVibration(): void {
  try {
    if ((window as any).__callVibrateInterval) {
      clearInterval((window as any).__callVibrateInterval);
      (window as any).__callVibrateInterval = null;
    }
  } catch {}
}
