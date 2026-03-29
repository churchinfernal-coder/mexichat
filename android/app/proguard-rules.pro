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

# WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}