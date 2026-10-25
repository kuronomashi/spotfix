//! Lectura y escritura en disco. Mismo formato que la versión de Next.
//! config.json y LEEME-IA.md viven siempre en <raiz>/.spotfix; las notas, en `carpeta`.

use crate::format::{self, Note};
use serde_json::{json, Value};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const LEEME: &str = include_str!("leeme.md");
pub const CARPETA_DEFECTO: &str = ".spotfix/notas";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tema {
    Claro,
    Oscuro,
    Sistema,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    pub enabled: bool,
    pub tema: Tema,
    /// Relativa a la raíz del proyecto o absoluta.
    pub carpeta: String,
}

pub struct Store {
    raiz: PathBuf,
}

/// Lo que el usuario rellena en el panel.
pub struct NuevaNota {
    pub tipo: String,
    pub texto: String,
    pub seccion: String,
    pub componente: Option<String>,
    pub fuente: Option<String>,
    pub selector: Option<String>,
    pub ventana: Option<String>,
    /// Imágenes RGBA ya recortadas: (ancho, alto, píxeles).
    pub capturas: Vec<(u32, u32, Vec<u8>)>,
}

impl Store {
    pub fn new(raiz: impl Into<PathBuf>) -> Self {
        Self { raiz: raiz.into() }
    }

    fn carpeta(&self) -> PathBuf {
        self.raiz.join(".spotfix")
    }

    fn leer_json(&self) -> Value {
        fs::read_to_string(self.carpeta().join("config.json"))
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or(Value::Null)
    }

    pub fn config(&self) -> Config {
        let v = self.leer_json();
        Config {
            enabled: v.get("enabled").and_then(Value::as_bool).unwrap_or(true),
            tema: match v.get("tema").and_then(Value::as_str) {
                Some("claro") => Tema::Claro,
                Some("oscuro") => Tema::Oscuro,
                _ => Tema::Sistema,
            },
            carpeta: v
                .get("carpeta")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(CARPETA_DEFECTO)
                .to_string(),
        }
    }

    /// Guarda la config conservando claves que no conocemos.
    pub fn guardar_config(&self, c: &Config) -> io::Result<()> {
        let mut v = match self.leer_json() {
            Value::Object(m) => Value::Object(m),
            _ => json!({}),
        };
        v["enabled"] = json!(c.enabled);
        v["tema"] = json!(match c.tema {
            Tema::Claro => "claro",
            Tema::Oscuro => "oscuro",
            Tema::Sistema => "sistema",
        });
        let carpeta = c.carpeta.trim();
        v["carpeta"] = json!(if carpeta.is_empty() { CARPETA_DEFECTO } else { carpeta });
        fs::create_dir_all(self.carpeta())?;
        fs::write(self.carpeta().join("config.json"), serde_json::to_string_pretty(&v)? + "\n")
    }

    pub fn enabled(&self) -> bool {
        self.config().enabled
    }

    /// Carpeta absoluta de las notas.
    pub fn dir_notas(&self) -> PathBuf {
        let c = PathBuf::from(self.config().carpeta);
        if c.is_absolute() { c } else { self.raiz.join(c) }
    }

    /// Relativa a la raíz con `/`, o absoluta si está fuera del proyecto.
    fn mostrar(&self, p: &Path) -> String {
        match p.strip_prefix(&self.raiz) {
            Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
            Err(_) => p.to_string_lossy().into_owned(),
        }
    }

    fn asegurar(&self) -> io::Result<()> {
        let c = self.carpeta();
        fs::create_dir_all(&c)?;
        // Lo genera spotfix: se actualiza si cambia la versión de la librería.
        let leeme = c.join("LEEME-IA.md");
        if fs::read_to_string(&leeme).ok().as_deref() != Some(LEEME) {
            fs::write(leeme, LEEME)?;
        }
        if !c.join("config.json").exists() {
            self.guardar_config(&self.config())?;
        }
        fs::create_dir_all(self.dir_notas())
    }

