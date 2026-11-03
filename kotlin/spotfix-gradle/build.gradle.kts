// Plugin id("spotfix"): tareas spotfixPull y spotfixStatus para el módulo app.
// En Java para no depender de la versión de Kotlin que trae Gradle.
plugins {
    `java-gradle-plugin`
    `maven-publish`
}

group = System.getenv("GROUP")?.let { "$it.spotfix" } ?: "spotfix"
version = System.getenv("VERSION") ?: "0.1.0"

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

dependencies {
    // Solo la API pública de AGP: el proyecto que aplica el plugin pone su propia versión.
    compileOnly("com.android.tools.build:gradle-api:9.4.1")
    testImplementation("junit:junit:4.13.2")
}

gradlePlugin {
    plugins {
        create("spotfix") {
            id = "spotfix"
            implementationClass = "spotfix.gradle.SpotfixPlugin"
        }
    }
}
