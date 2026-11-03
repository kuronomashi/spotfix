// Demo de spotfix-compose: la versión debug muestra el botón; la release no lo incluye.

package spotfix.demo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import spotfix.compose.SpotfixOverlay
import spotfix.compose.spotfix

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { Demo() }
    }
}

private val texto = TextStyle(color = Color(0xFF222222), fontSize = 16.sp)

@Composable
private fun Demo() {
    var pestana by remember { mutableIntStateOf(0) }
    val seccion = listOf("Inicio", "Ajustes")[pestana]

    SpotfixOverlay(seccion = seccion) {
        Column(Modifier.fillMaxSize().background(Color.White).safeDrawingPadding()) {
            Row(
                Modifier.fillMaxWidth().background(Color(0xFFEFEFEF)).padding(8.dp).spotfix("Menú"),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf("Inicio", "Ajustes").forEachIndexed { i, nombre ->
                    Pestana(nombre, elegida = i == pestana) { pestana = i }
                }
            }
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.spotfix("Cabecera")) {
                    BasicText(seccion, style = texto.copy(fontSize = 24.sp, fontWeight = FontWeight.Bold))
                    BasicText("Pantalla de ejemplo para probar spotfix.", style = texto)
                }
                if (pestana == 0) Saludo() else Opciones()
            }
        }
    }
}

@Composable
private fun Pestana(nombre: String, elegida: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .background(if (elegida) Color(0xFFDDDDDD) else Color.Transparent, RoundedCornerShape(6.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) { BasicText(nombre, style = texto) }
}

@Composable
private fun Saludo() {
    var nombre by remember { mutableStateOf("") }
    var veces by remember { mutableIntStateOf(0) }
    Column(Modifier.spotfix("Formulario de saludo"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BasicText("Nombre:", style = texto)
        BasicTextField(
            nombre,
            { nombre = it },
            Modifier.fillMaxWidth().border(1.dp, Color.Gray, RoundedCornerShape(6.dp)).padding(10.dp),
            textStyle = texto,
            singleLine = true,
        )
        Box(
            Modifier
                .spotfix("Botón Saludar")
                .background(Color(0xFF3366CC), RoundedCornerShape(6.dp))
                .clickable { veces++ }
                .padding(horizontal = 16.dp, vertical = 10.dp),
        ) { BasicText("Saludar", style = texto.copy(color = Color.White)) }
        BasicText("Hola $nombre ($veces veces)", style = texto)
    }
}

@Composable
private fun Opciones() {
    var oscuro by remember { mutableStateOf(false) }
    Column(Modifier.spotfix("Opciones"), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BasicText((if (oscuro) "☑" else "☐") + " Modo oscuro", Modifier.clickable { oscuro = !oscuro }.padding(vertical = 6.dp), style = texto)
        BasicText("Más ajustes aquí…", style = texto)
        Box(Modifier.height(1.dp))
    }
}
