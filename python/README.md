# spotfix para Python (pendiente)

Mismo formato de notas que el resto ([../spec/formato.md](../spec/formato.md)).

## Web (Flask, Django, FastAPI)

- Un middleware que, solo con `debug=True` y peticiones desde localhost, inyecta antes de `</body>`
  el mismo overlay del paquete JS (`js/dist/core`, empaquetado en un único archivo) y expone
  `GET/POST/PATCH /__spotfix`.
- `seccion` = ruta de la petición; `archivo_ruta` = función de la vista que la atiende
  (`inspect.getsourcefile` + línea); `componente` = `data-spotfix` o selector CSS.
- Uso previsto: `spotfix.flask(app)`, `spotfix.fastapi(app)`, `'spotfix.django.Middleware'`.

## Escritorio (PySide/Qt, Tkinter)

- Botón flotante propio (QWidget sin marco / Toplevel) que se puede arrastrar.
- Señalar: el widget bajo el ratón (`QApplication.widgetAt`, `winfo_containing`); se guarda su
  `objectName`/clase, la cadena de padres y el archivo:línea donde se creó (capturado al instanciar).
- Captura con `QWidget.grab()` o `PIL.ImageGrab` recortando al widget.
- Solo activo si `__debug__` y la variable `SPOTFIX=1`, o `"enabled"` en `.spotfix/config.json`.
