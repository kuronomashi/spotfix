// Paleta y controles de spotfix. Estética: spec/estetica.md (igual que egui y web).
// Solo se usan dentro de la interfaz de spotfix; los colores de la app no se tocan.

package spotfix.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// ---------------------------------------------------------------- paleta

internal data class Paleta(
    val oscuro: Boolean,
    val fondo: Color,
    val superficie: Color,
    val hundido: Color,
    val borde: Color,
    val bordeFuerte: Color,
    val texto: Color,
    val tenue: Color,
    val acento: Color,
    val acentoTexto: Color,
    val bug: Color,
    val sug: Color,
)

internal val CLARO = Paleta(
    oscuro = false,
    fondo = Color(0xFFFAF9F5),
    superficie = Color(0xFFFFFFFF),
    hundido = Color(0xFFF0EDE6),
    borde = Color(0xFFE5E1D8),
    bordeFuerte = Color(0xFFD6D1C6),
    texto = Color(0xFF2B2A27),
    tenue = Color(0xFF7A776F),
    acento = Color(0xFFE2A82B),
    acentoTexto = Color(0xFF2B2A27),
    bug = Color(0xFFC8553D),
    sug = Color(0xFF4A7FB5),
)

internal val OSCURO = Paleta(
    oscuro = true,
    fondo = Color(0xFF262624),
    superficie = Color(0xFF2C2B28),
    hundido = Color(0xFF30302D),
    borde = Color(0xFF3A3936),
    bordeFuerte = Color(0xFF4A4945),
    texto = Color(0xFFECE9E2),
    tenue = Color(0xFF9B978E),
    acento = Color(0xFFF2C14E),
    acentoTexto = Color(0xFF1F1E1C),
    bug = Color(0xFFE07A62),
    sug = Color(0xFF6FA3D6),
)

internal fun estilo(color: Color, tam: TextUnit = 13.sp, negrita: Boolean = false) =
    TextStyle(color = color, fontSize = tam, fontWeight = if (negrita) FontWeight.SemiBold else FontWeight.Normal)

// ---------------------------------------------------------------- dibujo

internal val COLOR_LOGO = Color(0xFFF5A623)

/** El logo: círculo de color sólido con el icono de esquinas en blanco al 45 % (spec/estetica.md). */
internal fun DrawScope.dibujarPunto(c: Offset, lado: Float) {
    drawCircle(COLOR_LOGO, lado / 2f, c)
    // El icono está en coordenadas 512×512 (contenido 64..448, 384 de lado).
    val u = lado * 0.45f / 384f
    fun r(x0: Float, y0: Float, x1: Float, y1: Float, color: Color = Color.White) = drawRect(
        color,
        topLeft = Offset(c.x + (x0 - 256f) * u, c.y + (y0 - 256f) * u),
        size = Size((x1 - x0) * u, (y1 - y0) * u),
    )
    val g = 42.667f // grosor de los trazos
    // Esquinas en L: abajo derecha, abajo izquierda, arriba izquierda.
    r(448f - g, 320f, 448f, 448f)
    r(320f, 448f - g, 448f - g, 448f)
    r(64f, 320f, 64f + g, 448f)
    r(64f + g, 448f - g, 192f, 448f)
    r(64f, 64f, 64f + g, 192f)
    r(64f + g, 64f, 192f, 64f + g)
    // Cuadro de arriba a la derecha, con un hueco que deja ver el fondo.
    r(320f, 64f, 448f, 192f)
    r(362.667f, 106.667f, 405.333f, 149.333f, COLOR_LOGO)
}

@Composable
internal fun Logo(lado: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(lado)) { dibujarPunto(center, size.minDimension) }
}

private fun DrawScope.iconoCerrar(color: Color) {
    val d = 4.5.dp.toPx()
    val s = 1.6.dp.toPx()
    drawLine(color, center + Offset(-d, -d), center + Offset(d, d), s, StrokeCap.Round)
    drawLine(color, center + Offset(-d, d), center + Offset(d, -d), s, StrokeCap.Round)
}

private fun DrawScope.iconoAjustes(color: Color) {
    drawCircle(color, 3.dp.toPx(), center, style = Stroke(1.6.dp.toPx()))
    for (i in 0 until 8) {
        val a = i * 2 * PI / 8
        val d = Offset(cos(a).toFloat(), sin(a).toFloat())
        drawLine(color, center + d * 5.dp.toPx(), center + d * 7.2.dp.toPx(), 2.2.dp.toPx())
    }
    drawCircle(color, 5.4.dp.toPx(), center, style = Stroke(1.4.dp.toPx()))
}

// ---------------------------------------------------------------- controles

