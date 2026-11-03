// Interfaz de spotfix en Compose. Mismo flujo que rust/spotfix-egui/src/ui.rs: botón flotante,
// menú, señalar zona o rectángulo y panel con Nota | Almacenadas | Ajustes.

package spotfix.compose

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val TAM = 40.dp
private val ANCHO_PANEL = 400.dp
private const val MAX_CAPTURAS = 5

// ---------------------------------------------------------------- estado

internal class Objetivo(
    val rect: Rect? = null,
    val componente: String? = null,
    val fuente: String? = null,
    val selector: String? = null,
)

internal class Captura(val miniatura: ImageBitmap, val png: ByteArray)

internal enum class Vista { Nota, Notas, Ajustes }

internal class Panel(vista: Vista, obj: Objetivo, carpeta: String) {
    var vista by mutableStateOf(vista)
    var obj by mutableStateOf(obj)
    var tipo by mutableStateOf("bug")
    var texto by mutableStateOf("")
    val capturas = mutableStateListOf<Captura>()
    var notas by mutableStateOf<List<Note>?>(null)
    var soloSeccion by mutableStateOf(true)
    var verHechas by mutableStateOf(false)
    var carpeta by mutableStateOf(carpeta)
}

private class Ui {
    var boton by mutableStateOf<Offset?>(null)
    var menu by mutableStateOf(false)
    var senalando by mutableStateOf(false)
    var panel by mutableStateOf<Panel?>(null)
    var aviso by mutableStateOf<String?>(null)
    var avisoId by mutableIntStateOf(0)

    fun avisar(texto: String) {
        aviso = texto
        avisoId++
    }

    /** Si ya había un borrador abierto, se conserva el texto y las capturas. */
    fun elegir(obj: Objetivo, config: Config) {
        senalando = false
        val p = panel
        if (p != null) {
            p.obj = obj
            p.vista = Vista.Nota
        } else {
            panel = Panel(Vista.Nota, obj, config.carpeta)
        }
    }
}

// ---------------------------------------------------------------- interfaz

