//! spotfix para egui/eframe: un botón flotante para dejar notas sobre zonas de la app.
//!
//! ```ignore
//! fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
//!     egui::CentralPanel::default().show(ui, |ui| {
//!         spotfix_egui::zone(ui, "Cabecera", |ui| ui.heading("Hola"));
//!     });
//!     spotfix_egui::show!(ui.ctx()); // al final
//! }
//! ```
//!
//! Solo actúa en compilaciones debug. En `--release` todo es un no-op y no dibuja nada.
//! Se apaga sin tocar código con `"enabled": false` en `.spotfix/config.json`.

pub mod format;
pub mod store;
#[cfg(debug_assertions)]
mod ui;

/// Dibuja el botón y los paneles. Llámalo al final de `update`.
/// Guarda las notas en `<CARGO_MANIFEST_DIR del crate que lo llama>/.spotfix`.
#[macro_export]
macro_rules! show {
    ($ctx:expr) => {
        $crate::show_with_root($ctx, env!("CARGO_MANIFEST_DIR"))
    };
}

/// Igual que [`show!`] pero con la raíz del proyecto explícita.
pub fn show_with_root(ctx: &egui::Context, raiz: &str) {
    #[cfg(debug_assertions)]
    ui::show(ctx, raiz);
    #[cfg(not(debug_assertions))]
    let _ = (ctx, raiz);
}

/// Marca una zona con nombre. Al señalarla, la nota guarda el nombre, sus zonas padre y
/// el `archivo:línea` donde se llamó a `zone` (gracias a `#[track_caller]`).
#[track_caller]
pub fn zone<R>(ui: &mut egui::Ui, nombre: &str, contenido: impl FnOnce(&mut egui::Ui) -> R) -> R {
    #[cfg(debug_assertions)]
    {
        ui::zone(ui, nombre, std::panic::Location::caller(), contenido)
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = nombre;
        contenido(ui)
    }
}

/// Nombre de la pantalla actual (la "sección" de las notas). Por defecto, el título de la ventana.
pub fn section(ctx: &egui::Context, nombre: &str) {
    #[cfg(debug_assertions)]
    ui::section(ctx, nombre);
    #[cfg(not(debug_assertions))]
    let _ = (ctx, nombre);
}
