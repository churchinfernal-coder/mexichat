# ══════════════════════════════════════════════
# MexiChat ProGuard Rules — v1.1.0
# ══════════════════════════════════════════════

# Capacitor - keep all plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-dontwarn com.getcapacitor.**
-dontwarn com.capacitorjs.**

# Firebase/GMS
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# WebView — critical for Capacitor
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Capacitor Plugins ──

# Push Notifications
-keep class com.capacitorjs.plugins.pushnotifications.** { *; }
-dontwarn com.capacitorjs.plugins.pushnotifications.**

# Local Notifications
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# Camera
-keep class com.capacitorjs.plugins.camera.** { *; }

# Filesystem
-keep class com.capacitorjs.plugins.filesystem.** { *; }

# Contacts (community plugin)
-keep class getcapacitor.community.contacts.** { *; }
-dontwarn getcapacitor.community.contacts.**

# Share
-keep class com.capacitorjs.plugins.share.** { *; }

# ── MexiChat native classes ──
-keep class mx.mexichat.app.** { *; }
-keep class mx.mexichat.app.MexiChatMessagingService { *; }
-keep class mx.mexichat.app.CallForegroundService { *; }
-keep class mx.mexichat.app.LocationForegroundService { *; }
-keep class mx.mexichat.app.IncomingCallActivity { *; }
-keep class mx.mexichat.app.BootReceiver { *; }

# ── Crypto (used by WebCrypto polyfill if any) ──
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# ── Prevent stripping of enum values ──
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Keep Parcelable implementations ──
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ── Keep Serializable classes ──
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}