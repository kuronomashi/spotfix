pluginManagement {
    // Plugin id("spotfix"): tareas spotfixPull y spotfixStatus.
    includeBuild("../../kotlin/spotfix-gradle")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "compose-demo"
include(":app")

// spotfix-compose y spotfix-compose-noop desde la carpeta del repo.
includeBuild("../../kotlin")
