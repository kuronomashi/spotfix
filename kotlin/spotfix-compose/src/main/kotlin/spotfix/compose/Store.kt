// Lectura y escritura en disco. Mismo formato que la versión de Next y egui.
// config.json y LEEME-IA.md viven siempre en <raiz>/.spotfix; las notas, en `carpeta`.

package spotfix.compose

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

const val CARPETA_DEFECTO = ".spotfix/notas"

enum class Tema { Claro, Oscuro, Sistema }

data class Config(
    val enabled: Boolean = true,
    val tema: Tema = Tema.Sistema,
    /** Relativa a la raíz del proyecto o absoluta. */
    val carpeta: String = CARPETA_DEFECTO,
)

/** Lo que el usuario rellena en el panel. */
class NuevaNota(
    val tipo: String,
    val texto: String,
    val seccion: String,
    val componente: String?,
    val fuente: String?,
    val selector: String?,
    val ventana: String?,
    /** Capturas ya recortadas y codificadas en PNG. */
    val capturas: List<ByteArray>,
)

@OptIn(ExperimentalSerializationApi::class)
private val json = Json {
    prettyPrint = true
    prettyPrintIndent = "  "
}

/**
 * @param carpetaFija En el dispositivo las notas se guardan siempre en `<raiz>/.spotfix/notas`;
 *   `carpeta` solo dice dónde quedarán en el proyecto al sincronizar (`gradlew spotfixPull`),
 *   y es la ruta que se muestra y se copia para la IA.
 */
class Store(
    private val raiz: File,
    private val plataforma: String = "android",
    private val carpetaFija: Boolean = false,
) {
    private val carpeta get() = File(raiz, ".spotfix")

    private fun leerJson(): JsonObject? =
        runCatching { Json.parseToJsonElement(File(carpeta, "config.json").readText()) as? JsonObject }.getOrNull()

    fun config(): Config {
        val v = leerJson() ?: JsonObject(emptyMap())
        fun texto(k: String) = (v[k] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull
        return Config(
            enabled = (v["enabled"] as? JsonPrimitive)?.booleanOrNull ?: true,
            tema = when (texto("tema")) {
                "claro" -> Tema.Claro
                "oscuro" -> Tema.Oscuro
                else -> Tema.Sistema
            },
            carpeta = texto("carpeta")?.trim()?.takeIf { it.isNotEmpty() } ?: CARPETA_DEFECTO,
        )
    }

    /** Guarda la config conservando claves que no conocemos. */
    fun guardarConfig(c: Config) {
        val v = LinkedHashMap<String, JsonElement>(leerJson() ?: emptyMap())
        v["enabled"] = JsonPrimitive(c.enabled)
        v["tema"] = JsonPrimitive(
            when (c.tema) {
                Tema.Claro -> "claro"
                Tema.Oscuro -> "oscuro"
                Tema.Sistema -> "sistema"
            },
        )
        v["carpeta"] = JsonPrimitive(c.carpeta.trim().ifEmpty { CARPETA_DEFECTO })
        carpeta.mkdirs()
        File(carpeta, "config.json").writeText(json.encodeToString(JsonObject.serializer(), JsonObject(v.toSortedMap())) + "\n")
    }

    fun enabled(): Boolean = config().enabled

    /** Carpeta real de las notas. */
    fun dirNotas(): File {
        if (carpetaFija) return File(raiz, CARPETA_DEFECTO)
        val c = File(config().carpeta)
        return if (c.isAbsolute) c else File(raiz, config().carpeta)
    }

    /** Carpeta de las notas tal como se muestra: relativa a la raíz con `/`, o absoluta. */
    private fun carpetaMostrada(): String =
        config().carpeta.replace('\\', '/').removePrefix("./").trimEnd('/').ifEmpty { CARPETA_DEFECTO }

    private fun asegurar() {
        carpeta.mkdirs()
        // Lo genera spotfix: se actualiza si cambia la versión de la librería.
        val leeme = File(carpeta, "LEEME-IA.md")
        if (runCatching { leeme.readText() }.getOrNull() != LEEME) {
            leeme.writeText(LEEME)
        }
        if (!File(carpeta, "config.json").exists()) {
            guardarConfig(config())
        }
        dirNotas().mkdirs()
    }

    fun guardar(n: NuevaNota): Note {
        asegurar()
        val fecha = ahora()
        val dia = fecha.take(10)
        val dirDia = File(dirNotas(), dia)
        dirDia.mkdirs()

        val base0 = fileBase(fecha, n.seccion, n.componente)
        val base = generateSequence(1) { it + 1 }
            .map { i -> if (i == 1) base0 else "$base0-$i" }
            .first { !File(dirDia, "$it.md").exists() }

        val capturas = n.capturas.mapIndexed { i, png ->
            val rel = "img/${base}_${i + 1}.png"
            File(dirDia, rel).apply { parentFile?.mkdirs() }.writeBytes(png)
            rel
        }

        val nota = Note(
            id = makeId(fecha, Random.nextInt()),
            fecha = fecha,
            tipo = if (n.tipo == "sugerencia") "sugerencia" else "bug",
            estado = "abierta",
            plataforma = plataforma,
            seccion = n.seccion,
            componente = n.componente,
            fuente = n.fuente,
            selector = n.selector,
            ventana = n.ventana,
            capturas = capturas,
            texto = n.texto.trim().ifEmpty { "(Solo captura)" },
            archivo = "${carpetaMostrada()}/$dia/$base.md",
        )
        File(dirDia, "$base.md").writeText(serialize(nota))
        return nota
    }

    fun listar(): List<Note> {
        val dir = dirNotas()
        val mostrada = carpetaMostrada()
        val dias = leerDir(dir).filter { it.length == 10 && it[4] == '-' }.sorted()
        return dias.flatMap { d ->
            leerDir(File(dir, d)).filter { it.endsWith(".md") }.sorted().mapNotNull { f ->
                runCatching { File(dir, "$d/$f").readText() }.getOrNull()?.let { parse(it, "$mostrada/$d/$f") }
            }
        }
    }

    fun cambiarEstado(nota: Note, estado: String): Note {
        val n = nota.copy(estado = estado)
        // `archivo` viene de listar(): sus dos últimos tramos son <día>/<nota>.md.
        val tramos = n.archivo.split('/').takeLast(2)
        File(dirNotas(), tramos.joinToString("/")).writeText(serialize(n))
        return n
    }

    private companion object {
        val LEEME: String by lazy {
            Store::class.java.getResourceAsStream("/spotfix/leeme.md")!!.use { it.readBytes().decodeToString() }
        }

        fun ahora(): String {
            val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date())
            // XXX da "Z" en UTC; el formato pide siempre ±HH:MM.
            return if (f.endsWith("Z")) f.dropLast(1) + "+00:00" else f
        }

        fun leerDir(p: File): List<String> = p.list()?.toList() ?: emptyList()
    }
}
