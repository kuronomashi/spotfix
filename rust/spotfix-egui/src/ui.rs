//! Interfaz de spotfix en egui. Solo se compila en debug. Estética: spec/estetica.md.
//! Los colores se aplican solo dentro de las ventanas de spotfix; la app no se toca.

use crate::format::{compile_markdown, Note};
use crate::store::{Config, NuevaNota, Store, Tema};
use egui::{
    Align, Align2, Area, Color32, ColorImage, Context, CornerRadius, FontId, Frame, Id, Key, Layout, Margin, Order,
    Pos2, Rect, Role, Sense, Shadow, Stroke, StrokeKind, TextureHandle, Ui, Vec2, WidgetInfo,
};
use std::panic::Location;
use std::sync::{Arc, Mutex};

const TAM: f32 = 40.0;
const ANCHO_PANEL: f32 = 400.0;
const MAX_CAPTURAS: usize = 5;

// ---------------------------------------------------------------- paleta

#[derive(Clone, Copy)]
struct Paleta {
    oscuro: bool,
    fondo: Color32,
    superficie: Color32,
    hundido: Color32,
    borde: Color32,
    borde_fuerte: Color32,
    texto: Color32,
    tenue: Color32,
    acento: Color32,
    acento_texto: Color32,
    bug: Color32,
    sug: Color32,
}

const fn rgb(r: u8, g: u8, b: u8) -> Color32 {
    Color32::from_rgb(r, g, b)
}

const CLARO: Paleta = Paleta {
    oscuro: false,
    fondo: rgb(0xFA, 0xF9, 0xF5),
    superficie: rgb(0xFF, 0xFF, 0xFF),
    hundido: rgb(0xF0, 0xED, 0xE6),
    borde: rgb(0xE5, 0xE1, 0xD8),
    borde_fuerte: rgb(0xD6, 0xD1, 0xC6),
    texto: rgb(0x2B, 0x2A, 0x27),
    tenue: rgb(0x7A, 0x77, 0x6F),
    acento: rgb(0xE2, 0xA8, 0x2B),
    acento_texto: rgb(0x2B, 0x2A, 0x27),
    bug: rgb(0xC8, 0x55, 0x3D),
    sug: rgb(0x4A, 0x7F, 0xB5),
};

const OSCURO: Paleta = Paleta {
    oscuro: true,
    fondo: rgb(0x26, 0x26, 0x24),
    superficie: rgb(0x2C, 0x2B, 0x28),
    hundido: rgb(0x30, 0x30, 0x2D),
    borde: rgb(0x3A, 0x39, 0x36),
    borde_fuerte: rgb(0x4A, 0x49, 0x45),
    texto: rgb(0xEC, 0xE9, 0xE2),
    tenue: rgb(0x9B, 0x97, 0x8E),
    acento: rgb(0xF2, 0xC1, 0x4E),
    acento_texto: rgb(0x1F, 0x1E, 0x1C),
    bug: rgb(0xE0, 0x7A, 0x62),
    sug: rgb(0x6F, 0xA3, 0xD6),
};

fn paleta(ctx: &Context, tema: Tema) -> Paleta {
    let oscuro = match tema {
        Tema::Claro => false,
        Tema::Oscuro => true,
        Tema::Sistema => ctx.system_theme().map_or(ctx.theme() == egui::Theme::Dark, |t| t == egui::Theme::Dark),
    };
    if oscuro { OSCURO } else { CLARO }
}

/// Visuals locales para los widgets de spotfix.
fn aplicar(ui: &mut Ui, p: &Paleta) {
    let v = ui.visuals_mut();
    v.dark_mode = p.oscuro;
    v.override_text_color = Some(p.texto);
    v.extreme_bg_color = p.superficie;
    v.text_edit_bg_color = Some(p.superficie);
    v.faint_bg_color = p.hundido;
    v.panel_fill = p.fondo;
    v.window_fill = p.fondo;
    v.selection.bg_fill = p.acento.gamma_multiply(0.35);
    v.selection.stroke = Stroke::new(1.5, p.acento);
    v.hyperlink_color = p.acento;
    let r = CornerRadius::same(8);
    let w = &mut v.widgets;
    w.noninteractive.bg_stroke = Stroke::new(1.0, p.borde);
    w.noninteractive.fg_stroke = Stroke::new(1.0, p.texto);
    w.noninteractive.corner_radius = r;
    for (estado, borde) in [(&mut w.inactive, p.borde), (&mut w.hovered, p.borde_fuerte), (&mut w.active, p.acento)] {
        estado.bg_fill = p.hundido;
        estado.weak_bg_fill = p.hundido;
        estado.bg_stroke = Stroke::new(1.0, borde);
        estado.fg_stroke = Stroke::new(1.0, p.texto);
        estado.corner_radius = r;
        estado.expansion = 0.0;
    }
    w.open = w.active;
    ui.spacing_mut().item_spacing = Vec2::new(8.0, 8.0);
    ui.spacing_mut().button_padding = Vec2::new(12.0, 6.0);
}

fn sombra(p: &Paleta) -> Shadow {
    Shadow {
        offset: [0, 8],
        blur: 28,
        spread: 0,
        color: if p.oscuro { Color32::from_black_alpha(110) } else { Color32::from_black_alpha(36) },
    }
}

// ---------------------------------------------------------------- dibujo

const COLOR_LOGO: Color32 = rgb(0xF5, 0xA6, 0x23);

/// El logo: círculo de color sólido con el icono de esquinas en blanco al 45 % (spec/estetica.md).
fn dibujar_punto(p: &egui::Painter, c: Pos2, lado: f32) {
    p.circle_filled(c, lado / 2.0, COLOR_LOGO);
    // El icono está en coordenadas 512×512 (contenido 64..448, 384 de lado).
    let u = lado * 0.45 / 384.0;
    let a = |x: f32, y: f32| c + Vec2::new(x - 256.0, y - 256.0) * u;
    let r = |x0: f32, y0: f32, x1: f32, y1: f32| Rect::from_min_max(a(x0, y0), a(x1, y1));
    let g = 42.667; // grosor de los trazos
    for rect in [
        // Esquinas en L: abajo derecha, abajo izquierda, arriba izquierda.
        r(448.0 - g, 320.0, 448.0, 448.0),
        r(320.0, 448.0 - g, 448.0 - g, 448.0),
        r(64.0, 320.0, 64.0 + g, 448.0),
        r(64.0 + g, 448.0 - g, 192.0, 448.0),
        r(64.0, 64.0, 64.0 + g, 192.0),
        r(64.0 + g, 64.0, 192.0, 64.0 + g),
        // Cuadro de arriba a la derecha.
        r(320.0, 64.0, 448.0, 192.0),
    ] {
        p.rect_filled(rect, CornerRadius::ZERO, Color32::WHITE);
    }
    // Hueco del cuadro: deja ver el fondo.
    p.rect_filled(r(362.667, 106.667, 405.333, 149.333), CornerRadius::ZERO, COLOR_LOGO);
}

