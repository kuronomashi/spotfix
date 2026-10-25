# spotfix

Un botón flotante para dejar notas sobre partes concretas de tu app mientras la pruebas.
Señalas un componente o una zona, escribes qué pasa (o haces una captura) y spotfix lo guarda
en `.spotfix/` en la raíz del proyecto con la fecha, la pantalla, el componente y el
`archivo:línea` del código. Luego copias todo y se lo pegas a la IA: va directa al sitio.

- Solo funciona en desarrollo. En producción / release no aparece y no entra en el bundle.
- Se apaga sin tocar código: `"enabled": false` en `.spotfix/config.json`.
- Las notas son Markdown legible. Formato: [spec/formato.md](spec/formato.md).

  [spec/estetica.md](spec/estetica.md).

## Para la IA: marcar las notas como hechas

Es parte del uso correcto de spotfix. **Cuando la IA resuelve una nota, debe abrir su archivo y
cambiar `estado: "abierta"` por `estado: "hecha"`** (sin borrarla). Las notas hechas desaparecen
de la lista y de "Copiar", así el usuario ve qué falta. Si no pudo resolverla, la deja abierta y
lo explica.

Esto ya se le dice a la IA de dos formas:

- El texto de **Copiar** empieza con esa instrucción.
- `.spotfix/LEEME-IA.md` (lo regenera spotfix) la pone como regla principal.

Si tu proyecto tiene un `CLAUDE.md` o `AGENTS.md`, conviene añadir una línea:
`Al terminar una nota de .spotfix, márcala con estado: "hecha".`

## Ajustes

Desde el engranaje del panel (se guardan en `.spotfix/config.json`, compartido por todas las plataformas):

- **Tema**: Claro, Oscuro o Sistema (sigue al sistema operativo).
- **Carpeta de las notas**: relativa a la raíz del proyecto o absoluta. Por defecto `.spotfix/notas`.
  `config.json` y `LEEME-IA.md` se quedan siempre en `.spotfix/`.

| Plataforma | Estado | Carpeta |
|---|---|---|
| Next.js (App Router) | Lista | [js/](js/) |
| React con Vite | Lista | [js/](js/) |
| React con otro bundler (CRA, webpack…) | Lista (con `npx spotfix serve`) | [js/](js/) |
| Rust egui / eframe | Lista | [rust/spotfix-egui/](rust/spotfix-egui/) |
| Python web y escritorio | Pendiente | [python/](python/) |
| Kotlin Android (Compose) | Pendiente | [kotlin/](kotlin/) |


- **Rust**: en `Cargo.toml`
  ```toml
  spotfix-egui = { git = "https://github.com/kuronomashi/spotfix" }
  ```
  Cargo encuentra el crate aunque esté en `rust/spotfix-egui`. Para fijar una versión: `tag = "v0.1.0"`.
- **JS (Next / React)**: npm no sabe instalar desde una subcarpeta de un repo, así que se publica
  el paquete como archivo de una *Release*:
  1. `cd js && npm install && npm run build && npm pack` → `spotfix-0.1.0.tgz`.
  2. En GitHub: Releases → nueva release `v0.1.0` → adjuntar `spotfix-0.1.0.tgz`.
  3. En cada proyecto:
     ```bash
     npm install https://github.com/kuronomashi/spotfix/releases/download/v0.1.0/spotfix-0.1.0.tgz
     npx spotfix init
     ```
  (Otra opción es `npm publish` desde `js/` y luego `npm install spotfix`.)

`.gitignore` ya deja fuera `target/`, `node_modules/`, `dist/`, `.next/`, `*.tgz` y las notas de las demos.

---

## Next.js

### Instalar

```bash
npm install <ruta o URL de spotfix-0.1.0.tgz>
npx spotfix init
```

`init` hace dos cambios y crea la carpeta de notas:

1. `app/layout.tsx`: añade `import { Spotfix } from 'spotfix/react'` y `<Spotfix />` antes de `</body>`.
2. Crea `app/api/spotfix/route.ts` con `export { GET, POST, PATCH } from 'spotfix/next';`
3. Crea `.spotfix/` (con `config.json` y `LEEME-IA.md`) y pregunta si añadirla a `.gitignore`.

Arranca `next dev`: el botón sale abajo a la derecha. Se arrastra a donde quieras y recuerda la posición.

> Si usas Turbopack y enlazas el paquete desde otra carpeta (`file:`), añade
> `turbopack: { root: '<carpeta que contenga ambos>' }` en `next.config`. Ver `examples/next-demo`.

### Qué se guarda

