with open("src/services/pushNotifications.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the entire dynamic import block and registerNativePush
old_imports = '''// Dynamically import Capacitor plugins only when on native
let PushNotifications: any = null;
let LocalNotifications: any = null;

if (Capacitor.isNativePlatform()) {
  import("@capacitor/push-notifications").then((mod) => {
    PushNotifications = mod.PushNotifications;
  });
  import("@capacitor/local-notifications").then((mod) => {
    LocalNotifications = mod.LocalNotifications;
  });
}'''

new_imports = '''// Dynamically import Capacitor plugins only when on native
let PushNotifications: any = null;
let LocalNotifications: any = null;
let _pluginsLoaded: Promise<void> | null = null;

function loadNativePlugins(): Promise<void> {
  if (!_pluginsLoaded && Capacitor.isNativePlatform()) {
    _pluginsLoaded = Promise.all([
      import("@capacitor/push-notifications").then((mod) => {
        PushNotifications = mod.PushNotifications;
      }).catch(() => {}),
      import("@capacitor/local-notifications").then((mod) => {
        LocalNotifications = mod.LocalNotifications;
      }).catch(() => {}),
    ]).then(() => {});
  }
  return _pluginsLoaded || Promise.resolve();
}

// Start loading immediately but don't block
if (Capacitor.isNativePlatform()) {
  loadNativePlugins();
}'''

content = content.replace(old_imports, new_imports)

# Now fix registerNativePush to await plugin loading
old_register = '''async function registerNativePush(userId: string): Promise<void> {
  if (!PushNotifications) {
    console.warn("[Push] PushNotifications plugin not available");
    return;
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();'''

new_register = '''async function registerNativePush(userId: string): Promise<void> {
  // Wait for dynamic imports to finish
  await loadNativePlugins();

  if (!PushNotifications) {
    console.warn("[Push] PushNotifications plugin not available");
    return;
  }

  try {
    // Request permission — wrap in try/catch for native safety
    let permResult: any;
    try {
      permResult = await PushNotifications.requestPermissions();
    } catch (permErr) {
      console.warn("[Push] Permission request failed (plugin not ready):", permErr);
      return;
    }'''

content = content.replace(old_register, new_register)

# Also wrap the entire initializePushNotifications in try/catch
old_init = '''export async function initializePushNotifications(userId: string): Promise<void> {
  if (!userId) return;

  if (Capacitor.isNativePlatform()) {
    await registerNativePush(userId);
  } else {
    await registerWebPush(userId);
  }
}'''

new_init = '''export async function initializePushNotifications(userId: string): Promise<void> {
  if (!userId) return;

  try {
    if (Capacitor.isNativePlatform()) {
      await registerNativePush(userId);
    } else {
      await registerWebPush(userId);
    }
  } catch (err) {
    console.warn("[Push] initializePushNotifications failed (non-fatal):", err);
  }
}'''

content = content.replace(old_init, new_init)

with open("src/services/pushNotifications.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("DONE — pushNotifications.ts crash fix applied")
