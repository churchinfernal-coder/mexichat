/**
 * MEXICHAT — Service Worker + Push Subscription Hook v3
 * 
 * Now detects Capacitor native and skips web push registration
 * (native push is handled by capacitor-push.ts instead).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isNative, registerNativePush } from '@/lib/capacitor-push';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useServiceWorker(userId: string | undefined) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const subscribedRef = useRef(false);

  // ─── Native: Use Capacitor push instead of web push ───
  useEffect(() => {
    if (!isNative || !userId) return;
    registerNativePush(userId);
  }, [userId]);

  // ─── Web: Register service worker (skip on native) ───
  useEffect(() => {
    if (isNative) return; // Native handles its own push
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        registrationRef.current = registration;
        console.log('[SW] Registered:', registration.scope);
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('[SW] Registration failed:', error);
      });
  }, []);

  // ─── Web: Subscribe to push notifications (skip on native) ───
  useEffect(() => {
    if (isNative) return;
    if (!userId || !VAPID_PUBLIC_KEY || subscribedRef.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribe = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        registrationRef.current = registration;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.warn('[SW] Notification permission denied');
            return;
          }

          const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const applicationServerKey = keyArray.buffer.slice(
            keyArray.byteOffset,
            keyArray.byteOffset + keyArray.byteLength
          ) as ArrayBuffer;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });

          console.log('[SW] New push subscription created');
        }

        // Store subscription in Supabase
        const subJson = subscription.toJSON();
        try {
          await (supabase
            .from('push_subscriptions' as any)
            .upsert({
              user_id: userId,
              endpoint: subJson.endpoint || '',
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
              user_agent: navigator.userAgent,
              updated_at: new Date().toISOString(),
            } as any, {
              onConflict: 'user_id,endpoint',
            }) as any);

          console.log('[SW] ✅ Push subscription stored in DB');
        } catch (dbError) {
          console.warn('[SW] Could not store push subscription:', dbError);
        }

        subscribedRef.current = true;
        console.log('[SW] ✅ Push subscription active');
      } catch (error) {
        console.warn('[SW] Push subscription failed:', error);
      }
    };

    subscribe();
  }, [userId]);

  // ─── Web: Listen for messages from service worker ───
  useEffect(() => {
    if (isNative) return;
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { data } = event;

      if (data?.type === 'mc-navigate') {
        window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
          detail: {
            conversationId: data.conversationId,
            fromUserId: data.fromUserId,
            autoAcceptCall: data.autoAcceptCall,
          },
        }));
      }

      if (data?.type === 'mexichat-reject-call') {
        window.dispatchEvent(new CustomEvent('mc-reject-incoming-call', {
          detail: { fromUserId: data.fromUserId },
        }));
      }

      if (data?.type === 'INCOMING_CALL') {
        window.dispatchEvent(new CustomEvent('mc-native-incoming-call', {
          detail: {
            callerId: data.callerId,
            callerName: data.callerName,
            callType: data.callType,
            conversationId: data.conversationId,
          },
        }));

        // If the user tapped "Answer" on the notification, also dispatch navigate
        if (data.autoAcceptCall) {
          window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
            detail: {
              conversationId: data.conversationId,
              fromUserId: data.callerId,
              autoAcceptCall: true,
            },
          }));
        }
      }

      if (data?.type === 'NOTIFICATION_CLICK') {
        window.dispatchEvent(new CustomEvent('mc-navigate-conversation', {
          detail: {
            conversationId: data.conversationId,
            fromUserId: data.callerId || data.fromUserId,
            autoAcceptCall: data.autoAcceptCall || false,
          },
        }));
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return { registration: registrationRef.current };
}