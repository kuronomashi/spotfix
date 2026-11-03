package spotfix.compose

import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FormatTest {
    private fun nota() = Note(
        id = "20261024-153210-a1b2",
        fecha = "2026-10-24T15:32:10-05:00",
        tipo = "bug",
        estado = "abierta",
        plataforma = "android",
        seccion = "Ajustes > Perfil",
        componente = "Cabecera < Panel lateral",
        fuente = "app/src/main/java/com/ej/Main.kt:42",
        selector = null,
        ventana = "1080x2400",
        capturas = listOf("img/a_1.png"),
        texto = "Texto con \"comillas\": y dos puntos\nOtra línea",
        archivo = ".spotfix/notas/2026-10-24/a.md",
    )

    @Test
    fun idaYVuelta() {
        val n = nota()
        assertEquals(n, parse(serialize(n), n.archivo))
    }

    @Test
    fun mismaCabeceraQueRust() {
        val esperado = """
            ---
            id: "20261024-153210-a1b2"
            fecha: "2026-10-24T15:32:10-05:00"
            tipo: "bug"
            estado: "abierta"
            plataforma: "android"
            seccion: "Ajustes > Perfil"
            componente: "Cabecera < Panel lateral"
            fuente: "app/src/main/java/com/ej/Main.kt:42"
            selector: null
            ventana: "1080x2400"
            capturas: ["img/a_1.png"]
            ---
        """.trimIndent()
        assertTrue(serialize(nota()).startsWith(esperado))
    }

    @Test
    fun leeNotasDeNextYConservaCampos() {
        val md = "---\r\nid: \"x\"\r\nfecha: \"2026-10-24T10:00:00-05:00\"\r\ntipo: \"sugerencia\"\r\nestado: \"abierta\"\r\nplataforma: \"next\"\r\nseccion: \"/\"\r\nurl: \"http://localhost:3000/\"\r\n---\r\n\r\nHola\r\n"
        val n = parse(md, "a.md")!!
        assertEquals("Hola", n.texto)
        assertEquals(JsonPrimitive("http://localhost:3000/"), n.otros["url"])
        assertTrue(serialize(n).contains("url: \"http://localhost:3000/\""))
    }

    @Test
    fun slugsYNombres() {
        assertEquals("ajustes-perfil-publico", slug("Ajustes > Perfil Público", 40))
        assertEquals("raiz", slug("/", 40))
        assertEquals("etc", slug("../../etc", 40))
        assertEquals("pequeno", slug("Pequeño", 40))
        assertEquals(
            "2026-10-24T15-32-10_ajustes_cabecera",
            fileBase("2026-10-24T15:32:10-05:00", "Ajustes", "Cabecera < Panel"),
        )
        assertEquals("20261024-153210-00ab", makeId("2026-10-24T15:32:10-05:00", 0xab))
    }

    @Test
    fun markdownAgrupado() {
        val hecha = nota().copy(estado = "hecha", texto = "ya resuelta")
        val md = compileMarkdown(listOf(nota(), hecha), false, null)
        assertTrue(md.contains("## 2026-10-24"))
        assertTrue(md.contains("### Ajustes > Perfil"))
        assertTrue(md.contains("**Cabecera < Panel lateral** — `app/src/main/java/com/ej/Main.kt:42`"))
        assertTrue(md.contains("Captura: .spotfix/notas/2026-10-24/img/a_1.png"))
        assertTrue(md.startsWith("# Notas de spotfix\n\n$INSTRUCCION_IA"))
        assertFalse(md.contains("ya resuelta"))
    }
}
