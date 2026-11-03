# spotfix para Kotlin Android / Jetpack Compose

Mismo botón, panel y formato de notas que el resto ([../spec/formato.md](../spec/formato.md),
[../spec/estetica.md](../spec/estetica.md)). Ejemplo completo: [../examples/compose-demo](../examples/compose-demo).

| Carpeta | Qué es |
|---|---|
| `spotfix-compose/` | La librería (solo en debug). |
| `spotfix-compose-noop/` | La misma API vacía, para release: spotfix no entra en el APK final. |
| `spotfix-gradle/` | Plugin `id("spotfix")` con `spotfixPull` y `spotfixStatus`. |

Requisitos: AGP 9, Gradle 9.6+, JDK 17+ (el de Android Studio vale), `minSdk` 24, `compileSdk` 37.

## Instalar

### Con la carpeta local (como en Rust)

`settings.gradle.kts`:

```kotlin
pluginManagement {
    includeBuild("F:/Librerias kuronoma/spotfix/kotlin/spotfix-gradle")
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
// ...
includeBuild("F:/Librerias kuronoma/spotfix/kotlin")
```

`app/build.gradle.kts`:

```kotlin
plugins {
    // ...
    id("spotfix")
}

dependencies {
    debugImplementation("spotfix:spotfix-compose:0.1.0")
    releaseImplementation("spotfix:spotfix-compose-noop:0.1.0")
}
```

### Con JitPack (desde GitHub)

`settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal(); maven("https://jitpack.io") }
    resolutionStrategy {
        eachPlugin {
            if (requested.id.id == "spotfix") useModule("com.github.kuronomashi.spotfix:spotfix-gradle:v0.1.0")
        }
    }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral(); maven("https://jitpack.io") }
}
```

`app/build.gradle.kts`:

```kotlin
plugins { id("spotfix") }

dependencies {
    debugImplementation("com.github.kuronomashi.spotfix:spotfix-compose:v0.1.0")
    releaseImplementation("com.github.kuronomashi.spotfix:spotfix-compose-noop:v0.1.0")
}
```

JitPack compila el tag la primera vez que alguien lo pide (receta en [../jitpack.yml](../jitpack.yml)).

## Uso

```kotlin
setContent {
    SpotfixOverlay(seccion = ruta) {          // envuelve la app
        App()
    }
}

// Zonas con nombre (opcional), como `zone` en egui:
Column(Modifier.spotfix("Cabecera")) { ... }
```

- El botón sale abajo a la derecha. Se arrastra y recuerda la posición.
- **Señalar zona**: toca una zona (se ven todas con un borde fino) o arrastra un rectángulo.
  Atrás cancela. La nota guarda `Cabecera < Pantalla` (zonas anidadas) y el `archivo:línea` donde
  se escribió `Modifier.spotfix(...)`, sin configurar nada.
- Mismo panel que en web y egui: Nota | Almacenadas, ajustes (tema y carpeta), capturas de la
  zona o de la pantalla entera (sin la interfaz de spotfix), Copiar para la IA y Compartir.
- **Sección**: el parámetro `seccion`. Con Navigation Compose:
  `seccion = navController.currentBackStackEntryAsState().value?.destination?.route`.
  También vale `SpotfixSection("Ajustes")` dentro de cada pantalla. Si no hay ninguna, se usa el
  nombre de la Activity.
- Solo actúa si la app es depurable; en release se usa `spotfix-compose-noop`.
  Para apagarlo en debug: `"enabled": false` en `.spotfix/config.json`.

## Llevar las notas al proyecto

La app corre en el móvil o el emulador, así que las notas se guardan allí
(`/sdcard/Android/data/<app>/files/.spotfix`). Con el dispositivo conectado:

```bash
./gradlew spotfixPull     # trae las notas nuevas y lleva al móvil las que la IA marcó "hecha"
./gradlew spotfixStatus   # cuántas abiertas hay en cada lado, sin cambiar nada
```

- Las notas nuevas y sus capturas van a la carpeta de Ajustes (por defecto `.spotfix/notas` en la
  raíz del proyecto Gradle). `spotfixPull` nunca borra nada.
- Si una nota está en los dos lados, gana `hecha`: la IA la marca en el PC y, al sincronizar,
  desaparece de la lista del móvil.
- `fuente` llega como `paquete/Archivo.kt:línea` (la pila de Android no da la carpeta);
  `spotfixPull` la cambia por la ruta real, p. ej. `app/src/main/java/com/ej/Pantalla.kt:42`.
- `config.json`: gana el más reciente. `LEEME-IA.md` se copia si el proyecto no tiene uno.
- Otra app o variante: `./gradlew spotfixPull -Pspotfix.app=com.ej.otra.debug`.
  Varios dispositivos: define `ANDROID_SERIAL`.

## Quitarlo

Borra las dos dependencias, `id("spotfix")`, los `includeBuild` y las llamadas
`SpotfixOverlay { }` / `Modifier.spotfix(...)` / `SpotfixSection(...)`. Las notas se quedan.

## Desarrollo

```bash
cd kotlin
./gradlew :spotfix-compose:testDebugUnitTest      # formato y almacenamiento
./gradlew -p spotfix-gradle test                   # mezcla de spotfixPull
```

Hace falta `local.properties` con `sdk.dir=...` (o `ANDROID_HOME`).
