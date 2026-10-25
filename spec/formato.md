# Formato de notas de spotfix (v1)

Todas las implementaciones (Next, egui, Python, Kotlin) escriben exactamente este formato, para
que una IA lo lea igual venga de donde venga.

## Carpeta

En la raíz del proyecto anfitrión:

```
.spotfix/
  LEEME-IA.md          instrucciones para la IA (se crea solo)
  config.json          { "enabled": true }
  notas/
    2026-10-24/
      2026-10-24T15-32-10_ajustes-perfil_header.md
      img/
        2026-10-24T15-32-10_ajustes-perfil_header_1.png
```

- Una subcarpeta por día (`AAAA-MM-DD`, fecha local de quien escribe la nota).
- Nombre del archivo: `<fecha-hora local con guiones>_<slug sección>_<slug componente>.md`.
  Si ya existe, se añade `-2`, `-3`…
- Las capturas van en `img/` del mismo día, con el mismo nombre base y `_1`, `_2`…

## Nota

Cabecera tipo YAML entre `---`. Cada valor es un literal JSON (cadena entre comillas, número,
`null` o lista), así que es YAML válido y se lee sin ambigüedad. Después, el texto del usuario.

```markdown
---
id: "20261024-153210-a1b2"
fecha: "2026-10-24T15:32:10-05:00"
tipo: "bug"
estado: "abierta"
plataforma: "next"
seccion: "/ajustes/perfil"
archivo_ruta: "app/ajustes/perfil/page.tsx"
componente: "Header < PerfilLayout"
fuente: "components/Header.tsx:12"
selector: "header.top > nav"
texto_visible: "Mi perfil  Cerrar sesión"
ventana: "1440x900"
url: "http://localhost:3000/ajustes/perfil"
capturas: ["img/2026-10-24T15-32-10_ajustes-perfil_header_1.png"]
---

El botón de cerrar sesión se sale del header en pantallas pequeñas.
```

| Campo | Obligatorio | Significado |
|---|---|---|
| `id` | sí | Único. `AAAAMMDD-HHMMSS-xxxx`. |
| `fecha` | sí | ISO 8601 con zona horaria. |
| `tipo` | sí | `bug` o `sugerencia`. |
| `estado` | sí | `abierta` o `hecha`. La IA puede cambiarlo a `hecha` al resolverla. |
| `plataforma` | sí | `next`, `egui`, `python-web`, `python-qt`, `python-tk`, `android`. |
| `seccion` | sí | Pantalla donde estaba el usuario: ruta web, nombre de ventana o pantalla. |
| `archivo_ruta` | no | Archivo que define esa pantalla (p. ej. `app/x/page.tsx`). |
| `componente` | no | Componente señalado y sus padres, del más interno al más externo, con ` < `. |
| `fuente` | no | `ruta/relativa:línea` donde está el código del componente. |
| `selector` | no | Selector CSS corto (web) o id del widget. |
| `texto_visible` | no | Texto que se veía dentro del elemento (máx. 200 caracteres). |
| `ventana` | no | `anchoxalto` de la ventana. |
| `url` | no | URL completa (web). |
| `capturas` | no | Rutas relativas a la carpeta del día. |

## Texto para copiar a la IA

"Copiar" agrupa por día y luego por sección:

```markdown
# Notas de spotfix

## 2026-10-24

### /ajustes/perfil  (app/ajustes/perfil/page.tsx)

- [bug] **Header < PerfilLayout** — `components/Header.tsx:12`
  El botón de cerrar sesión se sale del header en pantallas pequeñas.
  Captura: .spotfix/notas/2026-10-24/img/2026-10-24T15-32-10_ajustes-perfil_header_1.png
```

Por defecto solo se copian las notas `abierta`.
