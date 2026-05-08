package com.perpustakaan.nusantara.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// Library-themed colors — warm teal + amber accent
private val LibraryTeal = Color(0xFF0D7377)
private val LibraryTealDark = Color(0xFF14919B)
private val LibraryAmber = Color(0xFFF59E0B)
private val LibraryAmberDark = Color(0xFFFBBF24)

private val LightColorScheme = lightColorScheme(
    primary = LibraryTeal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFB2DFDB),
    onPrimaryContainer = Color(0xFF00201E),
    secondary = LibraryAmber,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFFF3E0),
    onSecondaryContainer = Color(0xFF3E2723),
    tertiary = Color(0xFF6D4C41),
    background = Color(0xFFFAFAFA),
    surface = Color.White,
    surfaceVariant = Color(0xFFF5F5F5),
    error = Color(0xFFD32F2F),
    onError = Color.White,
    outline = Color(0xFFBDBDBD)
)

private val DarkColorScheme = darkColorScheme(
    primary = LibraryTealDark,
    onPrimary = Color(0xFF003735),
    primaryContainer = Color(0xFF004F4D),
    onPrimaryContainer = Color(0xFFB2DFDB),
    secondary = LibraryAmberDark,
    onSecondary = Color(0xFF3E2723),
    secondaryContainer = Color(0xFF5D4037),
    onSecondaryContainer = Color(0xFFFFF3E0),
    tertiary = Color(0xFFBCAAA4),
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E),
    surfaceVariant = Color(0xFF2C2C2C),
    error = Color(0xFFEF5350),
    onError = Color.White,
    outline = Color(0xFF616161)
)

@Composable
fun PerpustakaanTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
