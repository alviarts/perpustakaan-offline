# Moshi
-keep class com.perpustakaan.nusantara.data.model.** { *; }
-keepclassmembers class com.perpustakaan.nusantara.data.model.** { *; }

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*

# Bouncy Castle
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**
