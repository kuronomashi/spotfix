//! Formato común de notas (ver spec/formato.md). Igual que js/src/shared/note.ts.

use serde_json::{Map, Value};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq)]
pub struct Note {
    pub id: String,
    pub fecha: String,
    /// "bug" o "sugerencia"
    pub tipo: String,
    /// "abierta" o "hecha"
    pub estado: String,
    pub plataforma: String,
    pub seccion: String,
    pub componente: Option<String>,
    pub fuente: Option<String>,
    pub selector: Option<String>,
    pub ventana: Option<String>,
    pub capturas: Vec<String>,
    pub texto: String,
    /// Ruta relativa a la raíz del proyecto: .spotfix/notas/AAAA-MM-DD/x.md
    pub archivo: String,
    /// Campos que no conocemos (p. ej. escritos por otra plataforma); se conservan al reescribir.
    pub otros: Map<String, Value>,
}

const ORDEN: &[&str] = &[
    "id", "fecha", "tipo", "estado", "plataforma", "seccion", "archivo_ruta", "componente", "fuente",
    "selector", "texto_visible", "ventana", "url", "capturas",
];

fn opcional(v: &Option<String>) -> Value {
    v.as_ref().map_or(Value::Null, |s| Value::String(s.clone()))
}

pub fn serialize(n: &Note) -> String {
    let mut campos = n.otros.clone();
    campos.insert("id".into(), n.id.clone().into());
    campos.insert("fecha".into(), n.fecha.clone().into());
    campos.insert("tipo".into(), n.tipo.clone().into());
    campos.insert("estado".into(), n.estado.clone().into());
    campos.insert("plataforma".into(), n.plataforma.clone().into());
    campos.insert("seccion".into(), n.seccion.clone().into());
    campos.insert("componente".into(), opcional(&n.componente));
    campos.insert("fuente".into(), opcional(&n.fuente));
    campos.insert("selector".into(), opcional(&n.selector));
    campos.insert("ventana".into(), opcional(&n.ventana));
    campos.insert("capturas".into(), n.capturas.iter().cloned().map(Value::String).collect());

    let mut out = String::from("---\n");
    for k in ORDEN {
        if let Some(v) = campos.remove(*k) {
            out += &format!("{k}: {v}\n");
        }
    }
    for (k, v) in campos {
        out += &format!("{k}: {v}\n");
    }
    out += "---\n\n";
    out += n.texto.trim();
    out += "\n";
    out
}

pub fn parse(contenido: &str, archivo: &str) -> Option<Note> {
    let c = contenido.replace("\r\n", "\n");
    let resto = c.strip_prefix("---\n")?;
    let fin = resto.find("\n---")?;
    let cabecera = &resto[..fin];
    let cuerpo = resto[fin + 4..].trim();

    let mut campos = Map::new();
    for linea in cabecera.lines() {
        let Some((k, v)) = linea.split_once(':') else { continue };
        let v = v.trim();
        let valor = serde_json::from_str(v).unwrap_or_else(|_| Value::String(v.to_string()));
        campos.insert(k.trim().to_string(), valor);
    }
    let mut texto_de = |k: &str| match campos.remove(k) {
        Some(Value::String(s)) => Some(s),
        _ => None,
    };
    let id = texto_de("id")?;
    let fecha = texto_de("fecha")?;
    let tipo = texto_de("tipo").unwrap_or_else(|| "bug".into());
    let estado = texto_de("estado").unwrap_or_else(|| "abierta".into());
    let plataforma = texto_de("plataforma").unwrap_or_default();
    let seccion = texto_de("seccion").unwrap_or_else(|| "/".into());
    let componente = texto_de("componente");
    let fuente = texto_de("fuente");
    let selector = texto_de("selector");
    let ventana = texto_de("ventana");
    let capturas = match campos.remove("capturas") {
        Some(Value::Array(a)) => a.into_iter().filter_map(|v| v.as_str().map(String::from)).collect(),
        _ => vec![],
    };
    Some(Note {
        id, fecha, tipo, estado, plataforma, seccion, componente, fuente, selector, ventana, capturas,
        texto: cuerpo.to_string(),
        archivo: archivo.to_string(),
        otros: campos,
    })
}

pub fn slug(s: &str, max: usize) -> String {
    let mut out = String::new();
    let mut guion = false;
    for ch in s.chars().flat_map(sin_acento) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            guion = false;
        } else if !guion && !out.is_empty() {
            out.push('-');
            guion = true;
        }
        if out.len() >= max {
            break;
        }
    }
    let r = out.trim_end_matches('-').to_string();
    if r.is_empty() { "raiz".into() } else { r }
}

fn sin_acento(c: char) -> Option<char> {
    Some(match c {
        'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
        'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
        'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
        'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
        'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
        'ñ' | 'Ñ' => 'n',
        'ç' | 'Ç' => 'c',
        c => c,
    })
}

/// 2026-10-24T15:32:10-05:00 → 2026-10-24T15-32-10_<seccion>_<componente>
pub fn file_base(fecha: &str, seccion: &str, componente: Option<&str>) -> String {
    let hora = fecha.get(..19).unwrap_or(fecha).replace(':', "-");
    let comp = componente
        .map(|c| format!("_{}", slug(c.split(" < ").next().unwrap_or(c), 30)))
        .unwrap_or_default();
    format!("{hora}_{}{comp}", slug(seccion, 40))
}

pub fn make_id(fecha: &str, azar: u32) -> String {
    let d = fecha.get(..10).unwrap_or("").replace('-', "");
    let h = fecha.get(11..19).unwrap_or("").replace(':', "");
    format!("{d}-{h}-{:04x}", azar & 0xffff)
}

