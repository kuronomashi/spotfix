pluginManagement {
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

rootProject.name = "spotfix-kotlin"
include(":spotfix-compose")
include(":spotfix-compose-noop")
// El plugin de Gradle (spotfix-gradle/) es un build aparte: se incluye en pluginManagement.