    pub fn guardar(&self, n: NuevaNota) -> io::Result<Note> {
        self.asegurar()?;
        let fecha = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%:z").to_string();
        let dia = &fecha[..10];
        let dir_dia = self.dir_notas().join(dia);
        fs::create_dir_all(&dir_dia)?;

        let base0 = format::file_base(&fecha, &n.seccion, n.componente.as_deref());
        let base = (1..)
            .map(|i| if i == 1 { base0.clone() } else { format!("{base0}-{i}") })
            .find(|b| !dir_dia.join(format!("{b}.md")).exists())
            .unwrap();

        let mut capturas = Vec::new();
        if !n.capturas.is_empty() {
            fs::create_dir_all(dir_dia.join("img"))?;
        }
        for (i, (w, h, px)) in n.capturas.iter().enumerate() {
            let rel = format!("img/{base}_{}.png", i + 1);
            image::save_buffer(dir_dia.join(&rel), px, *w, *h, image::ColorType::Rgba8)
                .map_err(io::Error::other)?;
            capturas.push(rel);
        }

        let azar = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let texto = if n.texto.trim().is_empty() { "(Solo captura)".to_string() } else { n.texto.trim().to_string() };
        let destino = dir_dia.join(format!("{base}.md"));
        let nota = Note {
            id: format::make_id(&fecha, azar),
            fecha: fecha.clone(),
            tipo: if n.tipo == "sugerencia" { "sugerencia".into() } else { "bug".into() },
            estado: "abierta".into(),
            plataforma: "egui".into(),
            seccion: n.seccion,
            componente: n.componente,
            fuente: n.fuente,
            selector: n.selector,
            ventana: n.ventana,
            capturas,
            texto,
            archivo: self.mostrar(&destino),
            otros: Default::default(),
        };
        fs::write(&destino, format::serialize(&nota))?;
        Ok(nota)
    }

    pub fn listar(&self) -> Vec<Note> {
        let dir = self.dir_notas();
        let mut dias: Vec<_> = leer_dir(&dir)
            .into_iter()
            .filter(|d| d.len() == 10 && d.as_bytes()[4] == b'-')
            .collect();
        dias.sort();
        let mut notas = Vec::new();
        for d in dias {
            let mut archivos: Vec<_> = leer_dir(&dir.join(&d)).into_iter().filter(|f| f.ends_with(".md")).collect();
            archivos.sort();
            for f in archivos {
                let abs = dir.join(&d).join(&f);
                if let Ok(t) = fs::read_to_string(&abs) {
                    if let Some(n) = format::parse(&t, &self.mostrar(&abs)) {
                        notas.push(n);
                    }
                }
            }
        }
        notas
    }

    pub fn cambiar_estado(&self, nota: &Note, estado: &str) -> io::Result<Note> {
        let mut n = nota.clone();
        n.estado = estado.into();
        // `archivo` viene de listar(), siempre dentro de la carpeta de notas.
        fs::write(self.raiz.join(&n.archivo), format::serialize(&n))?;
        Ok(n)
    }
}

fn leer_dir(p: &Path) -> Vec<String> {
    fs::read_dir(p)
        .map(|r| r.filter_map(|e| e.ok()).filter_map(|e| e.file_name().into_string().ok()).collect())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nueva(texto: &str) -> NuevaNota {
        NuevaNota {
            tipo: "bug".into(),
            texto: texto.into(),
            seccion: "Principal".into(),
            componente: Some("Cabecera".into()),
            fuente: Some("src/main.rs:10".into()),
            selector: None,
            ventana: Some("800x600".into()),
            capturas: vec![(2, 1, vec![255, 0, 0, 255, 0, 255, 0, 255])],
        }
    }

    #[test]
    fn guarda_lista_y_marca() {
        let raiz = std::env::temp_dir().join(format!("spotfix-egui-{}", std::process::id()));
        let s = Store::new(&raiz);
        let n = s.guardar(nueva("Hola")).unwrap();
        assert!(raiz.join(&n.archivo).exists());
        assert!(raiz.join(".spotfix/LEEME-IA.md").exists());
        let carpeta = Path::new(&n.archivo).parent().unwrap();
        assert!(raiz.join(carpeta).join(&n.capturas[0]).exists());
        assert!(s.listar().iter().any(|x| x.id == n.id));
        let hecha = s.cambiar_estado(&n, "hecha").unwrap();
        assert_eq!(hecha.estado, "hecha");
        assert!(s.listar().iter().any(|x| x.id == n.id && x.estado == "hecha"));
        assert!(s.enabled());
    }

    #[test]
    fn config_tema_y_carpeta() {
        let raiz = std::env::temp_dir().join(format!("spotfix-egui-cfg-{}", std::process::id()));
        let s = Store::new(&raiz);
        assert_eq!(s.config().tema, Tema::Sistema);
        s.guardar_config(&Config { enabled: true, tema: Tema::Oscuro, carpeta: "docs/notas".into() }).unwrap();
        assert_eq!(s.config(), Config { enabled: true, tema: Tema::Oscuro, carpeta: "docs/notas".into() });
        let n = s.guardar(nueva("otra")).unwrap();
        assert!(n.archivo.starts_with("docs/notas/"), "{}", n.archivo);
        assert_eq!(s.listar().len(), 1);
    }
}