@Composable
internal fun Interfaz(e: Estado, capa: GraphicsLayer, seccion: String) {
    val pal = when (e.config.tema) {
        Tema.Claro -> CLARO
        Tema.Oscuro -> OSCURO
        Tema.Sistema -> if (isSystemInDarkTheme()) OSCURO else CLARO
    }
    val u = remember { Ui() }
    val scope = rememberCoroutineScope()
    val d = LocalDensity.current
    val (w, h) = e.tamano
    if (w == 0 || h == 0) return

    // Zona segura para el botón (barras del sistema y recortes de pantalla).
    val barras = WindowInsets.systemBars.union(WindowInsets.displayCutout)
    val ld = LocalLayoutDirection.current
    val izq = barras.getLeft(d, ld).toFloat()
    val der = barras.getRight(d, ld).toFloat()
    val arriba = barras.getTop(d).toFloat()
    val abajo = barras.getBottom(d).toFloat()
    val teclado = WindowInsets.ime.getBottom(d).toFloat()
    val tam = with(d) { TAM.toPx() }
    val m = with(d) { 4.dp.toPx() }

    fun limitar(p: Offset) = Offset(
        p.x.coerceIn(izq + m, max(izq + m, w - der - tam - m)),
        p.y.coerceIn(arriba + m, max(arriba + m, h - abajo - tam - m)),
    )
    if (u.boton == null) {
        // Posición guardada como fracción de la pantalla, para que valga al girar.
        val fx = e.prefs.getFloat("x", -1f)
        val fy = e.prefs.getFloat("y", -1f)
        val defecto = with(d) { 20.dp.toPx() }
        u.boton = if (fx >= 0f && fy >= 0f) Offset(fx * w, fy * h) else Offset(w - der - defecto - tam, h - abajo - defecto - tam)
    }
    val pos = limitar(u.boton!!)
    val limitarActual by rememberUpdatedState(::limitar)

    fun avisar(texto: String) = u.avisar(texto)

    fun copiar(texto: String) {
        val cm = e.context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("spotfix", texto))
    }

    fun compartir(texto: String) {
        val envio = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto)
        e.context.startActivity(Intent.createChooser(envio, "Notas de spotfix").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun capturar(zona: Rect?) {
        val p = u.panel ?: return
        scope.launch {
            val r = runCatching {
                val img = capa.toImageBitmap()
                withContext(Dispatchers.Default) { recortar(img, zona, with(d) { 16.dp.toPx() }) }
            }.getOrNull()
            if (r == null) avisar("Captura vacía") else p.capturas += r
        }
    }

    fun guardar() {
        val p = u.panel ?: return
        if (p.texto.isBlank() && p.capturas.isEmpty()) {
            avisar("Nota vacía")
            return
        }
        val nueva = NuevaNota(
            tipo = p.tipo,
            texto = p.texto,
            seccion = seccion,
            componente = p.obj.componente,
            fuente = p.obj.fuente,
            selector = p.obj.selector,
            ventana = "${w}x$h",
            capturas = p.capturas.map { it.png },
        )
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { e.store.guardar(nueva) } }
                .onSuccess {
                    u.panel = null
                    avisar("Nota guardada")
                }
                .onFailure { avisar("No se pudo guardar: ${it.message}") }
        }
    }

    fun cargarNotas(p: Panel) {
        scope.launch { p.notas = withContext(Dispatchers.IO) { runCatching { e.store.listar() }.getOrDefault(emptyList()) } }
    }

    fun guardarConfig(c: Config) {
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { e.store.guardarConfig(c) } }
                .onSuccess {
                    e.config = c
                    avisar("Guardado")
                }
                .onFailure { avisar("No se pudo guardar: ${it.message}") }
        }
    }

    BackHandler(enabled = u.senalando || u.menu || u.panel != null) {
        when {
            u.senalando -> u.senalando = false
            u.menu -> u.menu = false
            else -> u.panel = null
        }
    }

    Box(Modifier.fillMaxSize()) {
        val panel = u.panel
        if (u.senalando) {
            CapaSenalar(e, u, pal, arriba)
        } else if (panel != null && panel.vista == Vista.Nota) {
            panel.obj.rect?.let { r -> Canvas(Modifier.fillMaxSize()) { resaltar(r, pal) } }
        }

        if (panel != null && !u.senalando) {
            LaunchedEffect(panel, panel.vista) {
                if (panel.vista == Vista.Notas && panel.notas == null) cargarNotas(panel)
            }
            PanelFlotante(
                pal, panel, e.config, seccion, pos, tam, IntSize(w, h), arriba, teclado,
                onCerrar = { u.panel = null },
                onSenalar = { u.senalando = true },
                onCapturar = ::capturar,
                onGuardar = ::guardar,
                onCargar = { cargarNotas(panel) },
                onMarcar = { n, hecha ->
                    scope.launch {
                        runCatching { withContext(Dispatchers.IO) { e.store.cambiarEstado(n, if (hecha) "hecha" else "abierta") } }
                            .onSuccess { nueva -> panel.notas = panel.notas?.map { if (it.archivo == n.archivo) nueva else it } }
                            .onFailure { avisar("Error") }
                    }
                },
                onCopiar = { compartirlo ->
                    val texto = compileMarkdown(panel.notas.orEmpty(), panel.verHechas, seccion.takeIf { panel.soloSeccion })
                    if (compartirlo) compartir(texto) else copiar(texto).also { avisar("Copiado") }
                },
                onConfig = ::guardarConfig,
            )
        }

        if (u.menu) {
            // Encima del panel. Toque fuera del menú: lo cierra.
            Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { u.menu = false } })
            Menu(pal, pos, tam, IntSize(w, h)) { elegido ->
                u.menu = false
                when (elegido) {
                    "Señalar zona" -> {
                        u.panel = null
                        u.senalando = true
                    }
                    "Nota de esta pantalla" -> u.panel = Panel(Vista.Nota, Objetivo(), e.config.carpeta)
                    "Notas almacenadas" -> u.panel = Panel(Vista.Notas, Objetivo(), e.config.carpeta)
                    "Copiar esta sección", "Copiar todo" -> scope.launch {
                        val notas = withContext(Dispatchers.IO) { e.store.listar() }
                        copiar(compileMarkdown(notas, false, seccion.takeIf { elegido == "Copiar esta sección" }))
                        avisar("Notas copiadas al portapapeles")
                    }
                    "Ajustes" -> u.panel = Panel(Vista.Ajustes, Objetivo(), e.config.carpeta)
                    "Ocultar hasta reiniciar" -> ocultoHastaReiniciar = true
                }
            }
        }

        BotonFlotante(
            pos = pos,
            activo = u.menu || u.senalando || u.panel != null,
            onTap = { u.menu = !u.menu },
            onMover = { delta ->
                u.menu = false
                u.boton = limitarActual(pos + delta)
            },
            onSoltar = {
                val b = u.boton ?: return@BotonFlotante
                e.prefs.edit().putFloat("x", b.x / w).putFloat("y", b.y / h).apply()
            },
        )

        u.aviso?.let { texto ->
            LaunchedEffect(u.avisoId) {
                delay(2000)
                u.aviso = null
            }
            Aviso(pal, texto, arriba)
        }
    }
}

