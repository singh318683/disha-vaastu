# Release minify is off. Keep the Play Billing listener if minify is turned on later.
-keep class com.android.vending.billing.** { *; }
-keep class com.android.billingclient.api.** { *; }
