/**
 * MEXICHAT - Capacitor Native Push Notifications (Hardened v3)
 *
 * CRITICAL: Never crash the app. Push is best-effort.
 * Permission is requested lazily, not on startup.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

let PushNotificationsPlugin: any = null;
let LocalNotificationsPlugin: any = null;
let HapticsPlugin: any = null;
let pluginsLoaded = false;

async function loadNativePlugins(): Promise<boolean> {
  if (!isNative) return false;
  if (pluginsLoaded) return !!PushNotificationsPlugin;
  try {
    const [pushMod, localMod, hapticsMod] = await Promise.allSettled([
      import('@capacitor/push-notifications'),
      import('@capacitor/local-notifications'),
      import('@capacitor/haptics'),
    ]);
    if (pushMod.status === 'fulfilled') PushNotificationsPlugin = pushMod.value.PushNotifications;
    if (localMod.status === 'fulfilled') LocalNotificationsPlugin = localMod.value.LocalNotifications;
    if (hapticsMod.status === 'fulfilled') HapticsPlugin = hapticsMod.value.Haptics;
    pluginsLoaded = true;
    return !!PushNotificationsPlugin;
  } catch {
    console.warn('[CapPush] Failed to load native plugins');
    pluginsLoaded = true;
    return false;
  }
}

let pushRegistered = false;

export async function registerNativePush(userId: string): Promise<void> {
  if (!isNative || pushRegistered) return;

  // Delay push registration to avoid blocking app startup
  await new Promise(r => setTimeout(r, 3000));

  let loaded = false;
  try {
    loaded = await loadNativePlugins();
  } catch {
    console.warn('[CapPush] Plugin load failed - skipping push');
    return;
  }

  if (!loaded || !PushNotificationsPlugin) {
    console.warn('[CapPush] Push plugin not available - Web Push will handle notifications');
    return;
  }

  try {
    // 1. Check current permission status first (non-blocking)
    let permStatus: any;
    try {
      permStatus = await PushNotificationsPlugin.checkPermissions();
    } catch {
      console.warn('[CapPush] Cannot check permissions - skipping');
      return;
    }

    // 2. Only request permission if not already decided
    if (permStatus.receive === 'denied') {
      console.warn('[CapPush] Permission previously denied - skipping');
      return;
    }

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      try {
        const permResult = await PushNotificationsPlugin.requestPermissions();
        if (permResult.receive !== 'granted') {
          console.warn('[CapPush] Permission not granted - skipping');
          return;
        }
      } catch {
        console.warn('[CapPush] Permission request failed - skipping');
        return;
      }
    }

    // 3. Try to register with FCM/APNs
    try {
      await PushNotificationsPlugin.register();
    } catch (regErr: any) {
      console.warn('[CapPush] FCM/APNs registration failed:', regErr?.message || regErr);
      return;
    }

    // 4. Listen for registration token
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
          } as any, { onConflict: 'user_id,endpoint' }) as any);
        console.log('[CapPush] Token stored in DB');
        pushRegistered = true;
      } catch (err) {
        console.error('[CapPush] DB store failed:', err);
      }
    });

    // 5. Registration error - not a crash
    PushNotificationsPlugin.addListener('registrationError', (err: any) => {
      console.warn('[CapPush] Registration error (non-fatal):', err);
    });

    // 6. Foreground notification
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

    // 7. Notification tapped
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
    // ABSOLUTE LAST RESORT - never crash
    console.error('[CapPush] Init failed (non-fatal):', err);
  }
}

export async function unregisterNativePush(): Promise<void> {
  if (!isNative || !PushNotificationsPlugin) return;
  try {
    await PushNotificationsPlugin.removeAllListeners();
    pushRegistered = false;
  } catch {}
}

export function stopCallVibration(): void {
  try {
    if ((window as any).__callVibrateInterval) {
      clearInterval((window as any).__callVibrateInterval);
      (window as any).__callVibrateInterval = null;
    }
  } catch {}
}