fn icono_cerrar(p: &egui::Painter, c: Pos2, color: Color32) {
    let d = 4.5;
    let s = Stroke::new(1.6, color);
    p.line_segment([c + Vec2::new(-d, -d), c + Vec2::new(d, d)], s);
    p.line_segment([c + Vec2::new(-d, d), c + Vec2::new(d, -d)], s);
}

fn icono_ajustes(p: &egui::Painter, c: Pos2, color: Color32) {
    let s = Stroke::new(1.6, color);
    p.circle_stroke(c, 3.0, s);
    for i in 0..8 {
        let a = i as f32 * std::f32::consts::TAU / 8.0;
        let d = Vec2::angled(a);
        p.line_segment([c + d * 5.0, c + d * 7.2], Stroke::new(2.2, color));
    }
    p.circle_stroke(c, 5.4, Stroke::new(1.4, color));
}

/// Botón de icono 28×28 con fondo al pasar el ratón.
fn boton_icono(ui: &mut Ui, pal: &Paleta, etiqueta: &str, activo: bool, dibujar: impl Fn(&egui::Painter, Pos2, Color32)) -> bool {
    let (_, rect) = ui.allocate_space(Vec2::splat(28.0));
    let resp = ui.interact(rect, ui.scope_id().with(("spotfix-icono", etiqueta)), Sense::click());
    resp.widget_info(|| WidgetInfo::labeled(Role::Button, true, etiqueta));
    let resp = resp.on_hover_text(etiqueta);
    if resp.hovered() || activo {
        ui.painter().rect_filled(rect, CornerRadius::same(7), pal.hundido);
    }
    let color = if resp.hovered() || activo { pal.texto } else { pal.tenue };
    dibujar(ui.painter(), rect.center(), color);
    resp.clicked()
}

/// Control segmentado. Devuelve true si cambió.
fn segmentado<T: PartialEq + Copy>(ui: &mut Ui, pal: &Paleta, actual: &mut T, opciones: &[(T, &str, Option<Color32>)], ancho: Option<f32>) -> bool {
    let mut cambio = false;
    Frame::NONE
        .fill(pal.hundido)
        .stroke(Stroke::new(1.0, pal.borde))
        .corner_radius(CornerRadius::same(9))
        .inner_margin(Margin::same(3))
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.x = 2.0;
            ui.horizontal(|ui| {
                let fuente = FontId::proportional(12.5);
                let cada = ancho.map(|w| (w - 6.0 - 2.0 * (opciones.len() as f32 - 1.0)) / opciones.len() as f32);
                for (valor, texto, color) in opciones {
                    let galley = ui.painter().layout_no_wrap(texto.to_string(), fuente.clone(), pal.texto);
                    let w = cada.unwrap_or(galley.size().x + 22.0);
                    let (_, rect) = ui.allocate_space(Vec2::new(w, 24.0));
                    let resp = ui.interact(rect, ui.scope_id().with(("spotfix-seg", *texto)), Sense::click());
                    let elegido = *actual == *valor;
                    resp.widget_info(|| WidgetInfo::selected(Role::Button, true, elegido, *texto));
                    if elegido {
                        ui.painter().rect_filled(rect, CornerRadius::same(6), if pal.oscuro { pal.borde } else { pal.superficie });
                    }
                    let tinta = match (elegido, color) {
                        (true, Some(c)) => *c,
                        (true, None) => pal.texto,
                        _ if resp.hovered() => pal.texto,
                        _ => pal.tenue,
                    };
                    ui.painter().text(rect.center(), Align2::CENTER_CENTER, *texto, FontId::proportional(12.5), tinta);
                    if resp.clicked() && !elegido {
                        *actual = *valor;
                        cambio = true;
                    }
                }
            });
        });
    cambio
}

/// Tono de un mensaje del panel. Solo los errores y las confirmaciones se muestran (como aviso).
#[derive(Clone, Copy, PartialEq)]
enum Tono {
    Ok,
    Ocupado,
    Error,
}

/// Casilla propia: cuadro redondeado; marcada, fondo de acento con check blanco. Devuelve true si cambió.
fn casilla(ui: &mut Ui, pal: &Paleta, valor: &mut bool, texto: &str) -> bool {
    let galley = ui.painter().layout_no_wrap(texto.to_string(), FontId::proportional(12.0), pal.tenue);
    let tam = Vec2::new(16.0 + 6.0 + galley.size().x, 18.0_f32.max(galley.size().y));
    let (rect, resp) = ui.allocate_exact_size(tam, Sense::click());
    resp.widget_info(|| WidgetInfo::selected(Role::CheckBox, true, *valor, texto));
    if resp.clicked() {
        *valor = !*valor;
    }
    let caja = Rect::from_center_size(Pos2::new(rect.left() + 8.0, rect.center().y), Vec2::splat(16.0));
    let p = ui.painter();
    if *valor {
        p.rect_filled(caja, CornerRadius::same(5), pal.acento);
        let s = Stroke::new(2.0, Color32::WHITE);
        let a = caja.left_top();
        p.line_segment([a + Vec2::new(4.2, 8.3), a + Vec2::new(7.0, 11.0)], s);
        p.line_segment([a + Vec2::new(7.0, 11.0), a + Vec2::new(12.0, 5.2)], s);
    } else {
        let borde = if resp.hovered() { pal.acento } else { pal.borde_fuerte };
        p.rect(caja, CornerRadius::same(5), pal.superficie, Stroke::new(1.5, borde), StrokeKind::Inside);
    }
    p.galley(Pos2::new(caja.right() + 6.0, rect.center().y - galley.size().y / 2.0), galley, pal.tenue);
    resp.clicked()
}

