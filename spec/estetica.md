# Estética base de spotfix

Todas las plataformas usan estos valores, para que spotfix se vea igual en Next, egui, Python o
Android. Inspirada en interfaces cálidas tipo Claude: fondos crema / carbón, bordes finos,
esquinas redondeadas y un único color de acento (amarillo).

## Logo

Un círculo de color sólido **`#F5A623`** (amarillo tirando a naranja, sin degradado ni sombras)
con el icono de esquinas en blanco, al 45 % del diámetro. El cuadro de arriba a la derecha del
icono tiene un hueco por el que se ve el fondo. Es el botón flotante y sale en los avisos. Al pasar
el ratón o con el panel abierto solo crece un poco (×1.08).

Icono (512×512, contenido de 64 a 448, `fill-rule: evenodd`):

```
M448 320v128H320v-42.667h85.333V320zm-341.333 0v85.333H192V448H64V320zM64 64v128h42.667v-85.333H192V64zm384 0v128H320V64zm-42.667 42.667h-42.666v42.666h42.666z
```

Logo completo:

```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="12" fill="#F5A623"/>
  <path fill="#FFFFFF" fill-rule="evenodd" transform="translate(12 12) scale(.028) translate(-256 -256)"
        d="M448 320v128H320v-42.667h85.333V320zm-341.333 0v85.333H192V448H64V320zM64 64v128h42.667v-85.333H192V64zm384 0v128H320V64zm-42.667 42.667h-42.666v42.666h42.666z"/>
</svg>
```

## Colores

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `fondo` | `#FAF9F5` | `#262624` | Ventana / panel |
| `superficie` | `#FFFFFF` | `#2C2B28` | Cuadros de texto, tarjetas |
| `hundido` | `#F0EDE6` | `#30302D` | Zonas secundarias, controles segmentados |
| `borde` | `#E5E1D8` | `#3A3936` | Bordes y separadores |
| `texto` | `#2B2A27` | `#ECE9E2` | Texto principal |
| `tenue` | `#7A776F` | `#9B978E` | Texto secundario, pistas |
| `acento` | `#E2A82B` | `#F2C14E` | Botón principal, foco, resaltado |
| `acento-texto` | `#2B2A27` | `#1F1E1C` | Texto sobre el acento |
| `bug` | `#C8553D` | `#E07A62` | Etiqueta bug |
| `sugerencia` | `#4A7FB5` | `#6FA3D6` | Etiqueta sugerencia |

## Forma

- Panel: radio 14 px, borde 1 px `borde`, sombra suave, ancho 400 px, altura máxima 640 px (o lo
  que quepa en la ventana). Cabecera y pie fijos; el cuerpo hace scroll si no cabe.
- Cabecera: control segmentado `Nota | Almacenadas` · a la derecha engranaje (ajustes) y ×.
  Separador de 1 px debajo. Sin logo ni indicador de estado: errores y confirmaciones salen como
  aviso flotante arriba.
- Almacenadas: filtros (`Esta sección | Todas`, `Ver hechas`) y botón de copiar fijos; la lista
  hace scroll (máx. 360 px).
- Casillas: cuadro de 16 px con radio 5; vacía, fondo `superficie` y borde `borde-fuerte` (`acento`
  al pasar el ratón); marcada, fondo `acento` y check blanco.
- Cuadros de texto: radio 10 px, fondo `superficie`, borde `borde`; con foco, borde `acento`.
- Botón principal: fondo `acento`, texto `acento-texto`, radio 8 px. Secundarios: fondo `hundido`.
- Pie: texto centrado de 11 px en `tenue` con dónde se guardan las notas.
- Tipografía del sistema (Segoe UI / -apple-system), 13 px.

## Ajustes (iguales en todas las plataformas)

Se guardan en `.spotfix/config.json`:

```json
{ "enabled": true, "tema": "sistema", "carpeta": ".spotfix/notas" }
```

- `tema`: `claro`, `oscuro` o `sistema`.
- `carpeta`: dónde se guardan las notas; relativa a la raíz del proyecto o absoluta.
  `config.json` y `LEEME-IA.md` se quedan siempre en `.spotfix/` para que la IA los encuentre.
