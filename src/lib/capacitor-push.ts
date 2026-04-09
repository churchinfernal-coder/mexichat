/**
 * MEXICHAT — Capacitor Native Push Notifications (Hardened v4)
 *
 * GUARANTEES:
 * - Never crashes the app under any circumstance
 * - Push is best-effort — failure is silent
 * - No duplicate listeners — all listeners registered exactly once
 * - No race conditions — mutex flag set synchronously before async work
 * - Permission is checked before requesting
 * - SPA-safe navigation (CustomEvent, never window.location.href)
 */

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// ===============================================================================
// PLATFORM DETECTION (computed once at module load)
// ===============================================================================

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === "ios";
export const isAndroid = Capacitor.getPlatform() === "android";

// ===============================================================================
// PLUGIN STATE
// ===============================================================================

let _pushPlugin: any = null;
let _localPlugin: any = null;
let _hapticsPlugin: any = null;
let _pluginsLoaded = false;
let _pluginLoadPromise: Promise<boolean> | null = null;

// Registration state — synchronous flag prevents race conditions
let _registering = false;
let _registered = false;
let _listenersAttached = false;

// Vibration state
let _vibrateIntervalId: ReturnType<typeof setInterval> | null = null;
let _vibrateTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Notification ID counter (unique per session)
let _notificationIdCounter = Math.floor(Math.random() * 100000);

// ===============================================================================
// PLUGIN LOADING
// ===============================================================================

function loadNativePlugins(): Promise<boolean> {
  if (!isNative) return Promise.resolve(false);
  if (_pluginsLoaded) return Promise.resolve(!!_pushPlugin);
  if (_pluginLoadPromise) return _pluginLoadPromise;

  _pluginLoadPromise = Promise.allSettled([
    import("@capacitor/push-notifications"),
    import("@capacitor/local-notifications"),
    import("@capacitor/haptics"),
  ])
    .then(([pushMod, localMod, hapticsMod]) => {
      if (pushMod.status === "fulfilled") _pushPlugin = pushMod.value.PushNotifications;
      if (localMod.status === "fulfilled") _localPlugin = localMod.value.LocalNotifications;
      if (hapticsMod.status === "fulfilled") _hapticsPlugin = hapticsMod.value.Haptics;
      _pluginsLoaded = true;
      return !!_pushPlugin;
    })
    .catch(() => {
      console.warn("[CapPush] Failed to load native plugins");
      _pluginsLoaded = true;
      return false;
    });

  return _pluginLoadPromise;
}

// ===============================================================================
// LISTENER REGISTRATION (exactly once, never duplicated)
// ===============================================================================

function attachListeners(userId: string): void {
  if (_listenersAttached || !_pushPlugin) return;
  _listenersAttached = true;

  // --- Token received from FCM/APNs ---
  try {
    _pushPlugin.addListener("registration", async (token: { value: string }) => {
      try {
        if (!token || !token.value) return;
        console.log("[CapPush] Token received:", token.value.slice(0, 20) + "...");

        const platform = isIOS ? "ios" : "android";
        await (supabase
          .from("push_subscriptions" as any)
          .upsert(
            {
              user_id: userId,
              endpoint: "native:" + platform + ":" + token.value,
              p256dh: platform,
              auth: token.value,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "user_id,endpoint" }
          ) as any);

        console.log("[CapPush] Token stored in DB");
        _registered = true;
      } catch (err) {
        console.error("[CapPush] DB store failed:", err);
      }
    });
  } catch (err) {
    console.warn("[CapPush] Failed to attach registration listener:", err);
  }

  // --- Registration error ---
  try {
    _pushPlugin.addListener("registrationError", (err: any) => {
      console.warn("[CapPush] Registration error (non-fatal):", err);
    });
  } catch (err) {
    console.warn("[CapPush] Failed to attach registrationError listener:", err);
  }

  // --- Foreground notification received ---
  try {
    _pushPlugin.addListener("pushNotificationReceived", async (notification: any) => {
      try {
        if (!notification) return;
        console.log("[CapPush] Foreground push:", notification.title);

        const data = notification.data || {};
        const type = data.type || "message";
        const isCall = type === "call" || type === "incoming_call" || type === "video_call";

        if (isCall) {
          startCallVibration();
          window.dispatchEvent(
            new CustomEvent("mc-native-incoming-call", {
              detail: {
                callerId: data.callerId || data.fromUserId || "",
                callerName: data.callerName || notification.title || "",
                callType: data.callType || "audio",
                conversationId: data.conversationId || "",
              },
            })
          );
        } else if (_localPlugin) {
          try {
            _notificationIdCounter += 1;
            await _localPlugin.schedule({
              notifications: [
                {
                  title: notification.title || "MexiChat",
                  body: notification.body || "Nuevo mensaje",
                  id: _notificationIdCounter,
                  schedule: { at: new Date(Date.now() + 100) },
                  extra: data,
                },
              ],
            });
          } catch (localErr) {
            console.warn("[CapPush] Local notification schedule failed:", localErr);
          }
        }
      } catch (err) {
        console.warn("[CapPush] Foreground notification handler error:", err);
      }
    });
  } catch (err) {
    console.warn("[CapPush] Failed to attach pushNotificationReceived listener:", err);
  }

  // --- Notification tapped ---
  try {
    _pushPlugin.addListener("pushNotificationActionPerformed", (action: any) => {
      try {
        if (!action || !action.notification) return;
        console.log("[CapPush] Notification tapped:", action.notification.title);

        const data = action.notification.data || {};
        const type = data.type || "message";
        const isCall = type === "call" || type === "incoming_call" || type === "video_call";

        stopCallVibration();

        window.dispatchEvent(
          new CustomEvent("mc-navigate-conversation", {
            detail: {
              conversationId: data.conversationId || "",
              fromUserId: isCall
                ? data.callerId || data.fromUserId || ""
                : data.fromUserId || "",
              autoAcceptCall: isCall && action.actionId === "answer",
            },
          })
        );
      } catch (err) {
        console.warn("[CapPush] Notification tap handler error:", err);
      }
    });
  } catch (err) {
    console.warn("[CapPush] Failed to attach pushNotificationActionPerformed listener:", err);
  }
}

