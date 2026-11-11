import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

fun secret(property: String, env: String): String {
    val raw = localProperties.getProperty(property) ?: System.getenv(env) ?: ""
    return raw.replace("\\", "\\\\").replace("\"", "\\\"")
}

android {
    namespace = "com.ikshanasolutions.disha"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.ikshanasolutions.disha"
        minSdk = 26
        targetSdk = 36
        versionCode = 5
        versionName = "1.0.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField(
            "String",
            "BILLING_LICENSE_KEY",
            "\"${secret("BILLING_LICENSE_KEY", "DISHA_BILLING_LICENSE_KEY")}\"",
        )
    }

    buildTypes {
        debug {
            val fake = localProperties.getProperty("disha.fakeBilling")
                ?: System.getenv("DISHA_FAKE_BILLING")
                ?: "true"
            buildConfigField("boolean", "USE_FAKE_BILLING", fake)
        }
        release {
            isMinifyEnabled = false
            buildConfigField("boolean", "USE_FAKE_BILLING", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = false
        // Copy lives in the synced JSON catalog, not strings.xml.
        disable += setOf("HardcodedText", "GoogleAppIndexingWarning")
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.billing.ktx)
    implementation(libs.play.services.location)
    debugImplementation(libs.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.json)
}
