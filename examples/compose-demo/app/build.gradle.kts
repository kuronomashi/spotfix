import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("spotfix")
}

android {
    namespace = "spotfix.demo"
    compileSdk = 37

    defaultConfig {
        applicationId = "spotfix.demo"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            // Sin firma propia: la de debug basta para probar el APK release en el emulador.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.13.0")

    // spotfix solo en debug; en release, la versión vacía (no entra en el APK).
    debugImplementation("spotfix:spotfix-compose:0.1.0")
    releaseImplementation("spotfix:spotfix-compose-noop:0.1.0")
}
