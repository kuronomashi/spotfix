# spotfix para Kotlin Android / Jetpack Compose (pendiente)

Mismo formato de notas que el resto ([../spec/formato.md](../spec/formato.md)).

- `SpotfixOverlay { App() }`: envuelve la app y dibuja el botón flotante arrastrable. Solo en
  `BuildConfig.DEBUG`; en release es un `content()` directo.
- `Modifier.spotfix("Cabecera")`: marca zonas (como `zone` en egui) con `onGloballyPositioned`;
  la ruta del archivo y la línea se toman de la pila al crear el modificador.
- `seccion` = ruta actual de Navigation Compose (`currentBackStackEntry.destination.route`).
- Captura con `GraphicsLayer.toImageBitmap()` recortada a la zona.
- Las notas se guardan en el almacenamiento de la app y se traen al proyecto con
  `adb pull /sdcard/Android/data/<app>/files/.spotfix .spotfix` (o un botón "Compartir").
