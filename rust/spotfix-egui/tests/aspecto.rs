// Capturas del aspecto en claro y oscuro (necesita GPU o WARP). No corre por defecto:
//   SPOTFIX_CAPTURAS=<carpeta> cargo test --test aspecto -- --ignored
#![cfg(debug_assertions)]

use egui_kittest::kittest::Queryable;
use egui_kittest::Harness;
use std::path::PathBuf;

fn app(raiz: String) -> impl FnMut(&mut egui::Ui) {
    move |ui| {
        spotfix_egui::section(ui.ctx(), "Inicio");
        egui::CentralPanel::default().show(ui, |ui| {
            spotfix_egui::zone(ui, "Panel", |ui| {
                spotfix_egui::zone(ui, "Cabecera", |ui| {
                    ui.heading("Hola desde la cabecera");
                });
                ui.label("Pantalla de ejemplo para ver spotfix.");
            });
        });
        spotfix_egui::show_with_root(ui.ctx(), &raiz);
    }
}

#[test]
#[ignore]
fn capturas() {
    let destino = PathBuf::from(std::env::var("SPOTFIX_CAPTURAS").expect("define SPOTFIX_CAPTURAS"));
    std::fs::create_dir_all(&destino).unwrap();
    for tema in ["claro", "oscuro"] {
        let raiz = std::env::temp_dir().join(format!("spotfix-aspecto-{tema}-{}", std::process::id()));
        std::fs::create_dir_all(raiz.join(".spotfix")).unwrap();
        std::fs::write(raiz.join(".spotfix/config.json"), format!(r#"{{ "enabled": true, "tema": "{tema}" }}"#)).unwrap();
        let mut h = Harness::builder()
            .with_size(egui::Vec2::new(900.0, 640.0))
            .with_theme(if tema == "oscuro" { egui::Theme::Dark } else { egui::Theme::Light })
            .wgpu()
            .build_ui(app(raiz.to_string_lossy().into_owned()));
        let foto = |h: &mut Harness<'_>, nombre: &str| {
            h.render().unwrap().save(destino.join(format!("{tema}-{nombre}.png"))).unwrap();
        };
        h.run();
        foto(&mut h, "boton");
        h.get_by_label("spotfix").click();
        h.run();
        foto(&mut h, "menu");
        h.get_by_label("Señalar zona").click();
        h.run();
        let c = h.get_by_label("Hola desde la cabecera").rect().center();
        h.hover_at(c);
        h.run();
        foto(&mut h, "senalar");
        h.drag_at(c);
        h.drop_at(c);
        h.run();
        let t = h.get_by_role(egui::accesskit::Role::MultilineTextInput);
        t.focus();
        t.type_text("El título se corta en pantallas pequeñas");
        h.run();
        foto(&mut h, "nota");
        h.get_by_label("Guardar").click();
        h.run();
        h.get_by_label("spotfix").click();
        h.run();
        h.get_by_label("Notas almacenadas").click();
        h.run();
        foto(&mut h, "notas");
        // Muchas notas para ver el scroll y una casilla marcada.
        let store = spotfix_egui::store::Store::new(&raiz);
        for i in 1..=8 {
            store
                .guardar(spotfix_egui::store::NuevaNota {
                    tipo: if i % 2 == 0 { "bug".into() } else { "sugerencia".into() },
                    texto: format!("Nota de prueba {i} para revisar el scroll de la lista."),
                    seccion: "Inicio".into(),
                    componente: Some("Cabecera < Panel".into()),
                    fuente: Some("tests/aspecto.rs:14".into()),
                    selector: None,
                    ventana: None,
                    capturas: vec![],
                })
                .unwrap();
        }
        h.get_by_label("Ver hechas").click();
        h.run();
        h.get_by_label("Nota").click();
        h.run();
        h.get_by_label("Almacenadas").click();
        h.run();
        foto(&mut h, "almacenadas-muchas");
        h.get_by_label("Ajustes").click();
        h.run();
        foto(&mut h, "ajustes");
    }
}