fn boton(ui: &mut Ui, pal: &Paleta, texto: &str, primario: bool) -> bool {
    let rt = egui::RichText::new(texto).size(12.5);
    let b = if primario {
        egui::Button::new(rt.color(pal.acento_texto).strong()).fill(pal.acento).stroke(Stroke::new(1.0, pal.acento))
    } else {
        egui::Button::new(rt.color(pal.texto)).fill(pal.hundido).stroke(Stroke::new(1.0, pal.borde))
    };
    ui.add(b.corner_radius(CornerRadius::same(8)).min_size(Vec2::new(0.0, 30.0))).clicked()
}

/// Fila alineada a la derecha de altura fija. `with_layout` tomaría toda la altura libre
/// y estiraría la ventana.
fn a_la_derecha<R>(ui: &mut Ui, contenido: impl FnOnce(&mut Ui) -> R) -> R {
    let tam = Vec2::new(ui.available_width(), 20.0);
    ui.allocate_ui_with_layout(tam, Layout::right_to_left(Align::Center), contenido).inner
}

fn tarjeta(pal: &Paleta, fill: Color32) -> Frame {
    Frame::NONE
        .fill(fill)
        .stroke(Stroke::new(1.0, pal.borde))
        .corner_radius(CornerRadius::same(10))
        .inner_margin(Margin::symmetric(11, 9))
}

// ---------------------------------------------------------------- estado

#[derive(Clone)]
struct Zona {
    nombre: String,
    rect: Rect,
    fuente: String,
    /// Zonas que la contienen, de la más cercana a la más lejana.
    padres: Vec<String>,
    pase: u64,
}

#[derive(Clone, Default)]
struct Objetivo {
    rect: Option<Rect>,
    componente: Option<String>,
    fuente: Option<String>,
    selector: Option<String>,
}

struct Imagen {
    ancho: u32,
    alto: u32,
    rgba: Vec<u8>,
    textura: TextureHandle,
}

#[derive(Clone, Copy, PartialEq)]
enum Vista {
    Nota,
    Notas,
    Ajustes,
}

struct Panel {
    vista: Vista,
    obj: Objetivo,
    tipo: &'static str,
    texto: String,
    capturas: Vec<Imagen>,
    /// Mensaje pendiente de mostrar como aviso al terminar el frame.
    aviso: Option<String>,
    notas: Option<Vec<Note>>,
    solo_seccion: bool,
    ver_hechas: bool,
    carpeta: String,
}

impl Panel {
    fn new(vista: Vista, obj: Objetivo, config: &Config) -> Self {
        Self {
            vista,
            obj,
            tipo: "bug",
            texto: String::new(),
            capturas: Vec::new(),
            aviso: None,
            notas: None,
            solo_seccion: true,
            ver_hechas: false,
            carpeta: config.carpeta.clone(),
        }
    }
    /// Como en web: solo los errores y las confirmaciones se avisan; lo transitorio no se muestra.
    fn estado(&mut self, texto: impl Into<String>, tono: Tono) {
        let texto = texto.into();
        if tono == Tono::Error || texto == "Copiado" || texto == "Guardado" {
            self.aviso = Some(texto);
        }
    }
}

type Resultado = Arc<Mutex<Option<Arc<ColorImage>>>>;

enum Captura {
    Nada,
    /// Hay que pedirla en el próximo frame, ya sin la interfaz de spotfix.
    Solicitar { zona: Option<Rect> },
    Esperando { zona: Option<Rect>, resultado: Resultado },
}

struct Estado {
    store: Store,
    config: Config,
    oculto: bool,
    revisado: f64,
    boton: Option<Pos2>,
    menu: bool,
    /// Pase en que se abrió el menú: ese clic no cuenta como "clic fuera".
    menu_desde: u64,
    senalando: bool,
    arrastre: Option<Pos2>,
    zonas: Vec<Zona>,
    pila: Vec<String>,
    seccion: Option<String>,
    panel: Option<Panel>,
    captura: Captura,
    aviso: Option<(String, f64)>,
}

type Compartido = Arc<Mutex<Option<Estado>>>;

fn compartido(ctx: &Context) -> Compartido {
    ctx.data_mut(|d| d.get_temp_mut_or_default::<Compartido>(Id::unique("spotfix-estado")).clone())
}

pub fn section(ctx: &Context, nombre: &str) {
    let c = compartido(ctx);
    let mut g = c.lock().unwrap();
    if let Some(e) = g.as_mut() {
        e.seccion = Some(nombre.to_string());
    } else {
        // show! aún no se llamó: se guarda para cuando se cree el estado.
        ctx.data_mut(|d| d.insert_temp(Id::unique("spotfix-seccion"), nombre.to_string()));
    }
}

pub fn zone<R>(
    ui: &mut egui::Ui,
    nombre: &str,
    lugar: &'static Location<'static>,
    contenido: impl FnOnce(&mut egui::Ui) -> R,
) -> R {
    let c = compartido(ui.ctx());
    let padres = {
        let mut g = c.lock().unwrap();
        g.as_mut().map(|e| {
            let p: Vec<String> = e.pila.iter().rev().cloned().collect();
            e.pila.push(nombre.to_string());
            p
        })
    };
    let r = ui.scope(contenido);
    if let Some(padres) = padres {
        let rect = r.response.rect.intersect(ui.clip_rect());
        let pase = ui.ctx().cumulative_pass_nr();
        let mut g = c.lock().unwrap();
        if let Some(e) = g.as_mut() {
            e.pila.pop();
            e.zonas.push(Zona {
                nombre: nombre.to_string(),
                rect,
                fuente: format!("{}:{}", lugar.file().replace('\\', "/"), lugar.line()),
                padres,
                pase,
            });
        }
    }
    r.inner
}