// ===============================================================================
// VIBRATION MANAGEMENT
// ===============================================================================

function startCallVibration(): void {
  // Clear any existing vibration first
  stopCallVibration();

  if (!_hapticsPlugin) return;

  try {
    // Initial vibration
    _hapticsPlugin.impact({ style: "Heavy" }).catch(() => {});

    // Repeated vibration every 3 seconds
    _vibrateIntervalId = setInterval(() => {
      try {
        if (_hapticsPlugin) {
          _hapticsPlugin.impact({ style: "Heavy" }).catch(() => {});
        }
      } catch {}
    }, 3000);

    // Auto-stop after 30 seconds (unanswered call)
    _vibrateTimeoutId = setTimeout(() => {
      stopCallVibration();
    }, 30000);
  } catch {
    // Haptics not available — silent
  }
}

export function stopCallVibration(): void {
  try {
    if (_vibrateIntervalId !== null) {
      clearInterval(_vibrateIntervalId);
      _vibrateIntervalId = null;
    }
    if (_vibrateTimeoutId !== null) {
      clearTimeout(_vibrateTimeoutId);
      _vibrateTimeoutId = null;
    }
  } catch {
    // Never crash on cleanup
  }
}

// ===============================================================================
// PUBLIC API
// ===============================================================================

/**
 * Register for native push notifications.
 * Call after successful authentication with the user's ID.
 *
 * - No-op on web
 * - No-op if already registered
 * - Mutex prevents concurrent registration attempts
 * - Listeners are attached exactly once
 */
export async function registerNativePush(userId: string): Promise<void> {
  if (!isNative) return;
  if (_registered || _registering) return;
  if (!userId) return;

  // Set synchronous flag BEFORE any async work — prevents race condition
  _registering = true;

  try {
    // Load plugins
    let loaded = false;
    try {
      loaded = await loadNativePlugins();
    } catch {
      console.warn("[CapPush] Plugin load failed — skipping push");
      _registering = false;
      return;
    }

    if (!loaded || !_pushPlugin) {
      console.warn("[CapPush] Push plugin not available");
      _registering = false;
      return;
    }

    // 1. Check current permission status
    let permStatus: any;
    try {
      permStatus = await _pushPlugin.checkPermissions();
    } catch {
      console.warn("[CapPush] Cannot check permissions — skipping");
      _registering = false;
      return;
    }

    // 2. Handle permission state
    if (permStatus.receive === "denied") {
      console.warn("[CapPush] Permission previously denied — skipping");
      _registering = false;
      return;
    }

    if (permStatus.receive === "prompt" || permStatus.receive === "prompt-with-rationale") {
      try {
        const permResult = await _pushPlugin.requestPermissions();
        if (permResult.receive !== "granted") {
          console.warn("[CapPush] Permission not granted — skipping");
          _registering = false;
          return;
        }
      } catch {
        console.warn("[CapPush] Permission request failed — skipping");
        _registering = false;
        return;
      }
    }

    // 3. Attach listeners BEFORE registering (so we catch the token callback)
    attachListeners(userId);

    // 4. Register with FCM/APNs
    try {
      await _pushPlugin.register();
    } catch (regErr: any) {
      console.warn("[CapPush] FCM/APNs registration failed:", regErr && regErr.message ? regErr.message : regErr);
      _registering = false;
      return;
    }

    console.log("[CapPush] Native push initialized");
  } catch (err) {
    // ABSOLUTE LAST RESORT — never crash
    console.error("[CapPush] Init failed (non-fatal):", err);
    _registering = false;
  }
}

/**
 * Unregister push notifications.
 * Call on logout to clean up listeners and reset state.
 */
export async function unregisterNativePush(): Promise<void> {
  if (!isNative) return;

  try {
    if (_pushPlugin && _pushPlugin.removeAllListeners) {
      await _pushPlugin.removeAllListeners();
    }
  } catch {
    // Never crash on cleanup
  }

  stopCallVibration();
  _registered = false;
  _registering = false;
  _listenersAttached = false;
}