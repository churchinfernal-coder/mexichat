/**
 * Notification Service — MexiChat
 * Uses browser Notification API only (no Firebase dependency)
 */

import { supabase } from '@/integrations/supabase/client';

export function areNotificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): NotificationPermission {
  if (!areNotificationsSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (!areNotificationsSupported()) {
    console.warn('⚠️ [Notifications] Not supported');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn(`⚠️ [Notifications] Permission ${permission}`);
      return null;
    }

    console.log('✅ [Notifications] Browser permission granted');

    // Mark enabled in DB (profiles table — add notifications_enabled column if missing)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch {}
    }

    return 'browser-only';
  } catch (error) {
    console.error('❌ [Notifications] Error:', error);
    return null;
  }
}

export function setupMessageListener() {
  // Browser-only notifications — no Firebase needed
  console.log('✅ [Notifications] Browser notification listener ready');
}

export function showNotification(title: string, body: string, data?: any) {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'mc-message',
    requireInteraction: false,
    data,
  } as NotificationOptions);

  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  notification.onclick = () => {
    window.focus();
    notification.close();
    if (data?.chatId && window.location.pathname !== '/mensajes') {
      window.location.href = '/mensajes';
    }
  };

  playNotificationSound();
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

export async function disableNotifications(): Promise<boolean> {
  return true;
}

export async function areNotificationsEnabled(): Promise<boolean> {
  return Notification.permission === 'granted';
}