// ---------------------------------------------------------------- piezas de la interfaz

/** Coloca el elemento en la posición que calcula `donde` a partir de su tamaño. */
private fun Modifier.colocar(donde: (IntSize) -> IntOffset) = layout { medible, c ->
    val p = medible.measure(c.copy(minWidth = 0, minHeight = 0))
    layout(p.width, p.height) { p.place(donde(IntSize(p.width, p.height))) }
}

/** Para que los toques en huecos del panel no lleguen a la app de debajo. */
private fun Modifier.bloquearToques() = pointerInput(Unit) {
    awaitEachGesture {
        awaitFirstDown(requireUnconsumed = false)
        waitForUpOrCancellation()
    }
}

private fun DrawScope.resaltar(r: Rect, pal: Paleta) {
    val radio = CornerRadius(4.dp.toPx())
    drawRoundRect(pal.acento.copy(alpha = 0.14f), r.topLeft, r.size, radio)
    drawRoundRect(pal.acento, r.topLeft, r.size, radio, style = Stroke(2.dp.toPx()))
}

@Composable
private fun BotonFlotante(pos: Offset, activo: Boolean, onTap: () -> Unit, onMover: (Offset) -> Unit, onSoltar: () -> Unit) {
    var pulsado by remember { mutableStateOf(false) }
    val tap by rememberUpdatedState(onTap)
    val mover by rememberUpdatedState(onMover)
    val soltar by rememberUpdatedState(onSoltar)
    Canvas(
        Modifier
            .offset { IntOffset(pos.x.roundToInt(), pos.y.roundToInt()) }
            .size(TAM)
            .semantics {
                contentDescription = "spotfix (arrastra para mover)"
                role = Role.Button
            }
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        pulsado = true
                        tryAwaitRelease()
                        pulsado = false
                    },
                    onTap = { tap() },
                )
            }
            .pointerInput(Unit) {
                detectDragGestures(onDragEnd = { soltar() }) { c, delta ->
                    c.consume()
                    mover(delta)
                }
            },
    ) {
        // Igual que en web: solo crece un poco al tocarlo o con el panel abierto.
        val lado = if (activo || pulsado) size.minDimension * 1.08f else size.minDimension
        dibujarPunto(center, lado)
    }
}

private val MENU = listOf(
    "Señalar zona",
    "Nota de esta pantalla",
    "Notas almacenadas",
    "-",
    "Copiar esta sección",
    "Copiar todo",
    "-",
    "Ajustes",
    "Ocultar hasta reiniciar",
)

@Composable
private fun Menu(pal: Paleta, pos: Offset, tam: Float, pantalla: IntSize, onElegir: (String) -> Unit) {
    val d = LocalDensity.current
    val sep = with(d) { 8.dp.roundToPx() }
    val haciaArriba = pos.y > pantalla.height / 2
    val derecha = pos.x > pantalla.width / 2
    val forma = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .colocar { s ->
                val x = if (derecha) pos.x + tam - s.width else pos.x
                val y = if (haciaArriba) pos.y - sep - s.height else pos.y + tam + sep
                IntOffset(x.roundToInt().coerceIn(0, max(0, pantalla.width - s.width)), y.roundToInt())
            }
            .width(230.dp)
            .shadow(12.dp, forma)
            .clip(forma)
            .background(pal.fondo)
            .border(1.dp, pal.borde, forma)
            .bloquearToques()
            .padding(6.dp),
    ) {
        for (texto in MENU) {
            if (texto == "-") {
                Box(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp).height(1.dp).background(pal.borde))
                continue
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(38.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(role = Role.Button) { onElegir(texto) }
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Canvas(Modifier.size(5.dp)) { drawCircle(pal.tenue) }
                Spacer(Modifier.width(11.dp))
                BasicText(texto, style = estilo(pal.texto))
            }
        }
    }
}

