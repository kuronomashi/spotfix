// Recorre la interfaz sin ventana: botón → señalar zona → escribir → guardar → listar → copiar.
#![cfg_attr(not(debug_assertions), allow(unused))]

use egui::accesskit::Role;
use egui_kittest::kittest::Queryable;
use egui_kittest::Harness;
use std::path::PathBuf;

fn carpeta_temporal(nombre: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("spotfix-flujo-{nombre}-{}", std::process::id()));
    std::fs::create_dir_all(&p).unwrap();
    p
}

fn clic(h: &Harness<'_>, pos: egui::Pos2) {
    h.hover_at(pos);
    h.drag_at(pos);
    h.drop_at(pos);
}

fn app(raiz: String) -> impl FnMut(&mut egui::Ui) {
    move |ui| {
        spotfix_egui::section(ui.ctx(), "Inicio");
        egui::CentralPanel::default().show(ui, |ui| {
            spotfix_egui::zone(ui, "Panel", |ui| {
                spotfix_egui::zone(ui, "Cabecera", |ui| {
                    ui.heading("Hola desde la cabecera");
                });
                ui.label("Otro contenido");
            });
        });
        spotfix_egui::show_with_root(ui.ctx(), &raiz);
    }
}

#[cfg(not(debug_assertions))]
#[test]
fn en_release_no_hay_boton() {
    let raiz = carpeta_temporal("release");
    let mut h = Harness::builder()
        .with_size(egui::Vec2::new(800.0, 600.0))
        .build_ui(app(raiz.to_string_lossy().into_owned()));
    h.run();
    assert!(h.query_by_label("spotfix").is_none());
    h.get_by_label("Hola desde la cabecera");
}

#[cfg(debug_assertions)]
#[test]
fn senalar_zona_y_guardar_nota() {
    let raiz = carpeta_temporal("guardar");
    let mut h = Harness::builder()
        .with_size(egui::Vec2::new(800.0, 600.0))
        .build_ui(app(raiz.to_string_lossy().into_owned()));
    h.run();

    h.get_by_label("spotfix").click();
    h.run();
    h.get_by_label("Señalar zona").click();
    h.run();

    let objetivo = h.get_by_label("Hola desde la cabecera").rect().center();
    h.hover_at(objetivo);
    h.run();
    clic(&h, objetivo);
    h.run();

    // El editor muestra la zona más interna con su padre y el archivo:línea de la llamada.
    h.get_by_label("Cabecera < Panel");
    h.get_by_label("tests/flujo.rs:26");

    let texto = h.get_by_role(Role::MultilineTextInput);
    texto.focus();
    texto.type_text("El título se corta");
    h.run();
    h.get_by_label("Sugerencia").click();
    h.run();
    h.get_by_label("Guardar").click();
    h.run();

    let store = spotfix_egui::store::Store::new(&raiz);
    let notas = store.listar();
    assert_eq!(notas.len(), 1, "debería haber una nota");
    let n = &notas[0];
    assert_eq!(n.texto, "El título se corta");
    assert_eq!(n.tipo, "sugerencia");
    assert_eq!(n.seccion, "Inicio");
    assert_eq!(n.componente.as_deref(), Some("Cabecera < Panel"));
    assert!(n.fuente.as_deref().unwrap().starts_with("tests/flujo.rs:"));
    assert!(n.archivo.starts_with(".spotfix/notas/"));
    assert!(raiz.join(".spotfix/LEEME-IA.md").exists());

    // Lista y copiar.
    h.get_by_label("spotfix").click();
    h.run();
    h.get_by_label("Notas almacenadas").click();
    h.run();
    h.get_by_label("El título se corta");
    h.get_by_label("Copiar para la IA").click();
    h.step();
    let copiado = h
        .output()
        .platform_output
        .commands
        .iter()
        .find_map(|c| match c {
            egui::OutputCommand::CopyText(t) => Some(t.clone()),
            _ => None,
        });
    let copiado = copiado.expect("no se copió nada");
    assert!(copiado.contains("### Inicio"));
    assert!(copiado.contains("**Cabecera < Panel**"));

    // Marcar como hecha desde la lista.
    h.get_by_label("Hecha").click();
    h.run();
    assert_eq!(store.listar()[0].estado, "hecha");
}

#[test]
fn apagado_por_config_no_dibuja_nada() {
    let raiz = carpeta_temporal("apagado");
    std::fs::create_dir_all(raiz.join(".spotfix")).unwrap();
    std::fs::write(raiz.join(".spotfix/config.json"), r#"{ "enabled": false }"#).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::Vec2::new(800.0, 600.0))
        .build_ui(app(raiz.to_string_lossy().into_owned()));
    h.run();
    assert!(h.query_by_label("spotfix").is_none());
}

#[cfg(debug_assertions)]
#[test]
fn rectangulo_arrastrado_sin_zona() {
    let raiz = carpeta_temporal("rect");
    let mut h = Harness::builder()
        .with_size(egui::Vec2::new(800.0, 600.0))
        .build_ui(app(raiz.to_string_lossy().into_owned()));
    h.run();
    h.get_by_label("spotfix").click();
    h.run();
    h.get_by_label("Señalar zona").click();
    h.run();
    let (a, b) = (egui::pos2(500.0, 300.0), egui::pos2(650.0, 420.0));
    h.hover_at(a);
    h.drag_at(a);
    h.run();
    for i in 1..=5 {
        h.hover_at(a + (b - a) * (i as f32 / 5.0));
        h.run();
    }
    h.drop_at(b);
    h.run();
    h.get_by_label_contains("rect");
    let texto = h.get_by_role(Role::MultilineTextInput);
    texto.focus();
    texto.type_text("Aquí falta espacio");
    h.run();
    h.get_by_label("Guardar").click();
    h.run();
    let notas = spotfix_egui::store::Store::new(&raiz).listar();
    assert_eq!(notas.len(), 1);
    assert!(notas[0].selector.as_deref().unwrap().starts_with("rect x=500 y=300 150x120"));
}
