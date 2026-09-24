# ProGuard configuration for WAGTW Android Agent
-keep class com.wagtw.agent.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
