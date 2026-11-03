// Versión vacía de spotfix-compose para release: misma API, no dibuja nada ni toca el disco.

package spotfix.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun SpotfixOverlay(modifier: Modifier = Modifier, seccion: String? = null, content: @Composable () -> Unit) {
    Box(modifier.fillMaxSize()) { content() }
}

@Suppress("UnusedReceiverParameter", "UNUSED_PARAMETER")
fun Modifier.spotfix(nombre: String): Modifier = this

@Suppress("UNUSED_PARAMETER")
@Composable
fun SpotfixSection(nombre: String) {
}