pub fn show(ctx: &Context, raiz: &str) {
    let c = compartido(ctx);
    let mut g = c.lock().unwrap();
    let e = g.get_or_insert_with(|| {
        let store = Store::new(raiz);
        let config = store.config();
        Estado {
            store,
            config,
            oculto: false,
            revisado: -10.0,
            boton: None,
            menu: false,
            menu_desde: 0,
            senalando: false,
            arrastre: None,
            zonas: Vec::new(),
            pila: Vec::new(),
            seccion: ctx.data(|d| d.get_temp::<String>(Id::unique("spotfix-seccion"))),
            panel: None,
            captura: Captura::Nada,
            aviso: None,
        }
    });

    let ahora = ctx.input(|i| i.time);
    if ahora - e.revisado > 2.0 {
        e.revisado = ahora;
        e.config = e.store.config();
    }
    let pase = ctx.cumulative_pass_nr();
    e.zonas.retain(|z| z.pase + 1 >= pase);
    e.pila.clear();
    if !e.config.enabled || e.oculto {
        return;
    }

    // Captura en curso: este frame no se dibuja nada de spotfix.
    match std::mem::replace(&mut e.captura, Captura::Nada) {
        Captura::Nada => {}
        Captura::Solicitar { zona } => {
            let resultado: Resultado = Default::default();
            let r = resultado.clone();
            let ctx2 = ctx.clone();
            ctx.request_screenshot(move |img| {
                *r.lock().unwrap() = Some(img);
                ctx2.request_repaint();
            });
            e.captura = Captura::Esperando { zona, resultado };
            return;
        }
        Captura::Esperando { zona, resultado } => {
            let img = resultado.lock().unwrap().take();
            match img {
                Some(img) => recibir_captura(ctx, e, &img, zona),
                None => {
                    e.captura = Captura::Esperando { zona, resultado };
                    ctx.request_repaint();
                    return;
                }
            }
        }
    }

    let pal = paleta(ctx, e.config.tema);
    let pantalla = ctx.content_rect();
    let pos = limitar(e.boton.unwrap_or(pantalla.right_bottom() - Vec2::splat(TAM + 20.0)), pantalla);
    e.boton = Some(pos);

    if e.senalando {
        dibujar_senalar(ctx, e, &pal, pantalla);
    } else if let Some(r) = e.panel.as_ref().and_then(|p| (p.vista == Vista::Nota).then_some(p.obj.rect).flatten()) {
        let p = ctx.layer_painter(egui::LayerId::new(Order::Foreground, Id::unique("spotfix-resalte")));
        p.rect(r, CornerRadius::same(4), pal.acento.gamma_multiply(0.14), Stroke::new(2.0, pal.acento), StrokeKind::Outside);
    }

    dibujar_boton(ctx, e, pos);
    if e.menu {
        dibujar_menu(ctx, e, &pal, pos, pantalla);
    }
    if !e.senalando {
        dibujar_panel(ctx, e, &pal, pos, pantalla);
    }

    if let Some((texto, hasta)) = &e.aviso {
        if ahora < *hasta {
            Area::new(Id::unique("spotfix-aviso"))
                .order(Order::Tooltip)
                .anchor(Align2::CENTER_TOP, Vec2::new(0.0, 14.0))
                .interactable(false)
                .show(ctx, |ui| {
                    aplicar(ui, &pal);
                    Frame::NONE
                        .fill(pal.fondo)
                        .stroke(Stroke::new(1.0, pal.borde))
                        .corner_radius(CornerRadius::same(200))
                        .inner_margin(Margin::symmetric(14, 7))
                        .shadow(sombra(&pal))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                let (r, _) = ui.allocate_exact_size(Vec2::splat(16.0), Sense::hover());
                                dibujar_punto(ui.painter(), r.center(), 16.0);
                                ui.label(egui::RichText::new(texto.as_str()).size(12.5));
                            });
                        });
                });
            ctx.request_repaint_after(std::time::Duration::from_millis(200));
        } else {
            e.aviso = None;
        }
    }
}

fn limitar(p: Pos2, pantalla: Rect) -> Pos2 {
    Pos2::new(
        p.x.clamp(pantalla.left() + 4.0, (pantalla.right() - TAM - 4.0).max(pantalla.left() + 4.0)),
        p.y.clamp(pantalla.top() + 4.0, (pantalla.bottom() - TAM - 4.0).max(pantalla.top() + 4.0)),
    )
}

fn avisar(ctx: &Context, e: &mut Estado, texto: impl Into<String>) {
    e.aviso = Some((texto.into(), ctx.input(|i| i.time) + 2.0));
}

fn seccion(ctx: &Context, e: &Estado) -> String {
    e.seccion
        .clone()
        .or_else(|| ctx.input(|i| i.viewport().title.clone()))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "principal".into())
}

fn dibujar_boton(ctx: &Context, e: &mut Estado, pos: Pos2) {
    let activo = e.menu || e.senalando || e.panel.is_some();
    Area::new(Id::unique("spotfix-boton"))
        .order(Order::Tooltip)
        .fixed_pos(pos)
        .show(ctx, |ui| {
            let (rect, resp) = ui.allocate_exact_size(Vec2::splat(TAM), Sense::click_and_drag());
            resp.widget_info(|| WidgetInfo::labeled(Role::Button, true, "spotfix"));
            let p = ui.painter();
            // Igual que en web: solo crece un poco al pasar el ratón o con el panel abierto.
            let lado = if activo || resp.hovered() { TAM * 1.08 } else { TAM };
            dibujar_punto(p, rect.center(), lado);
            if resp.dragged() {
                e.boton = Some(pos + resp.drag_delta());
                e.menu = false;
            } else if resp.clicked() {
                e.menu = !e.menu;
                e.menu_desde = ui.ctx().cumulative_pass_nr();
            }
            resp.on_hover_text("spotfix (arrastra para mover)");
        });
}

const MENU: &[&str] = &[
    "Señalar zona",
    "Nota de esta ventana",
    "Notas almacenadas",
    "-",
    "Copiar esta sección",
    "Copiar todo",
    "-",
    "Ajustes",
    "Ocultar hasta reiniciar",
];