/// Va al principio del texto copiado: así la IA cierra cada nota al terminarla.
pub const INSTRUCCION_IA: &str = "> Al resolver cada nota, abre su archivo (línea \"Nota:\") y cambia `estado: \"abierta\"` por \
`estado: \"hecha\"`. No borres la nota. Las notas hechas dejan de aparecer en spotfix.";

/// Texto agrupado por día y sección para pegar a la IA.
pub fn compile_markdown(notas: &[Note], todas: bool, seccion: Option<&str>) -> String {
    let mut elegidas: Vec<&Note> = notas
        .iter()
        .filter(|n| todas || n.estado != "hecha")
        .filter(|n| seccion.map_or(true, |s| n.seccion == s))
        .collect();
    if elegidas.is_empty() {
        return "# Notas de spotfix\n\n(No hay notas abiertas.)\n".into();
    }
    elegidas.sort_by(|a, b| a.fecha.cmp(&b.fecha));

    // Día → secciones en orden de aparición.
    let mut por_dia: BTreeMap<&str, Vec<(&str, Vec<&Note>)>> = BTreeMap::new();
    for n in elegidas {
        let secs = por_dia.entry(n.fecha.get(..10).unwrap_or("")).or_default();
        match secs.iter_mut().find(|(s, _)| *s == n.seccion) {
            Some((_, v)) => v.push(n),
            None => secs.push((&n.seccion, vec![n])),
        }
    }

    let mut out = vec!["# Notas de spotfix".to_string(), String::new(), INSTRUCCION_IA.to_string(), String::new()];
    for (dia, secs) in por_dia {
        out.push(format!("## {dia}"));
        out.push(String::new());
        for (sec, lista) in secs {
            out.push(format!("### {sec}"));
            out.push(String::new());
            for n in lista {
                let donde: Vec<String> = [
                    n.componente.as_ref().map(|c| format!("**{c}**")),
                    n.fuente.as_ref().map(|f| format!("`{f}`")),
                ]
                .into_iter()
                .flatten()
                .collect();
                let donde = if donde.is_empty() { "(ventana completa)".into() } else { donde.join(" — ") };
                let hecha = if n.estado == "hecha" { " (hecha)" } else { "" };
                out.push(format!("- [{}]{hecha} {donde}", n.tipo));
                if let (Some(s), None) = (&n.selector, &n.fuente) {
                    out.push(format!("  Zona: `{s}`"));
                }
                for l in n.texto.lines() {
                    out.push(format!("  {l}"));
                }
                let carpeta = &n.archivo[..n.archivo.rfind('/').map_or(0, |i| i + 1)];
                for c in &n.capturas {
                    out.push(format!("  Captura: {carpeta}{c}"));
                }
                out.push(format!("  Nota: {}", n.archivo));
                out.push(String::new());
            }
        }
    }
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nota() -> Note {
        Note {
            id: "20261024-153210-a1b2".into(),
            fecha: "2026-10-24T15:32:10-05:00".into(),
            tipo: "bug".into(),
            estado: "abierta".into(),
            plataforma: "egui".into(),
            seccion: "Ajustes > Perfil".into(),
            componente: Some("Cabecera < Panel lateral".into()),
            fuente: Some("src/main.rs:42".into()),
            selector: None,
            ventana: Some("1280x720".into()),
            capturas: vec!["img/a_1.png".into()],
            texto: "Texto con \"comillas\": y dos puntos\nOtra línea".into(),
            archivo: ".spotfix/notas/2026-10-24/a.md".into(),
            otros: Map::new(),
        }
    }

    #[test]
    fn ida_y_vuelta() {
        let n = nota();
        let leida = parse(&serialize(&n), &n.archivo).unwrap();
        assert_eq!(leida, n);
    }

    #[test]
    fn lee_notas_de_next_y_conserva_campos() {
        let md = "---\r\nid: \"x\"\r\nfecha: \"2026-10-24T10:00:00-05:00\"\r\ntipo: \"sugerencia\"\r\nestado: \"abierta\"\r\nplataforma: \"next\"\r\nseccion: \"/\"\r\nurl: \"http://localhost:3000/\"\r\n---\r\n\r\nHola\r\n";
        let n = parse(md, "a.md").unwrap();
        assert_eq!(n.texto, "Hola");
        assert_eq!(n.otros.get("url").unwrap(), "http://localhost:3000/");
        assert!(serialize(&n).contains("url: \"http://localhost:3000/\""));
    }

    #[test]
    fn slugs_y_nombres() {
        assert_eq!(slug("Ajustes > Perfil Público", 40), "ajustes-perfil-publico");
        assert_eq!(slug("/", 40), "raiz");
        assert_eq!(slug("../../etc", 40), "etc");
        assert_eq!(
            file_base("2026-10-24T15:32:10-05:00", "Ajustes", Some("Cabecera < Panel")),
            "2026-10-24T15-32-10_ajustes_cabecera"
        );
        assert_eq!(make_id("2026-10-24T15:32:10-05:00", 0xab), "20261024-153210-00ab");
    }

    #[test]
    fn markdown_agrupado() {
        let mut hecha = nota();
        hecha.estado = "hecha".into();
        hecha.texto = "ya resuelta".into();
        let md = compile_markdown(&[nota(), hecha], false, None);
        assert!(md.contains("## 2026-10-24"));
        assert!(md.contains("### Ajustes > Perfil"));
        assert!(md.contains("**Cabecera < Panel lateral** — `src/main.rs:42`"));
        assert!(md.contains("Captura: .spotfix/notas/2026-10-24/img/a_1.png"));
        assert!(!md.contains("ya resuelta"));
    }
}