/** La zona más interna bajo el punto (la de menor área). */
private fun zonaEn(zonas: List<Pair<Zona, Rect>>, p: Offset): Pair<Zona, Rect>? =
    zonas.filter { it.second.contains(p) }.minByOrNull { it.second.width * it.second.height }

private fun objetivoDeZona(z: Zona, r: Rect): Objetivo =
    Objetivo(rect = r, componente = (listOf(z.nombre) + z.padres.take(3)).joinToString(" < "), fuente = z.fuente)

@Composable
private fun CapaSenalar(e: Estado, u: Ui, pal: Paleta, arriba: Float) {
    val zonas = remember { e.rectsZonas() }
    var inicio by remember { mutableStateOf<Offset?>(null) }
    var dedo by remember { mutableStateOf<Offset?>(null) }
    val medidor = rememberTextMeasurer()
    val umbral = with(LocalDensity.current) { 8.dp.toPx() }

    fun rectArrastre(): Rect? {
        val a = inicio ?: return null
        val b = dedo ?: return null
        if ((b - a).getDistance() <= umbral) return null
        return Rect(min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))
    }

    Canvas(
        Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                awaitEachGesture {
                    val abajo = awaitFirstDown()
                    abajo.consume()
                    inicio = abajo.position
                    dedo = abajo.position
                    while (true) {
                        val c = awaitPointerEvent().changes.firstOrNull { it.id == abajo.id } ?: break
                        dedo = c.position
                        c.consume()
                        if (!c.pressed) break
                    }
                    val r = rectArrastre()
                    val elegido = if (r != null) {
                        val dentro = zonaEn(zonas, r.center)
                        Objetivo(
                            rect = r,
                            componente = dentro?.let { (z, zr) -> "Rectángulo en ${objetivoDeZona(z, zr).componente}" },
                            fuente = dentro?.first?.fuente,
                            selector = "rect x=%.0f y=%.0f %.0fx%.0f".format(r.left, r.top, r.width, r.height),
                        )
                    } else {
                        dedo?.let { zonaEn(zonas, it) }?.let { (z, zr) -> objetivoDeZona(z, zr) }
                    }
                    inicio = null
                    dedo = null
                    if (elegido != null) u.elegir(elegido, e.config)
                }
            },
    ) {
        drawRect(Color.Black.copy(alpha = 30 / 255f))
        // Sin ratón no hay "pasar por encima": se ven todas las zonas que se pueden tocar.
        for ((_, r) in zonas) {
            drawRoundRect(pal.acento.copy(alpha = 0.55f), r.topLeft, r.size, CornerRadius(4.dp.toPx()), style = Stroke(1.dp.toPx()))
        }
        val arrastre = rectArrastre()
        if (arrastre != null) {
            resaltar(arrastre, pal)
        } else {
            val zona = dedo?.let { zonaEn(zonas, it) }
            if (zona != null) {
                val (z, r) = zona
                resaltar(r, pal)
                val t = medidor.measure(z.nombre, estilo(pal.acentoTexto, 11.5.sp, negrita = true))
                val pad = Offset(7.dp.toPx(), 3.dp.toPx())
                val caja = Size(t.size.width + pad.x * 2, t.size.height + pad.y * 2)
                var esquina = Offset(r.left - 2.dp.toPx(), r.top - caja.height - 2.dp.toPx())
                // Pegada arriba: la etiqueta va dentro de la zona para que no se corte.
                if (esquina.y < arriba) esquina = Offset(r.left + 4.dp.toPx(), r.top + 4.dp.toPx())
                drawRoundRect(pal.acento, esquina, caja, CornerRadius(5.dp.toPx()))
                drawText(t, topLeft = esquina + pad)
            }
        }
    }
    val pista = if (zonas.isEmpty()) {
        "Arrastra para marcar un rectángulo · Atrás para cancelar"
    } else {
        "Toca una zona o arrastra un rectángulo · Atrás para cancelar"
    }
    Pildora(pal, pista, arriba)
}

