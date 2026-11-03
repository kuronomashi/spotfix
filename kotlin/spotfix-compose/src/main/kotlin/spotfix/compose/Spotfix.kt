// spotfix para Jetpack Compose: un botón flotante para dejar notas sobre zonas de la app.
//
//     setContent {
//         SpotfixOverlay {
//             App()   // dentro: Modifier.spotfix("Cabecera") marca zonas con nombre
//         }
//     }
//
// Solo actúa en apps depurables (debug). En release se usa spotfix-compose-noop, que no dibuja nada.
// Se apaga sin tocar código con "enabled": false en .spotfix/config.json.

package spotfix.compose

import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ApplicationInfo
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.node.CompositionLocalConsumerModifierNode
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.TraversableNode
import androidx.compose.ui.node.currentValueOf
import androidx.compose.ui.node.traverseAncestors
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Envuelve la app y dibuja encima el botón de spotfix.
 *
 * @param seccion Nombre de la pantalla actual (la "sección" de las notas), por ejemplo la ruta de
 *   Navigation Compose. Si es null se usa la de [SpotfixSection] o, si no hay, el nombre de la Activity.
 */
@Composable
fun SpotfixOverlay(modifier: Modifier = Modifier, seccion: String? = null, content: @Composable () -> Unit) {
    val context = LocalContext.current
    val depurable = remember(context) { context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0 }
    if (!depurable || LocalInspectionMode.current) {
        Box(modifier.fillMaxSize()) { content() }
        return
    }

    val estado = remember(context) { Estado(context.applicationContext) }
    LaunchedEffect(estado) {
        while (true) {
            estado.config = withContext(Dispatchers.IO) { estado.store.config() }
            delay(2000)
        }
    }
    // El contenido se dibuja en una capa propia: así las capturas salen sin la interfaz de spotfix.
    val capa = rememberGraphicsLayer()
    Box(
        modifier
            .fillMaxSize()
            .onGloballyPositioned {
                estado.coords = it
                estado.tamano = it.size
            },
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .drawWithContent {
                    capa.record { this@drawWithContent.drawContent() }
                    drawLayer(capa)
                },
        ) {
            CompositionLocalProvider(LocalSpotfix provides estado) { content() }
        }
        if (estado.config.enabled && !ocultoHastaReiniciar) {
            Interfaz(estado, capa, seccion ?: estado.seccionDeclarada ?: nombreActivity(context))
        }
    }
}

/** Marca una zona con nombre. Al señalarla, la nota guarda el nombre, sus zonas padre y el
 *  `archivo:línea` donde se llamó a `spotfix` (sale de la pila de llamadas). */
fun Modifier.spotfix(nombre: String): Modifier = this then ZonaElement(nombre, fuenteDeLlamada())

/** Nombre de la pantalla actual mientras este composable esté en pantalla. */
@Composable
fun SpotfixSection(nombre: String) {
    val e = LocalSpotfix.current ?: return
    DisposableEffect(e, nombre) {
        e.seccionDeclarada = nombre
        onDispose {
            if (e.seccionDeclarada == nombre) e.seccionDeclarada = null
        }
    }
}

// ---------------------------------------------------------------- estado

internal val LocalSpotfix = staticCompositionLocalOf<Estado?> { null }

/** "Ocultar hasta reiniciar": dura lo que dure el proceso. */
internal var ocultoHastaReiniciar by mutableStateOf(false)

internal class Zona(val nombre: String, val coords: LayoutCoordinates, val fuente: String?, val padres: List<String>)

internal class Estado(val context: Context) {
    // En el dispositivo las notas van al almacenamiento de la app; `gradlew spotfixPull` las trae
    // a la carpeta del proyecto.
    val store = Store(context.getExternalFilesDir(null) ?: context.filesDir, carpetaFija = true)
    val prefs = context.getSharedPreferences("spotfix", Context.MODE_PRIVATE)

    var config by mutableStateOf(store.config())
    var seccionDeclarada by mutableStateOf<String?>(null)
    var coords: LayoutCoordinates? = null
    var tamano by mutableStateOf(IntSize.Zero)

    /** Zonas en pantalla. No es estado observable: solo se lee al señalar. */
    val zonas = LinkedHashMap<ZonaNode, Zona>()

    /** Rectángulo de cada zona en coordenadas del overlay, de la más externa a la más interna. */
    fun rectsZonas(): List<Pair<Zona, Rect>> {
        val raiz = coords?.takeIf { it.isAttached } ?: return emptyList()
        return zonas.values.mapNotNull { z ->
            if (!z.coords.isAttached) return@mapNotNull null
            val r = raiz.localBoundingBoxOf(z.coords, clipBounds = true)
            if (r.width <= 0f || r.height <= 0f) null else z to r
        }
    }
}

private fun nombreActivity(context: Context): String {
    var c: Context? = context
    while (c is ContextWrapper) {
        if (c is android.app.Activity) return c.javaClass.simpleName
        c = c.baseContext
    }
    return "principal"
}

/** `paquete/Archivo.kt:línea` de quien llamó a [spotfix]. La pila solo da el nombre del archivo;
 *  la carpeta sale del paquete de la clase (`spotfixPull` la cambia por la ruta real). */
private fun fuenteDeLlamada(): String? {
    val pila = Throwable().stackTrace
    val i = pila.indexOfFirst { it.className == "spotfix.compose.SpotfixKt" && it.methodName == "spotfix" }
    val f = pila.getOrNull(i + 1)?.takeIf { i >= 0 } ?: return null
    val archivo = f.fileName ?: return null
    if (f.lineNumber <= 0) return null
    val paquete = f.className.substringBeforeLast('.', "").replace('.', '/')
    return (if (paquete.isEmpty()) archivo else "$paquete/$archivo") + ":" + f.lineNumber
}

private data class ZonaElement(val nombre: String, val fuente: String?) : ModifierNodeElement<ZonaNode>() {
    override fun create() = ZonaNode(nombre, fuente)

    override fun update(node: ZonaNode) {
        node.nombre = nombre
        node.fuente = fuente
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "spotfix"
        properties["nombre"] = nombre
    }
}

internal class ZonaNode(var nombre: String, var fuente: String?) :
    Modifier.Node(),
    GlobalPositionAwareModifierNode,
    TraversableNode,
    CompositionLocalConsumerModifierNode {

    override val traverseKey: Any get() = Clave

    private object Clave

    private var estado: Estado? = null

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        val e = currentValueOf(LocalSpotfix) ?: return
        estado = e
        // Zonas que la contienen, de la más cercana a la más lejana.
        val padres = mutableListOf<String>()
        traverseAncestors(Clave) {
            padres += (it as ZonaNode).nombre
            true
        }
        e.zonas[this] = Zona(nombre, coordinates, fuente, padres)
    }

    override fun onDetach() {
        estado?.zonas?.remove(this)
        estado = null
    }
}
