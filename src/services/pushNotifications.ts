/**
 * Push Notification Service
 *
 * Handles both Web Push (service worker) and Native Push (Capacitor).
 * Registers device tokens with Supabase for server-side push delivery.
 *
 * Flow:
 * 1. On login, register for push notifications
 * 2. Store device token in push_tokens table
 * 3. Supabase Edge Function uses tokens to send FCM/APNs pushes
 * 4. Service worker handles web push display
 * 5. Capacitor handles native push display
 */

import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

// Dynamically import Capacitor plugins only when on native
let PushNotifications: any = null;
let LocalNotifications: any = null;

if (Capacitor.isNativePlatform()) {
  import("@capacitor/push-notifications").then((mod) => {
    PushNotifications = mod.PushNotifications;
  });
  import("@capacitor/local-notifications").then((mod) => {
    LocalNotifications = mod.LocalNotifications;
  });
}

// ===============================================================================
// TOKEN STORAGE
// ===============================================================================

async function storeToken(userId: string, token: string, platform: string): Promise<void> {
  try {
    // Upsert to avoid duplicates
    await supabase.from("push_tokens" as any).upsert(
      {
        user_id: userId,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
    console.log("[Push] Token stored for platform:", platform);
  } catch (err) {
    console.error("[Push] Error storing token:", err);
  }
}

async function removeToken(token: string): Promise<void> {
  try {
    await supabase.from("push_tokens" as any).delete().eq("token", token);
  } catch (err) {
    console.error("[Push] Error removing token:", err);
  }
}

// ===============================================================================
// NATIVE PUSH (Capacitor - FCM/APNs)
// ===============================================================================

async function registerNativePush(userId: string): Promise<void> {
  if (!PushNotifications) {
    console.warn("[Push] PushNotifications plugin not available");
    return;
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.warn("[Push] Native push permission denied");
      return;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener("registration", (token: { value: string }) => {
      const platform = Capacitor.getPlatform(); // 'ios' or 'android'
      storeToken(userId, token.value, platform);
      console.log("[Push] Native token received:", token.value.substring(0, 20) + "...");
    });

    // Listen for registration error
    PushNotifications.addListener("registrationError", (error: any) => {
      console.error("[Push] Registration error:", error);
    });

    // Listen for incoming push when app is in foreground
    PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: any) => {
        console.log("[Push] Foreground notification:", notification);

        // Show as local notification since native push won't display in foreground
        if (LocalNotifications) {
          LocalNotifications.schedule({
            notifications: [
              {
                title: notification.title || "MexiChat",
                body: notification.body || "Nuevo mensaje",
                id: Date.now(),
                sound: "mexichat_message",
                extra: notification.data,
              },
            ],
          });
        }
      }
    );

    // Listen for notification tap
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: any) => {
        console.log("[Push] Notification tapped:", action);
        const data = action.notification?.data;
        if (data?.url) {
          window.location.href = data.url;
        } else if (data?.conversationId) {
          window.location.href = "/mensajes";
        }
      }
    );
  } catch (err) {
    console.error("[Push] Native registration error:", err);
  }
}

// ===============================================================================
// WEB PUSH (Service Worker)
// ===============================================================================

async function registerWebPush(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[Push] Web Push not supported");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Push] Web push permission denied");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Get VAPID public key from server or env
      // For now, use web-push generated key
      // TODO: Move to environment variable
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        console.warn("[Push] No VAPID key available");
        return;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
    }

    // Store the subscription endpoint as the token
    const token = JSON.stringify(subscription.toJSON());
    await storeToken(userId, token, "web");
    console.log("[Push] Web push registered");
  } catch (err) {
    console.error("[Push] Web push registration error:", err);
  }
}

async function getVapidPublicKey(): Promise<Uint8Array | null> {
  try {
    // Try to get from Supabase app_settings or use a default
    const { data } = await supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "vapid_public_key")
      .maybeSingle();

    if (data?.value) {
      return urlBase64ToUint8Array(data.value);
    }

    // Fallback: check if there is a meta tag
    const meta = document.querySelector('meta[name="vapid-public-key"]');
    if (meta) {
      return urlBase64ToUint8Array(meta.getAttribute("content") || "");
    }

    return null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ===============================================================================
// PUBLIC API
// ===============================================================================

/**
 * Initialize push notifications for the current user.
 * Call after successful authentication.
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  if (!userId) return;

  if (Capacitor.isNativePlatform()) {
    await registerNativePush(userId);
  } else {
    await registerWebPush(userId);
  }
}

/**
 * Clean up push registration on logout.
 */
export async function cleanupPushNotifications(): Promise<void> {
  if (Capacitor.isNativePlatform() && PushNotifications) {
    try {
      await PushNotifications.removeAllListeners();
    } catch {}
  }
}

/**
 * Check if push notifications are supported and permitted.
 */
export function isPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Get current push permission status.
 */
export async function getPushPermissionStatus(): Promise<"granted" | "denied" | "prompt"> {
  if (Capacitor.isNativePlatform() && PushNotifications) {
    try {
      const result = await PushNotifications.checkPermissions();
      return result.receive as any;
    } catch {
      return "prompt";
    }
  }

  if ("Notification" in window) {
    return Notification.permission as any;
  }

  return "denied";
}
