# =============================================================================
# Horizon PRM — ProGuard / R8 rules
# Applied to release builds via proguard-android-optimize.txt + this file.
# =============================================================================

# -----------------------------------------------------------------------------
# Capacitor — the native bridge and all plugin classes are accessed via
# reflection from JavaScript. Nothing in the com.getcapacitor namespace may
# be renamed or removed.
# -----------------------------------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public <methods>;
}

# Custom Capacitor plugin for this project
-keep class com.legitk1ng.horizon.** { *; }

# -----------------------------------------------------------------------------
# WebView JavaScript bridge — @JavascriptInterface methods must survive R8
# -----------------------------------------------------------------------------
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# -----------------------------------------------------------------------------
# AndroidX / Support library
# -----------------------------------------------------------------------------
-keep class androidx.appcompat.** { *; }
-keep class androidx.core.splashscreen.** { *; }
-keepclassmembers class androidx.** {
    public <init>(...);
}

# -----------------------------------------------------------------------------
# Kotlin stdlib and coroutines
# -----------------------------------------------------------------------------
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**
# Required for coroutines' internal volatile field management
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# -----------------------------------------------------------------------------
# Serialization — preserve generic signatures so Gson/Moshi/kotlinx.serialization
# can deserialize correctly even after class renaming
# -----------------------------------------------------------------------------
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# -----------------------------------------------------------------------------
# Stack traces — retain source file and line number info for crash reports
# (class names are still obfuscated; this only retains the mapping metadata)
# -----------------------------------------------------------------------------
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# -----------------------------------------------------------------------------
# OkHttp / Okio — used internally by Capacitor for networking
# -----------------------------------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# -----------------------------------------------------------------------------
# Google Services (FCM / Analytics) — only active when google-services.json present
# -----------------------------------------------------------------------------
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.**

# -----------------------------------------------------------------------------
# Cordova (Capacitor Cordova bridge)
# -----------------------------------------------------------------------------
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# -----------------------------------------------------------------------------
# Remove verbose log calls from release builds to reduce APK surface area.
# Log.e/w are retained for production diagnostics.
# -----------------------------------------------------------------------------
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}