```
seccion:      /productos/2
archivo_ruta: app/productos/[id]/page.tsx       ← resuelve grupos (x) y segmentos [id]
componente:   ProductCard < Producto < RootLayout
fuente:       components/ProductCard.tsx:5      ← dónde se define el componente
selector:     div.card > h3
capturas:     img/2026-10-24T18-11-52_raiz_productcard_1.png
```
### Seguridad

La ruta `/api/spotfix` responde 404 salvo que se cumpla todo esto: `NODE_ENV === 'development'`,
host y origen `localhost`, cabecera `x-spotfix: 1` en escrituras (bloquea formularios de otras webs)
y `enabled: true`. Solo escribe en `.spotfix/` y en la carpeta de notas elegida en Ajustes, con
nombres saneados, máximo 5 capturas PNG/JPEG de 5 MB. Desde el navegador no se puede apagar
spotfix (solo con `npx spotfix off`). En `next build` el código que toca el disco y el del botón se
eliminan.

### Apagar o quitar

```bash
npx spotfix off       
npx spotfix remove   
npm uninstall spotfix
npx spotfix status   
npx spotfix copy      
```

Las notas nunca se borran. Si a la IA le dices "quita spotfix", `.spotfix/LEEME-IA.md` le dice cómo.

---

## React

El mismo paquete. La interfaz y el formato de las notas son iguales que en Next; la sección es la
ruta actual (`location.pathname`, vale con React Router).

### Con Vite (lo normal)

```bash
npm install <ruta o URL de spotfix-0.1.0.tgz>
npx spotfix init
npm run dev
```

`init` detecta `vite.config.*` y hace dos cambios:

1. `vite.config.ts`: `import spotfix from 'spotfix/vite'` y `spotfix()` en `plugins`. El plugin sirve
   `/api/spotfix` solo con `vite` (dev); en `vite build` no existe.
2. `src/main.tsx`: `import 'spotfix/auto';`, que monta el botón sin tocar tus componentes.
   Si prefieres el componente: `import { Spotfix } from 'spotfix/react'` y `<Spotfix />` donde quieras.

En `vite build` el botón y su código no entran en el bundle. `npx spotfix remove` deshace los dos cambios.

### Con otro bundler (CRA, webpack, Parcel…)

Arranca el servidor de spotfix aparte, en la raíz del proyecto, mientras desarrollas:

```bash
npx spotfix serve          
```

y monta el componente apuntando a él:

```tsx
import { Spotfix } from 'spotfix/react';
<Spotfix endpoint="http://localhost:5179/api/spotfix" />
```

Solo acepta peticiones de `localhost`. Si tu bundler no define `process.env.NODE_ENV`, el botón no aparece.

---

## Rust egui / eframe

### Instalar

```toml
[dependencies]
spotfix-egui = { path = "F:/Librerias kuronoma/spotfix/rust/spotfix-egui" }
```

### Uso

```rust
impl eframe::App for MiApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        spotfix_egui::section(ui.ctx(), "Ajustes");           // opcional: nombre de la pantalla

        egui::CentralPanel::default().show(ui, |ui| {
            spotfix_egui::zone(ui, "Cabecera", |ui| {         // opcional: zonas con nombre
                ui.heading("Ajustes");
            });
        });

        spotfix_egui::show!(ui.ctx());                        // al final
    }
}
```

- `show!` dibuja el botón y guarda en `<CARGO_MANIFEST_DIR>/.spotfix` (o en la carpeta de Ajustes).
- Mismo panel que en web: pestañas Nota | Almacenadas, ajustes (tema y carpeta) y scroll.
  Los colores solo se aplican a las ventanas de spotfix; tu app no cambia.
- `zone` marca una zona; al señalarla, la nota guarda `Cabecera < Panel` (zonas anidadas) y el
  `archivo:línea` exacto de la llamada (`#[track_caller]`), sin configurar nada.
- Sin zonas también funciona: arrastras un rectángulo sobre la ventana.
- Capturas de la zona o de la ventana entera (spotfix se oculta durante la captura).
- `section` da nombre a la pantalla; si no, se usa el título de la ventana.
- En `--release` todas las funciones son no-op. Para apagarlo en debug: `"enabled": false` en config.json.
- Para el dictado usa el de Windows (Win+H) dentro del cuadro de texto.

Para quitarlo: borra la dependencia y las llamadas `spotfix_egui::…`.

---

## Ejemplos

- `examples/next-demo`: `npm install && npm run dev`
- `examples/react-vite-demo`: `npm install && npm run dev` (necesita el `.tgz` de `js/`: `npm pack` allí)
- `examples/egui-demo`: `cargo run` (con botón) / `cargo run --release` (sin botón)