/** Aviso flotante arriba: errores y confirmaciones. */
@Composable
private fun Aviso(pal: Paleta, texto: String, arriba: Float) = Pildora(pal, texto, arriba)

@Composable
private fun Pildora(pal: Paleta, texto: String, arriba: Float) {
    val d = LocalDensity.current
    val forma = RoundedCornerShape(50)
    Box(Modifier.fillMaxWidth().padding(top = with(d) { arriba.toDp() } + 14.dp, start = 16.dp, end = 16.dp), contentAlignment = Alignment.TopCenter) {
        Row(
            Modifier
                .shadow(10.dp, forma)
                .clip(forma)
                .background(pal.fondo)
                .border(1.dp, pal.borde, forma)
                .padding(horizontal = 14.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Logo(16.dp)
            Spacer(Modifier.width(8.dp))
            BasicText(texto, style = estilo(pal.texto, 12.5.sp))
        }
    }
}

private fun recortar(img: ImageBitmap, zona: Rect?, margen: Float): Captura? {
    val completa = img.asAndroidBitmap().copy(Bitmap.Config.ARGB_8888, false) ?: return null
    val todo = Rect(0f, 0f, completa.width.toFloat(), completa.height.toFloat())
    val area = zona?.inflate(margen)?.intersect(todo) ?: todo
    val x = area.left.roundToInt()
    val y = area.top.roundToInt()
    val ancho = min(area.width.roundToInt(), completa.width - x)
    val alto = min(area.height.roundToInt(), completa.height - y)
    if (ancho <= 0 || alto <= 0) return null
    val bmp = if (x == 0 && y == 0 && ancho == completa.width && alto == completa.height) completa else Bitmap.createBitmap(completa, x, y, ancho, alto)
    val png = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    return Captura(bmp.asImageBitmap(), png)
}

// ---------------------------------------------------------------- panel

@Composable
private fun PanelFlotante(
    pal: Paleta,
    panel: Panel,
    config: Config,
    seccion: String,
    pos: Offset,
    tam: Float,
    pantalla: IntSize,
    arriba: Float,
    teclado: Float,
    onCerrar: () -> Unit,
    onSenalar: () -> Unit,
    onCapturar: (Rect?) -> Unit,
    onGuardar: () -> Unit,
    onCargar: () -> Unit,
    onMarcar: (Note, Boolean) -> Unit,
    onCopiar: (compartir: Boolean) -> Unit,
    onConfig: (Config) -> Unit,
) {
    val d = LocalDensity.current
    val margen = with(d) { 12.dp.toPx() }
    val sep = with(d) { 8.dp.toPx() }
    val derecha = pos.x + tam / 2 > pantalla.width / 2
    // Botón en la mitad de abajo: el panel se abre hacia arriba; si no, hacia abajo.
    val haciaArriba = pos.y + tam / 2 > pantalla.height / 2
    val techo = arriba + margen
    val suelo = pantalla.height - max(teclado, 0f) - margen
    val libre = if (haciaArriba) pos.y - sep - techo else suelo - (pos.y + tam + sep)
    val altoMax = with(d) { min(libre.coerceIn(220.dp.toPx(), 640.dp.toPx()), suelo - techo).toDp() }
    val ancho = min(ANCHO_PANEL, with(d) { pantalla.width.toDp() } - 24.dp)
    val forma = RoundedCornerShape(14.dp)

    Column(
        Modifier
            .colocar { s ->
                val x = (if (derecha) pos.x + tam - s.width else pos.x).coerceIn(margen, max(margen, pantalla.width - s.width - margen))
                val y = (if (haciaArriba) pos.y - sep - s.height else pos.y + tam + sep).coerceIn(techo, max(techo, suelo - s.height))
                IntOffset(x.roundToInt(), y.roundToInt())
            }
            .width(ancho)
            .heightIn(max = altoMax)
            .shadow(16.dp, forma)
            .clip(forma)
            .background(pal.fondo)
            .border(1.dp, pal.borde, forma)
            .bloquearToques(),
    ) {
        // Cabecera
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            // En Ajustes ninguna pestaña está marcada.
            val pestana = panel.vista.takeIf { it != Vista.Ajustes }
            Segmentado(pal, pestana, listOf(Triple(Vista.Nota, "Nota", null), Triple(Vista.Notas, "Almacenadas", null)), lleno = false) {
                panel.vista = it
                if (it == Vista.Notas) onCargar()
            }
            Spacer(Modifier.weight(1f))
            BotonIcono(pal, "Ajustes", panel.vista == Vista.Ajustes, ajustes = true) {
                panel.vista = if (panel.vista == Vista.Ajustes) Vista.Nota else Vista.Ajustes
            }
            BotonIcono(pal, "Cerrar", false, ajustes = false, onClick = onCerrar)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(pal.borde))

        // Cuerpo: lo que no quepa hace scroll (cabecera y pie quedan fijos).
        Column(Modifier.weight(1f, fill = false).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (panel.vista) {
                Vista.Nota -> Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    VistaNota(pal, panel, onSenalar, onCapturar, onGuardar, onCerrar)
                }
                Vista.Notas -> VistaNotas(pal, panel, seccion, onCargar, onMarcar, onCopiar)
                Vista.Ajustes -> Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    VistaAjustes(pal, panel, config, onConfig)
                }
            }
        }

        // Pie
        val pie = when (panel.vista) {
            Vista.Nota -> "Las notas se guardan en el dispositivo; gradlew spotfixPull las lleva a ${config.carpeta} del proyecto."
            Vista.Notas -> "Cuando la IA resuelve una nota la marca como hecha y desaparece de aquí."
            Vista.Ajustes -> "Los ajustes se guardan en .spotfix/config.json."
        }
        BasicText(
            pie,
            Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
            style = estilo(pal.tenue, 11.sp).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center),
        )
    }
}

