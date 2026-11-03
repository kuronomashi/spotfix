package spotfix.compose

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class StoreTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private fun nueva(texto: String) = NuevaNota(
        tipo = "bug",
        texto = texto,
        seccion = "Principal",
        componente = "Cabecera",
        fuente = "com/ej/Main.kt:10",
        selector = null,
        ventana = "800x600",
        capturas = listOf(byteArrayOf(1, 2, 3)),
    )

    @Test
    fun guardaListaYMarca() {
        val raiz = tmp.root
        val s = Store(raiz)
        val n = s.guardar(nueva("Hola"))
        assertTrue(File(raiz, n.archivo).exists())
        assertTrue(File(raiz, ".spotfix/LEEME-IA.md").readText().contains("marca cada nota como hecha"))
        assertTrue(File(File(raiz, n.archivo).parentFile, n.capturas[0]).exists())
        assertTrue(n.fecha.matches(Regex("""\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d""")))
        assertTrue(s.listar().any { it.id == n.id })
        val hecha = s.cambiarEstado(n, "hecha")
        assertEquals("hecha", hecha.estado)
        assertTrue(s.listar().any { it.id == n.id && it.estado == "hecha" })
        assertTrue(s.enabled())
    }

    @Test
    fun mismoNombreLlevaSufijo() {
        val s = Store(tmp.root)
        val a = s.guardar(nueva("uno"))
        val b = s.guardar(nueva("dos"))
        if (a.fecha == b.fecha) assertTrue(b.archivo.endsWith("-2.md"))
    }

    @Test
    fun configTemaYCarpeta() {
        val s = Store(tmp.root)
        assertEquals(Tema.Sistema, s.config().tema)
        s.guardarConfig(Config(enabled = true, tema = Tema.Oscuro, carpeta = "docs/notas"))
        assertEquals(Config(true, Tema.Oscuro, "docs/notas"), s.config())
        val n = s.guardar(nueva("otra"))
        assertTrue(n.archivo, n.archivo.startsWith("docs/notas/"))
        assertEquals(1, s.listar().size)
    }

    @Test
    fun conservaClavesAjenasDeConfig() {
        File(tmp.root, ".spotfix").mkdirs()
        File(tmp.root, ".spotfix/config.json").writeText("""{ "enabled": false, "otra": 3 }""")
        val s = Store(tmp.root)
        s.guardarConfig(s.config().copy(tema = Tema.Claro))
        val texto = File(tmp.root, ".spotfix/config.json").readText()
        assertTrue(texto, texto.contains("\"otra\": 3"))
        assertEquals(Config(false, Tema.Claro, CARPETA_DEFECTO), s.config())
    }

    @Test
    fun enElDispositivoLaCarpetaSoloCambiaLaRutaMostrada() {
        val s = Store(tmp.root, carpetaFija = true)
        s.guardarConfig(Config(carpeta = "docs/notas"))
        val n = s.guardar(nueva("hola"))
        assertTrue(n.archivo, n.archivo.startsWith("docs/notas/"))
        val dia = n.fecha.take(10)
        assertTrue(File(tmp.root, ".spotfix/notas/$dia/${n.archivo.substringAfterLast('/')}").exists())
        val hecha = s.cambiarEstado(s.listar().single(), "hecha")
        assertEquals("hecha", s.listar().single().estado)
        assertEquals(n.archivo, hecha.archivo)
    }
}