fn dibujar_menu(ctx: &Context, e: &mut Estado, pal: &Paleta, pos: Pos2, pantalla: Rect) {
    let arriba = pos.y > pantalla.center().y;
    let derecha = pos.x > pantalla.center().x;
    let pivote = match (arriba, derecha) {
        (true, true) => Align2::RIGHT_BOTTOM,
        (true, false) => Align2::LEFT_BOTTOM,
        (false, true) => Align2::RIGHT_TOP,
        (false, false) => Align2::LEFT_TOP,
    };
    let ancla = Pos2::new(
        if derecha { pos.x + TAM } else { pos.x },
        if arriba { pos.y - 8.0 } else { pos.y + TAM + 8.0 },
    );
    let mut eleccion = None;
    let resp = Area::new(Id::unique("spotfix-menu"))
        .order(Order::Tooltip)
        .fixed_pos(ancla)
        .pivot(pivote)
        .show(ctx, |ui| {
            aplicar(ui, pal);
            Frame::NONE
                .fill(pal.fondo)
                .stroke(Stroke::new(1.0, pal.borde))
                .corner_radius(CornerRadius::same(12))
                .inner_margin(Margin::same(6))
                .shadow(sombra(pal))
                .show(ui, |ui| {
                    ui.spacing_mut().item_spacing.y = 1.0;
                    for texto in MENU {
                        if *texto == "-" {
                            let (r, _) = ui.allocate_exact_size(Vec2::new(210.0, 9.0), Sense::hover());
                            ui.painter().hline(r.x_range().shrink(6.0), r.center().y, Stroke::new(1.0, pal.borde));
                            continue;
                        }
                        let (r, resp) = ui.allocate_exact_size(Vec2::new(210.0, 32.0), Sense::click());
                        resp.widget_info(|| WidgetInfo::labeled(Role::Button, true, *texto));
                        if resp.hovered() {
                            ui.painter().rect_filled(r, CornerRadius::same(8), pal.hundido);
                        }
                        ui.painter().circle_filled(Pos2::new(r.left() + 16.0, r.center().y), 2.5, if resp.hovered() { pal.acento } else { pal.tenue });
                        ui.painter().text(Pos2::new(r.left() + 30.0, r.center().y), Align2::LEFT_CENTER, *texto, FontId::proportional(13.0), pal.texto);
                        if resp.clicked() {
                            eleccion = Some(*texto);
                        }
                    }
                });
        });
    if resp.response.clicked_elsewhere() && eleccion.is_none() && ctx.cumulative_pass_nr() != e.menu_desde {
        e.menu = false;
    }
    let Some(elegido) = eleccion else { return };
    e.menu = false;
    match elegido {
        "Señalar zona" => {
            e.panel = None;
            e.senalando = true;
            e.arrastre = None;
        }
        "Nota de esta ventana" => e.panel = Some(Panel::new(Vista::Nota, Objetivo::default(), &e.config)),
        "Notas almacenadas" => e.panel = Some(Panel::new(Vista::Notas, Objetivo::default(), &e.config)),
        "Copiar esta sección" | "Copiar todo" => {
            let sec = (elegido == "Copiar esta sección").then(|| seccion(ctx, e));
            ctx.copy_text(compile_markdown(&e.store.listar(), false, sec.as_deref()));
            avisar(ctx, e, "Notas copiadas al portapapeles");
        }
        "Ajustes" => e.panel = Some(Panel::new(Vista::Ajustes, Objetivo::default(), &e.config)),
        "Ocultar hasta reiniciar" => e.oculto = true,
        _ => {}
    }
}

/// La zona más interna bajo el punto (la de menor área).
fn zona_en(zonas: &[Zona], p: Pos2) -> Option<&Zona> {
    zonas
        .iter()
        .rev()
        .filter(|z| z.rect.contains(p))
        .min_by(|a, b| a.rect.area().total_cmp(&b.rect.area()))
}

fn objetivo_de_zona(z: &Zona) -> Objetivo {
    let mut cadena = vec![z.nombre.clone()];
    cadena.extend(z.padres.iter().take(3).cloned());
    Objetivo { rect: Some(z.rect), componente: Some(cadena.join(" < ")), fuente: Some(z.fuente.clone()), selector: None }
}

fn dibujar_senalar(ctx: &Context, e: &mut Estado, pal: &Paleta, pantalla: Rect) {
    if ctx.input(|i| i.key_pressed(Key::Escape)) {
        e.senalando = false;
        e.arrastre = None;
        return;
    }
    let mut elegido: Option<Objetivo> = None;
    Area::new(Id::unique("spotfix-senalar"))
        .order(Order::Foreground)
        .fixed_pos(pantalla.min)
        .show(ctx, |ui| {
            let resp = ui.allocate_response(pantalla.size(), Sense::click_and_drag());
            let p = ui.painter();
            p.rect_filled(pantalla, CornerRadius::ZERO, Color32::from_black_alpha(30));
            let raton = resp.hover_pos().or(resp.interact_pointer_pos());

            if resp.drag_started() {
                e.arrastre = ui.input(|i| i.pointer.press_origin()).or(resp.interact_pointer_pos());
            }
            let rect_arrastre = match (e.arrastre, raton) {
                (Some(a), Some(b)) if a.distance(b) > 8.0 => Some(Rect::from_two_pos(a, b)),
                _ => None,
            };
            let resaltar = |r: Rect| {
                p.rect(r, CornerRadius::same(4), pal.acento.gamma_multiply(0.14), Stroke::new(2.0, pal.acento), StrokeKind::Outside)
            };

            if let Some(r) = rect_arrastre {
                resaltar(r);
            } else if let Some(z) = raton.and_then(|m| zona_en(&e.zonas, m)) {
                resaltar(z.rect);
                let galley = p.layout_no_wrap(z.nombre.clone(), FontId::proportional(11.5), pal.acento_texto);
                let mut caja = Rect::from_min_size(
                    z.rect.left_top() - Vec2::new(2.0, galley.size().y + 8.0),
                    galley.size() + Vec2::new(14.0, 6.0),
                );
                // Pegada arriba: la etiqueta va dentro de la zona para que no se corte.
                if caja.top() < pantalla.top() {
                    caja = caja.translate(Vec2::new(4.0, caja.height() + 6.0));
                }
                p.rect_filled(caja, CornerRadius::same(5), pal.acento);
                p.galley(caja.min + Vec2::new(7.0, 3.0), galley, pal.acento_texto);
            }

            let pista = if e.zonas.is_empty() {
                "Arrastra para marcar un rectángulo · Esc para cancelar"
            } else {
                "Clic en una zona o arrastra un rectángulo · Esc para cancelar"
            };
            let galley = p.layout_no_wrap(pista.into(), FontId::proportional(12.5), pal.texto);
            let caja = Rect::from_center_size(
                Pos2::new(pantalla.center().x, pantalla.top() + 26.0),
                galley.size() + Vec2::new(44.0, 14.0),
            );
            p.rect(caja, CornerRadius::same(200), pal.fondo, Stroke::new(1.0, pal.borde), StrokeKind::Inside);
            dibujar_punto(p, Pos2::new(caja.left() + 16.0, caja.center().y), 16.0);
            p.galley(caja.min + Vec2::new(30.0, 7.0), galley, pal.texto);

            if resp.drag_stopped() {
                if let Some(r) = rect_arrastre {
                    let dentro = zona_en(&e.zonas, r.center());
                    elegido = Some(Objetivo {
                        rect: Some(r),
                        componente: dentro.map(|z| format!("Rectángulo en {}", objetivo_de_zona(z).componente.unwrap_or_default())),
                        fuente: dentro.map(|z| z.fuente.clone()),
                        selector: Some(format!("rect x={:.0} y={:.0} {:.0}x{:.0}", r.left(), r.top(), r.width(), r.height())),
                    });
                }
                e.arrastre = None;
            } else if resp.clicked() {
                if let Some(z) = raton.and_then(|m| zona_en(&e.zonas, m)) {
                    elegido = Some(objetivo_de_zona(z));
                }
            }
        });
    if let Some(obj) = elegido {
        e.senalando = false;
        // Si ya había un borrador abierto, se conserva el texto y las capturas.
        match e.panel.as_mut() {
            Some(p) => {
                p.obj = obj;
                p.vista = Vista::Nota;
            }
            None => e.panel = Some(Panel::new(Vista::Nota, obj, &e.config)),
        }
    }
}