@Composable
private fun VistaNota(
    pal: Paleta,
    panel: Panel,
    onSenalar: () -> Unit,
    onCapturar: (Rect?) -> Unit,
    onGuardar: () -> Unit,
    onCerrar: () -> Unit,
) {
    // Qué se señaló
    Row(Modifier.tarjeta(pal, pal.hundido), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(16.dp)) {
            drawCircle(pal.acento, 6.5.dp.toPx(), style = Stroke(1.6.dp.toPx()))
            drawCircle(pal.acento, 2.5.dp.toPx())
        }
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            BasicText(panel.obj.componente ?: "Esta pantalla", style = estilo(pal.texto, negrita = true))
            for (extra in listOfNotNull(panel.obj.fuente, panel.obj.selector)) {
                BasicText(extra, style = estilo(pal.tenue, 11.5.sp))
            }
        }
        Spacer(Modifier.width(8.dp))
        Boton(pal, if (panel.obj.rect != null) "Cambiar" else "Señalar", primario = false, onClick = onSenalar)
    }

    Segmentado(
        pal,
        panel.tipo,
        listOf(Triple("bug", "Bug", pal.bug), Triple("sugerencia", "Sugerencia", pal.sug)),
        lleno = true,
    ) { panel.tipo = it }

    CampoTexto(pal, panel.texto, "Escribe qué pasa aquí, o qué te gustaría cambiar…", lineas = 5) { panel.texto = it }

    val lleno = panel.capturas.size >= MAX_CAPTURAS
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        panel.obj.rect?.let { r -> Boton(pal, "Captura de la zona", primario = false, activo = !lleno) { onCapturar(r) } }
        Boton(pal, "Captura de pantalla", primario = false, activo = !lleno) { onCapturar(null) }
    }

    if (panel.capturas.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            for (c in panel.capturas.toList()) {
                Box {
                    Image(
                        c.miniatura,
                        contentDescription = "Captura (toca para quitar)",
                        modifier = Modifier
                            .size(76.dp, 56.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, pal.borde, RoundedCornerShape(8.dp))
                            .clickable { panel.capturas.remove(c) },
                        contentScale = ContentScale.Crop,
                    )
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(3.dp).size(16.dp).clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.Center,
                    ) { BasicText("×", style = estilo(Color.White, 11.sp, negrita = true)) }
                }
            }
        }
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
        Boton(pal, "Cancelar", primario = false, onClick = onCerrar)
        Boton(pal, "Guardar", primario = true, onClick = onGuardar)
    }
}

