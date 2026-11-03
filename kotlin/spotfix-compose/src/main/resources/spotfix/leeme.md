# spotfix: notas del usuario para la IA

Esta carpeta la crea la librería **spotfix**. El usuario señala partes de la app mientras la
prueba y deja notas (bugs o sugerencias). Cada nota dice dónde está el problema, así que no hace
falta buscarlo.

## Regla principal: marca cada nota como hecha

Cuando termines lo que pide una nota, **abre su archivo y cambia `estado: "abierta"` por
`estado: "hecha"`**. Es obligatorio: así el usuario ve en spotfix qué está resuelto (las notas
hechas desaparecen de la lista y de "Copiar"). No borres ni muevas la nota. Si no pudiste
resolverla, déjala `"abierta"` y explícale al usuario por qué.

## Cómo leer las notas

- Las notas están en la carpeta `carpeta` de `config.json` (por defecto `.spotfix/notas`),
  en subcarpetas `AAAA-MM-DD/*.md`: una nota por archivo. Cabecera entre `---` con valores JSON.
- Campos clave:
  - `seccion`: pantalla o ruta donde estaba el usuario.
  - `archivo_ruta`: archivo que define esa pantalla.
  - `componente`: componente señalado y sus padres (`Hijo < Padre`).
  - `fuente`: `archivo:línea` del código del componente. Empieza por aquí.
  - `selector` y `texto_visible`: para encontrar el elemento si `fuente` falta.
  - `capturas`: imágenes en `img/` del mismo día. Ábrelas.
- Debajo de la cabecera está lo que pidió el usuario.
- Atiende solo las notas con `estado: "abierta"`.

## Si el usuario pide "quita spotfix" o "quita la librería"

Ejecuta en la raíz del proyecto:

```
npx spotfix remove
npm uninstall spotfix
```

`remove` desactiva spotfix (config.json -> enabled: false), quita `<Spotfix />` y su import
del layout, y mueve la ruta `app/api/spotfix/route.ts` a `.spotfix/retirado/`. Las notas se
conservan. Para solo apagarlo un tiempo: `npx spotfix off` (y `npx spotfix on` para volver).

En apps Rust (egui): quita la dependencia `spotfix-egui` de Cargo.toml y las llamadas
`spotfix_egui::show!` / `spotfix_egui::zone`, o pon `"enabled": false` en config.json.

En apps Android (Compose): quita `debugImplementation`/`releaseImplementation` de `spotfix-compose`
y `spotfix-compose-noop`, el plugin `id("spotfix")`, el `includeBuild` de settings.gradle.kts y
las llamadas `SpotfixOverlay { }` / `Modifier.spotfix(...)` / `SpotfixSection(...)`, o pon
`"enabled": false` en config.json.

## Notas de Android

En Android las notas se escriben en el móvil o emulador. Para traerlas a esta carpeta (y llevar al
móvil las que marcaste como hechas) el usuario ejecuta `gradlew spotfixPull` en la raíz del
proyecto. Si el usuario dice que dejó notas nuevas y no las ves, pídele que lo ejecute (o ejecútalo
tú si hay un dispositivo conectado).