fn recibir_captura(ctx: &Context, e: &mut Estado, img: &ColorImage, zona: Option<Rect>) {
    let Some(panel) = e.panel.as_mut() else { return };
    let recorte = match zona {
        Some(r) => img.region(&r.expand(16.0).intersect(ctx.content_rect()), Some(ctx.pixels_per_point())),
        None => img.clone(),
    };
    let [w, h] = recorte.size;
    if w == 0 || h == 0 {
        panel.estado("Captura vacía", Tono::Error);
        return;
    }
    let rgba: Vec<u8> = recorte.pixels.iter().flat_map(|c| c.to_srgba_unmultiplied()).collect();
    let textura = ctx.load_texture(format!("spotfix-captura-{}", panel.capturas.len() + 1), recorte, Default::default());
    panel.capturas.push(Imagen { ancho: w as u32, alto: h as u32, rgba, textura });
    panel.estado("Listo", Tono::Ok);
}

// ---------------------------------------------------------------- panel

enum Accion {
    Nada,
    Cerrar,
    Senalar,
    Capturar(Option<Rect>),
    Guardar,
    Copiar,
    MarcarHecha(usize, bool),
    CargarNotas,
    Config(Config),
}

fn dibujar_panel(ctx: &Context, e: &mut Estado, pal: &Paleta, pos: Pos2, pantalla: Rect) {
    if e.panel.is_none() {
        return;
    }
    let sec_actual = seccion(ctx, e);
    let config = e.config.clone();
    let panel = e.panel.as_mut().unwrap();
    if panel.vista == Vista::Notas && panel.notas.is_none() {
        panel.notas = Some(e.store.listar());
    }
    let mut accion = Accion::Nada;

    let derecha = pos.x > pantalla.center().x;
    // Botón en la mitad de abajo: la ventana se abre hacia arriba; si no, hacia abajo.
    let arriba = pos.y > pantalla.center().y;
    egui::Window::new("spotfix")
        .id(Id::unique("spotfix-panel"))
        .title_bar(false)
        .resizable(false)
        .collapsible(false)
        .order(Order::Foreground)
        .pivot(match (derecha, arriba) {
            (true, true) => Align2::RIGHT_BOTTOM,
            (false, true) => Align2::LEFT_BOTTOM,
            (true, false) => Align2::RIGHT_TOP,
            (false, false) => Align2::LEFT_TOP,
        })
        .default_pos(Pos2::new(
            if derecha { pos.x - 10.0 } else { pos.x + TAM + 10.0 },
            if arriba { pos.y + TAM } else { pos.y },
        ))
        .frame(
            Frame::NONE
                .fill(pal.fondo)
                .stroke(Stroke::new(1.0, pal.borde))
                .corner_radius(CornerRadius::same(14))
                .shadow(sombra(pal)),
        )
        .show(ctx, |ui| {
            aplicar(ui, pal);
            ui.set_width(ANCHO_PANEL);
            ui.spacing_mut().item_spacing.y = 0.0;

            // Cabecera
            Frame::NONE.inner_margin(Margin { left: 12, right: 10, top: 10, bottom: 10 }).show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 10.0;
                    // En Ajustes ninguna pestaña está marcada.
                    let mut pestana = (panel.vista != Vista::Ajustes).then_some(panel.vista);
                    let opciones = [(Some(Vista::Nota), "Nota", None), (Some(Vista::Notas), "Almacenadas", None)];
                    if segmentado(ui, pal, &mut pestana, &opciones, None) {
                        panel.vista = pestana.unwrap_or(Vista::Nota);
                        if panel.vista == Vista::Notas {
                            accion = Accion::CargarNotas;
                        }
                    }
                    a_la_derecha(ui, |ui| {
                        ui.spacing_mut().item_spacing.x = 4.0;
                        if boton_icono(ui, pal, "Cerrar", false, |p, c, col| icono_cerrar(p, c, col)) {
                            accion = Accion::Cerrar;
                        }
                        if boton_icono(ui, pal, "Ajustes", panel.vista == Vista::Ajustes, |p, c, col| icono_ajustes(p, c, col)) {
                            panel.vista = if panel.vista == Vista::Ajustes { Vista::Nota } else { Vista::Ajustes };
                        }
                    });
                });
            });
            let (r, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 1.0), Sense::hover());
            ui.painter().hline(r.x_range(), r.center().y, Stroke::new(1.0, pal.borde));

            // Cuerpo
            // Altura máxima: lo que no quepa hace scroll (cabecera y pie quedan fijos).
            // Solo cabe lo que hay entre el botón y el borde hacia el que se abre la ventana.
            let libre = if arriba { pos.y + TAM - pantalla.top() } else { pantalla.bottom() - pos.y };
            let alto_max = (libre - 150.0).clamp(140.0, 520.0);
            Frame::NONE.inner_margin(Margin::same(12)).show(ui, |ui| {
                ui.spacing_mut().item_spacing.y = 10.0;
                ui.set_width(ANCHO_PANEL - 24.0);
                match panel.vista {
                    Vista::Nota => {
                        egui::ScrollArea::vertical().id_salt("spotfix-nota").max_height(alto_max).show(ui, |ui| {
                            ui.set_width(ANCHO_PANEL - 24.0);
                            vista_nota(ui, pal, panel, &mut accion)
                        });
                    }
                    Vista::Notas => vista_notas(ui, pal, panel, &sec_actual, (alto_max - 100.0).max(100.0), &mut accion),
                    Vista::Ajustes => vista_ajustes(ui, pal, panel, &config, &mut accion),
                }
            });

            // Pie
            let pie = match panel.vista {
                Vista::Nota => format!("Las notas se guardan en {} de este proyecto.", config.carpeta),
                Vista::Notas => "Cuando la IA resuelve una nota la marca como hecha y desaparece de aquí.".into(),
                Vista::Ajustes => "Los ajustes se guardan en .spotfix/config.json.".into(),
            };
            Frame::NONE.inner_margin(Margin { left: 12, right: 12, top: 0, bottom: 10 }).show(ui, |ui| {
                ui.vertical_centered(|ui| ui.label(egui::RichText::new(pie).size(11.0).color(pal.tenue)));
            });
        });

    match accion {
        Accion::Nada => {}
        Accion::Cerrar => e.panel = None,
        Accion::Senalar => {
            e.senalando = true;
            e.arrastre = None;
        }
        Accion::Capturar(zona) => {
            if let Some(p) = e.panel.as_mut() {
                p.estado("Capturando…", Tono::Ocupado);
            }
            e.captura = Captura::Solicitar { zona };
            ctx.request_repaint();
        }
        Accion::CargarNotas => {
            if let Some(p) = e.panel.as_mut() {
                p.notas = Some(e.store.listar());
            }
        }
        Accion::MarcarHecha(i, hecha) => {
            if let Some(p) = e.panel.as_mut() {
                if let Some(n) = p.notas.as_mut().and_then(|ns| ns.get_mut(i)) {
                    match e.store.cambiar_estado(n, if hecha { "hecha" } else { "abierta" }) {
                        Ok(nueva) => *n = nueva,
                        Err(_) => p.estado("Error", Tono::Error),
                    }
                }
            }
        }
        Accion::Copiar => {
            if let Some(p) = e.panel.as_mut() {
                let notas = p.notas.clone().unwrap_or_default();
                let sec = p.solo_seccion.then_some(sec_actual.as_str());
                ctx.copy_text(compile_markdown(&notas, p.ver_hechas, sec));
                p.estado("Copiado", Tono::Ok);
            }
        }
        Accion::Config(c) => match e.store.guardar_config(&c) {
            Ok(()) => {
                e.config = c;
                if let Some(p) = e.panel.as_mut() {
                    p.estado("Guardado", Tono::Ok);
                }
            }
            Err(err) => {
                if let Some(p) = e.panel.as_mut() {
                    p.estado("Error", Tono::Error);
                }
                avisar(ctx, e, format!("No se pudo guardar: {err}"));
            }
        },
        Accion::Guardar => guardar(ctx, e, sec_actual),
    }
    if let Some(texto) = e.panel.as_mut().and_then(|p| p.aviso.take()) {
        avisar(ctx, e, texto);
    }
}