/** Botón de icono 32×32 con fondo si está activo. */
@Composable
internal fun BotonIcono(pal: Paleta, etiqueta: String, activo: Boolean, ajustes: Boolean, onClick: () -> Unit) {
    Canvas(
        Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(7.dp))
            .background(if (activo) pal.hundido else Color.Transparent)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = etiqueta },
    ) {
        val color = if (activo) pal.texto else pal.tenue
        if (ajustes) iconoAjustes(color) else iconoCerrar(color)
    }
}

/** Control segmentado. `lleno`: ocupa todo el ancho y reparte las opciones. */
@Composable
internal fun <T> Segmentado(
    pal: Paleta,
    actual: T?,
    opciones: List<Triple<T, String, Color?>>,
    lleno: Boolean,
    modifier: Modifier = Modifier,
    onCambio: (T) -> Unit,
) {
    val forma = RoundedCornerShape(9.dp)
    Row(
        modifier
            .then(if (lleno) Modifier.fillMaxWidth() else Modifier)
            .clip(forma)
            .background(pal.hundido)
            .border(1.dp, pal.borde, forma)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        for ((valor, texto, color) in opciones) {
            val elegido = actual == valor
            Box(
                Modifier
                    .then(if (lleno) Modifier.weight(1f) else Modifier)
                    .height(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (!elegido) Color.Transparent else if (pal.oscuro) pal.borde else pal.superficie)
                    .clickable(role = Role.Tab) { if (!elegido) onCambio(valor) }
                    .padding(horizontal = 11.dp),
                contentAlignment = Alignment.Center,
            ) {
                val tinta = if (elegido) color ?: pal.texto else pal.tenue
                BasicText(texto, style = estilo(tinta, 12.5.sp, negrita = elegido))
            }
        }
    }
}

/** Casilla: cuadro redondeado; marcada, fondo de acento con check blanco. */
@Composable
internal fun Casilla(pal: Paleta, valor: Boolean, texto: String, onCambio: (Boolean) -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .clickable(role = Role.Checkbox) { onCambio(!valor) }
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Canvas(Modifier.size(16.dp)) {
            val radio = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx())
            if (valor) {
                drawRoundRect(pal.acento, cornerRadius = radio)
                val p = Path().apply {
                    moveTo(4.2.dp.toPx(), 8.3.dp.toPx())
                    lineTo(7.dp.toPx(), 11.dp.toPx())
                    lineTo(12.dp.toPx(), 5.2.dp.toPx())
                }
                drawPath(p, Color.White, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
            } else {
                drawRoundRect(pal.superficie, cornerRadius = radio)
                val s = 1.5.dp.toPx()
                drawRoundRect(
                    pal.bordeFuerte,
                    topLeft = Offset(s / 2, s / 2),
                    size = Size(size.width - s, size.height - s),
                    cornerRadius = radio,
                    style = Stroke(s),
                )
            }
        }
        Spacer(Modifier.width(6.dp))
        BasicText(texto, style = estilo(pal.tenue, 12.sp))
    }
}

@Composable
internal fun Boton(pal: Paleta, texto: String, primario: Boolean, activo: Boolean = true, onClick: () -> Unit) {
    val forma = RoundedCornerShape(8.dp)
    Box(
        Modifier
            .alpha(if (activo) 1f else 0.45f)
            .heightIn(min = 34.dp)
            .clip(forma)
            .background(if (primario) pal.acento else pal.hundido)
            .border(1.dp, if (primario) pal.acento else pal.borde, forma)
            .clickable(enabled = activo, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(texto, style = estilo(if (primario) pal.acentoTexto else pal.texto, 12.5.sp, negrita = primario))
    }
}

/** Cuadro de texto: radio 10, fondo `superficie`, borde `borde`; con foco, borde `acento`. */
@Composable
internal fun CampoTexto(
    pal: Paleta,
    valor: String,
    pista: String,
    lineas: Int,
    modifier: Modifier = Modifier,
    onCambio: (String) -> Unit,
) {
    val interaccion = remember { MutableInteractionSource() }
    val foco by interaccion.collectIsFocusedAsState()
    val forma = RoundedCornerShape(10.dp)
    BasicTextField(
        value = valor,
        onValueChange = onCambio,
        modifier = modifier
            .fillMaxWidth()
            .clip(forma)
            .background(pal.superficie)
            .border(if (foco) 1.5.dp else 1.dp, if (foco) pal.acento else pal.borde, forma)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        textStyle = estilo(pal.texto),
        cursorBrush = SolidColor(pal.acento),
        singleLine = lineas == 1,
        minLines = lineas,
        interactionSource = interaccion,
        decorationBox = { campo ->
            Box {
                if (valor.isEmpty()) BasicText(pista, style = estilo(pal.tenue))
                campo()
            }
        },
    )
}

/** Tarjeta: radio 10, borde fino. */
internal fun Modifier.tarjeta(pal: Paleta, fill: Color): Modifier {
    val forma = RoundedCornerShape(10.dp)
    return fillMaxWidth().clip(forma).background(fill).border(1.dp, pal.borde, forma).padding(10.dp)
}
