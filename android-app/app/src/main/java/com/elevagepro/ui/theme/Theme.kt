package com.elevagepro.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF8E145B),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD8E9),
    onPrimaryContainer = Color(0xFF3B0024),
    secondary = Color(0xFF74565F),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFD8E0),
    onSecondaryContainer = Color(0xFF2B151C),
    background = Color(0xFFFFFBFF),
    onBackground = Color(0xFF1F1A1C),
    surface = Color(0xFFFFFBFF),
    onSurface = Color(0xFF1F1A1C)
)

@Composable
fun ElevageProTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        content = content
    )
}
