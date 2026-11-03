// Build aparte (no subproyecto de kotlin/): se incluye desde pluginManagement del proyecto Android.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "spotfix-gradle"