fn vista_nota(ui: &mut Ui, pal: &Paleta, panel: &mut Panel, accion: &mut Accion) {
    // Qué se señaló
    tarjeta(pal, pal.hundido).show(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            let (r, _) = ui.allocate_exact_size(Vec2::splat(16.0), Sense::hover());
            ui.painter().circle_stroke(r.center(), 6.5, Stroke::new(1.6, pal.acento));
            ui.painter().circle_filled(r.center(), 2.5, pal.acento);
            ui.vertical(|ui| {
                ui.spacing_mut().item_spacing.y = 1.0;
                let nombre = panel.obj.componente.clone().unwrap_or_else(|| "Esta ventana".into());
                ui.label(egui::RichText::new(nombre).strong());
                for extra in [&panel.obj.fuente, &panel.obj.selector].into_iter().flatten() {
                    ui.label(egui::RichText::new(extra).size(11.5).color(pal.tenue));
                }
            });
            a_la_derecha(ui, |ui| {
                let t = if panel.obj.rect.is_some() { "Cambiar" } else { "Señalar" };
                if boton(ui, pal, t, false) {
                    *accion = Accion::Senalar;
                }
            });
        });
    });

    let ancho = ui.available_width();
    let mut tipo = panel.tipo;
    if segmentado(ui, pal, &mut tipo, &[("bug", "Bug", Some(pal.bug)), ("sugerencia", "Sugerencia", Some(pal.sug))], Some(ancho)) {
        panel.tipo = tipo;
    }

    let te = ui.add(
        egui::TextEdit::multiline(&mut panel.texto)
            .hint_text(egui::RichText::new("Escribe qué pasa aquí, o qué te gustaría cambiar…").color(pal.tenue))
            .desired_rows(7)
            .desired_width(f32::INFINITY)
            .margin(Margin::symmetric(12, 10)),
    );
    if ui.memory(|m| m.focused().is_none()) {
        te.request_focus();
    }

    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 6.0;
        let lleno = panel.capturas.len() >= MAX_CAPTURAS;
        ui.add_enabled_ui(!lleno, |ui| {
            if let Some(r) = panel.obj.rect {
                if boton(ui, pal, "Captura de la zona", false) {
                    *accion = Accion::Capturar(Some(r));
                }
            }
            if boton(ui, pal, "Captura de ventana", false) {
                *accion = Accion::Capturar(None);
            }
        });
    });

    if !panel.capturas.is_empty() {
        let mut quitar = None;
        ui.horizontal_wrapped(|ui| {
            for (i, c) in panel.capturas.iter().enumerate() {
                let r = ui.add(
                    egui::Image::new(&c.textura)
                        .max_size(Vec2::new(76.0, 56.0))
                        .corner_radius(CornerRadius::same(8))
                        .sense(Sense::click()),
                );
                if r.on_hover_text("Clic para quitar").clicked() {
                    quitar = Some(i);
                }
            }
        });
        if let Some(i) = quitar {
            panel.capturas.remove(i);
        }
    }

    a_la_derecha(ui, |ui| {
        let atajo = ui.input(|i| i.modifiers.command && i.key_pressed(Key::Enter));
        if boton(ui, pal, "Guardar", true) || atajo {
            *accion = Accion::Guardar;
        }
        if boton(ui, pal, "Cancelar", false) {
            *accion = Accion::Cerrar;
        }
    });
}

