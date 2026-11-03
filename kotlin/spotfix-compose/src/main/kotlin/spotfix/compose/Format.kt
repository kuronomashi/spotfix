// Formato común de notas (ver spec/formato.md). Igual que rust/spotfix-egui/src/format.rs.

package spotfix.compose

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.text.Normalizer

data class Note(
    val id: String,
    val fecha: String,
    /** "bug" o "sugerencia" */
    val tipo: String,
    /** "abierta" o "hecha" */
    val estado: String,
    val plataforma: String,
    val seccion: String,
    val componente: String?,
    val fuente: String?,
    val selector: String?,
    val ventana: String?,
    val capturas: List<String>,
    val texto: String,
    /** Ruta relativa a la raíz del proyecto: .spotfix/notas/AAAA-MM-DD/x.md */
    val archivo: String,
    /** Campos que no conocemos (p. ej. escritos por otra plataforma); se conservan al reescribir. */
    val otros: Map<String, JsonElement> = emptyMap(),
)

private val ORDEN = listOf(
    "id", "fecha", "tipo", "estado", "plataforma", "seccion", "archivo_ruta", "componente", "fuente",
    "selector", "texto_visible", "ventana", "url", "capturas",
)

private fun opcional(v: String?): JsonElement = v?.let(::JsonPrimitive) ?: JsonNull

fun serialize(n: Note): String {
    val campos = LinkedHashMap(n.otros)
    campos["id"] = JsonPrimitive(n.id)
    campos["fecha"] = JsonPrimitive(n.fecha)
    campos["tipo"] = JsonPrimitive(n.tipo)
    campos["estado"] = JsonPrimitive(n.estado)
    campos["plataforma"] = JsonPrimitive(n.plataforma)
    campos["seccion"] = JsonPrimitive(n.seccion)
    campos["componente"] = opcional(n.componente)
    campos["fuente"] = opcional(n.fuente)
    campos["selector"] = opcional(n.selector)
    campos["ventana"] = opcional(n.ventana)
    campos["capturas"] = JsonArray(n.capturas.map(::JsonPrimitive))

    val out = StringBuilder("---\n")
    for (k in ORDEN) {
        campos.remove(k)?.let { out.append("$k: $it\n") }
    }
    for ((k, v) in campos.toSortedMap()) {
        out.append("$k: $v\n")
    }
    out.append("---\n\n")
    out.append(n.texto.trim())
    out.append("\n")
    return out.toString()
}

fun parse(contenido: String, archivo: String): Note? {
    val c = contenido.replace("\r\n", "\n")
    if (!c.startsWith("---\n")) return null
    val resto = c.removePrefix("---\n")
    val fin = resto.indexOf("\n---").takeIf { it >= 0 } ?: return null
    val cabecera = resto.substring(0, fin)
    val cuerpo = resto.substring(fin + 4).trim()

    val campos = LinkedHashMap<String, JsonElement>()
    for (linea in cabecera.lines()) {
        val i = linea.indexOf(':').takeIf { it >= 0 } ?: continue
        val v = linea.substring(i + 1).trim()
        val valor = runCatching { Json.parseToJsonElement(v) }.getOrElse { JsonPrimitive(v) }
        campos[linea.substring(0, i).trim()] = valor
    }
    fun textoDe(k: String): String? {
        val v = campos.remove(k)
        return if (v is JsonPrimitive && v.isString) v.contentOrNull else null
    }
    val id = textoDe("id") ?: return null
    val fecha = textoDe("fecha") ?: return null
    val tipo = textoDe("tipo") ?: "bug"
    val estado = textoDe("estado") ?: "abierta"
    val plataforma = textoDe("plataforma") ?: ""
    val seccion = textoDe("seccion") ?: "/"
    val componente = textoDe("componente")
    val fuente = textoDe("fuente")
    val selector = textoDe("selector")
    val ventana = textoDe("ventana")
    val capturas = (campos.remove("capturas") as? JsonArray)
        ?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }
        ?: emptyList()
    return Note(
        id, fecha, tipo, estado, plataforma, seccion, componente, fuente, selector, ventana, capturas,
        texto = cuerpo,
        archivo = archivo,
        otros = campos,
    )
}

fun slug(s: String, max: Int): String {
    val out = StringBuilder()
    var guion = false
    for (ch in sinAcentos(s)) {
        if (ch in 'a'..'z' || ch in 'A'..'Z' || ch in '0'..'9') {
            out.append(ch.lowercaseChar())
            guion = false
        } else if (!guion && out.isNotEmpty()) {
            out.append('-')
            guion = true
        }
        if (out.length >= max) break
    }
    val r = out.toString().trimEnd('-')
    return r.ifEmpty { "raiz" }
}

/** "Público" → "Publico", "ñ" → "n". */
private fun sinAcentos(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")

/** 2026-10-24T15:32:10-05:00 → 2026-10-24T15-32-10_<seccion>_<componente> */
fun fileBase(fecha: String, seccion: String, componente: String?): String {
    val hora = fecha.take(19).replace(':', '-')
    val comp = componente?.let { "_" + slug(it.split(" < ").first(), 30) } ?: ""
    return "${hora}_${slug(seccion, 40)}$comp"
}

fun makeId(fecha: String, azar: Int): String {
    val d = fecha.take(10).replace("-", "")
    val h = if (fecha.length >= 19) fecha.substring(11, 19).replace(":", "") else ""
    return "$d-$h-%04x".format(azar and 0xffff)
}

/** Va al principio del texto copiado: así la IA cierra cada nota al terminarla. */
const val INSTRUCCION_IA = "> Al resolver cada nota, abre su archivo (línea \"Nota:\") y cambia `estado: \"abierta\"` por " +
    "`estado: \"hecha\"`. No borres la nota. Las notas hechas dejan de aparecer en spotfix."

/** Texto agrupado por día y sección para pegar a la IA. */
fun compileMarkdown(notas: List<Note>, todas: Boolean, seccion: String?): String {
    val elegidas = notas
        .filter { todas || it.estado != "hecha" }
        .filter { seccion == null || it.seccion == seccion }
        .sortedBy { it.fecha }
    if (elegidas.isEmpty()) return "# Notas de spotfix\n\n(No hay notas abiertas.)\n"

    // Día → secciones en orden de aparición.
    val porDia = sortedMapOf<String, LinkedHashMap<String, MutableList<Note>>>()
    for (n in elegidas) {
        porDia.getOrPut(n.fecha.take(10)) { LinkedHashMap() }.getOrPut(n.seccion) { mutableListOf() }.add(n)
    }

    val out = mutableListOf("# Notas de spotfix", "", INSTRUCCION_IA, "")
    for ((dia, secs) in porDia) {
        out += "## $dia"
        out += ""
        for ((sec, lista) in secs) {
            out += "### $sec"
            out += ""
            for (n in lista) {
                val donde = listOfNotNull(n.componente?.let { "**$it**" }, n.fuente?.let { "`$it`" })
                    .joinToString(" — ")
                    .ifEmpty { "(ventana completa)" }
                val hecha = if (n.estado == "hecha") " (hecha)" else ""
                out += "- [${n.tipo}]$hecha $donde"
                if (n.selector != null && n.fuente == null) {
                    out += "  Zona: `${n.selector}`"
                }
                for (l in n.texto.lines()) {
                    out += "  $l"
                }
                val carpeta = n.archivo.substring(0, n.archivo.lastIndexOf('/') + 1)
                for (c in n.capturas) {
                    out += "  Captura: $carpeta$c"
                }
                out += "  Nota: ${n.archivo}"
                out += ""
            }
        }
    }
    return out.joinToString("\n")
}