@Composable
private fun VistaNotas(
    pal: Paleta,
    panel: Panel,
    seccion: String,
    onCargar: () -> Unit,
    onMarcar: (Note, Boolean) -> Unit,
    onCopiar: (compartir: Boolean) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Segmentado(pal, panel.soloSeccion, listOf(Triple(true, "Esta sección", null), Triple(false, "Todas", null)), lleno = false) {
            panel.soloSeccion = it
        }
        Spacer(Modifier.weight(1f))
        Casilla(pal, panel.verHechas, "Ver hechas") { panel.verHechas = it }
    }

    val visibles = panel.notas.orEmpty().asReversed()
        .filter { !panel.soloSeccion || it.seccion == seccion }
        .filter { panel.verHechas || it.estado != "hecha" }
    Column(
        Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (panel.notas == null) {
            BasicText("Cargando…", Modifier.fillMaxWidth().padding(vertical = 20.dp), style = estilo(pal.tenue).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
        } else if (visibles.isEmpty()) {
            BasicText(
                if (panel.verHechas) "No hay notas." else "No hay notas abiertas.",
                Modifier.fillMaxWidth().padding(vertical = 20.dp),
                style = estilo(pal.tenue).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center),
            )
        }
        var ultima: String? = null
        for (n in visibles) {
            if (!panel.soloSeccion && ultima != n.seccion) {
                BasicText(n.seccion.uppercase(), style = estilo(pal.tenue, 11.sp, negrita = true))
                ultima = n.seccion
            }
            val hecha = n.estado == "hecha"
            Column(Modifier.tarjeta(pal, pal.superficie).alpha(if (hecha) 0.6f else 1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val (txt, color) = if (n.tipo == "bug") "BUG" to pal.bug else "SUGERENCIA" to pal.sug
                    BasicText(txt, style = estilo(color, 10.5.sp, negrita = true))
                    Spacer(Modifier.weight(1f))
                    Casilla(pal, hecha, "Hecha") { onMarcar(n, it) }
                }
                BasicText(n.texto, style = estilo(pal.texto))
                val meta = buildString {
                    append(n.fecha.take(16).replace('T', ' '))
                    append(" · ").append(n.componente ?: "pantalla")
                    n.fuente?.let { append(" · ").append(it) }
                    if (n.capturas.isNotEmpty()) append(" · ${n.capturas.size} captura(s)")
                }
                BasicText(meta, style = estilo(pal.tenue, 11.5.sp))
            }
        }
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
        Boton(pal, "Recargar", primario = false, onClick = onCargar)
        Boton(pal, "Compartir", primario = false) { onCopiar(true) }
        Boton(pal, "Copiar para la IA", primario = true) { onCopiar(false) }
    }
}

@Composable
private fun VistaAjustes(pal: Paleta, panel: Panel, config: Config, onConfig: (Config) -> Unit) {
    BasicText("Tema", style = estilo(pal.texto, 12.5.sp, negrita = true))
    Segmentado(
        pal,
        config.tema,
        listOf(Triple(Tema.Claro, "Claro", null), Triple(Tema.Oscuro, "Oscuro", null), Triple(Tema.Sistema, "Sistema", null)),
        lleno = true,
    ) { onConfig(config.copy(tema = it)) }

    Spacer(Modifier.height(4.dp))
    BasicText("Carpeta de las notas", style = estilo(pal.texto, 12.5.sp, negrita = true))
    Row(verticalAlignment = Alignment.CenterVertically) {
        CampoTexto(pal, panel.carpeta, CARPETA_DEFECTO, lineas = 1, modifier = Modifier.weight(1f)) { panel.carpeta = it }
        Spacer(Modifier.width(8.dp))
        Boton(pal, "Guardar", primario = true) { onConfig(config.copy(carpeta = panel.carpeta.trim())) }
    }
    BasicText(
        "Relativa a la raíz del proyecto o absoluta. gradlew spotfixPull deja ahí las notas nuevas; " +
            "las anteriores se quedan donde estaban.",
        style = estilo(pal.tenue, 11.5.sp),
    )
}
