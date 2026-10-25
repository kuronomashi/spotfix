// Demo de spotfix-egui: `cargo run` (debug) muestra el botón; `cargo run --release` no.

use eframe::egui;

fn main() -> eframe::Result {
    let opciones = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("spotfix demo")
            .with_position([100.0, 100.0])
            .with_inner_size([900.0, 600.0]),
        ..Default::default()
    };
    eframe::run_native("spotfix demo", opciones, Box::new(|_cc| Ok(Box::new(Demo::default()))))
}

#[derive(Default)]
struct Demo {
    nombre: String,
    pestana: usize,
    contador: u32,
    oscuro: bool,
}

impl eframe::App for Demo {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let seccion = ["Inicio", "Ajustes"][self.pestana];
        spotfix_egui::section(ui.ctx(), seccion);

        egui::Panel::left("menu").show(ui, |ui| {
            spotfix_egui::zone(ui, "Menú lateral", |ui| {
                ui.heading("Mi app");
                ui.selectable_value(&mut self.pestana, 0, "Inicio");
                ui.selectable_value(&mut self.pestana, 1, "Ajustes");
            });
        });

        egui::CentralPanel::default().show(ui, |ui| {
            spotfix_egui::zone(ui, "Cabecera", |ui| {
                ui.heading(seccion);
                ui.label("Pantalla de ejemplo para probar spotfix.");
            });
            ui.separator();
            if self.pestana == 0 {
                spotfix_egui::zone(ui, "Formulario de saludo", |ui| {
                    ui.horizontal(|ui| {
                        ui.label("Nombre:");
                        ui.text_edit_singleline(&mut self.nombre);
                    });
                    if ui.button("Saludar").clicked() {
                        self.contador += 1;
                    }
                    ui.label(format!("Hola {} ({} veces)", self.nombre, self.contador));
                });
            } else {
                spotfix_egui::zone(ui, "Opciones", |ui| {
                    ui.checkbox(&mut self.oscuro, "Modo oscuro");
                    ui.label("Más ajustes aquí…");
                });
            }
        });

        spotfix_egui::show!(ui.ctx());
    }
}