fn vista_notas(ui: &mut Ui, pal: &Paleta, panel: &mut Panel, sec_actual: &str, alto_lista: f32, accion: &mut Accion) {
    ui.horizontal(|ui| {
        let mut solo = panel.solo_seccion;
        if segmentado(ui, pal, &mut solo, &[(true, "Esta sección", None), (false, "Todas", None)], None) {
            panel.solo_seccion = solo;
        }
        a_la_derecha(ui, |ui| {
            casilla(ui, pal, &mut panel.ver_hechas, "Ver hechas");
        });
    });

    let notas = panel.notas.as_deref().unwrap_or(&[]);
    egui::ScrollArea::vertical().id_salt("spotfix-lista").max_height(alto_lista).auto_shrink([false, true]).show(ui, |ui| {
        ui.spacing_mut().item_spacing.y = 8.0;
        let mut ultima: Option<&str> = None;
        let mut alguna = false;
        for (i, n) in notas.iter().enumerate().rev() {
            if panel.solo_seccion && n.seccion != sec_actual {
                continue;
            }
            if !panel.ver_hechas && n.estado == "hecha" {
                continue;
            }
            alguna = true;
            if !panel.solo_seccion && ultima != Some(n.seccion.as_str()) {
                ui.label(egui::RichText::new(n.seccion.to_uppercase()).size(11.0).strong().color(pal.tenue));
                ultima = Some(&n.seccion);
            }
            let fill = if n.estado == "hecha" { pal.superficie.gamma_multiply(0.6) } else { pal.superficie };
            tarjeta(pal, fill).show(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.spacing_mut().item_spacing.y = 4.0;
                ui.horizontal(|ui| {
                    let (txt, color) = if n.tipo == "bug" { ("BUG", pal.bug) } else { ("SUGERENCIA", pal.sug) };
                    ui.label(egui::RichText::new(txt).size(10.5).strong().color(color));
                    a_la_derecha(ui, |ui| {
                        let mut hecha = n.estado == "hecha";
                        if casilla(ui, pal, &mut hecha, "Hecha") {
                            *accion = Accion::MarcarHecha(i, hecha);
                        }
                    });
                });
                ui.label(&n.texto);
                let meta = format!(
                    "{} · {}{}{}",
                    n.fecha.get(..16).unwrap_or(&n.fecha).replace('T', " "),
                    n.componente.as_deref().unwrap_or("ventana"),
                    n.fuente.as_ref().map(|f| format!(" · {f}")).unwrap_or_default(),
                    if n.capturas.is_empty() { String::new() } else { format!(" · {} captura(s)", n.capturas.len()) },
                );
                ui.label(egui::RichText::new(meta).size(11.5).color(pal.tenue));
            });
        }
        if !alguna {
            ui.add_space(20.0);
            ui.vertical_centered(|ui| {
                ui.label(egui::RichText::new(if panel.ver_hechas { "No hay notas." } else { "No hay notas abiertas." }).color(pal.tenue));
            });
            ui.add_space(20.0);
        }
    });

    a_la_derecha(ui, |ui| {
        if boton(ui, pal, "Copiar para la IA", true) {
            *accion = Accion::Copiar;
        }
        if boton(ui, pal, "Recargar", false) {
            *accion = Accion::CargarNotas;
        }
    });
}

fn vista_ajustes(ui: &mut Ui, pal: &Paleta, panel: &mut Panel, config: &Config, accion: &mut Accion) {
    ui.label(egui::RichText::new("Tema").strong().size(12.5));
    let mut tema = config.tema;
    let ancho = ui.available_width();
    if segmentado(ui, pal, &mut tema, &[(Tema::Claro, "Claro", None), (Tema::Oscuro, "Oscuro", None), (Tema::Sistema, "Sistema", None)], Some(ancho)) {
        *accion = Accion::Config(Config { tema, ..config.clone() });
    }

    ui.add_space(4.0);
    let titulo = ui.label(egui::RichText::new("Carpeta de las notas").strong().size(12.5));
    ui.horizontal(|ui| {
        let w = ui.available_width() - 84.0;
        let r = ui
            .add(egui::TextEdit::singleline(&mut panel.carpeta).desired_width(w).margin(Margin::symmetric(10, 7)))
            .labelled_by(titulo.id);
        let enter = r.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter));
        if boton(ui, pal, "Guardar", true) || enter {
            *accion = Accion::Config(Config { carpeta: panel.carpeta.trim().to_string(), ..config.clone() });
        }
    });
    ui.label(
        egui::RichText::new("Relativa a la raíz del proyecto o absoluta. Las notas nuevas se guardan ahí; las anteriores se quedan donde estaban.")
            .size(11.5)
            .color(pal.tenue),
    );
}

fn guardar(ctx: &Context, e: &mut Estado, sec_actual: String) {
    let Some(p) = e.panel.as_mut() else { return };
    if p.texto.trim().is_empty() && p.capturas.is_empty() {
        p.estado("Nota vacía", Tono::Error);
        return;
    }
    let ventana = ctx.content_rect().size();
    let nueva = NuevaNota {
        tipo: p.tipo.to_string(),
        texto: p.texto.clone(),
        seccion: sec_actual,
        componente: p.obj.componente.clone(),
        fuente: p.obj.fuente.clone(),
        selector: p.obj.selector.clone(),
        ventana: Some(format!("{:.0}x{:.0}", ventana.x, ventana.y)),
        capturas: p.capturas.iter().map(|c| (c.ancho, c.alto, c.rgba.clone())).collect(),
    };
    match e.store.guardar(nueva) {
        Ok(_) => {
            e.panel = None;
            avisar(ctx, e, "Nota guardada");
        }
        Err(err) => {
            if let Some(p) = e.panel.as_mut() {
                p.estado("Error", Tono::Error);
            }
            avisar(ctx, e, format!("No se pudo guardar: {err}"));
        }
    }
}
