plugins {
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

// "spotfix:spotfix-compose" con includeBuild; en JitPack el grupo lo pone JitPack.
subprojects {
    group = System.getenv("GROUP")?.let { "$it.spotfix" } ?: "spotfix"
    version = System.getenv("VERSION") ?: "0.1.0"
}
