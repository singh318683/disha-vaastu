package com.ikshanasolutions.disha.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.ikshanasolutions.disha.R
import com.ikshanasolutions.disha.model.AppLocale

val Field = Color(0xFF0C1430)
val Navy = Color(0xFF101A3A)
val CardNavy = Color(0xFF1A2546)
val Gold = Color(0xFFD4B15A)
val GoldBright = Color(0xFFE8CF85)
val Cream = Color(0xFFF4EFE2)
val Muted = Color(0xFFB8B09E)
val Ink = Color(0xFF1A1408)
val Good = Color(0xFF7DC794)
val Avoid = Color(0xFFDB8C7A)

data class DishaFonts(val display: FontFamily, val hindi: FontFamily)

val LocalFonts = staticCompositionLocalOf {
    DishaFonts(FontFamily.Serif, FontFamily.SansSerif)
}
val LocalLocale = staticCompositionLocalOf { AppLocale.EN }

private val scheme = darkColorScheme(
    primary = Gold,
    onPrimary = Ink,
    secondary = GoldBright,
    background = Field,
    surface = Navy,
    onBackground = Cream,
    onSurface = Cream,
)

@Composable
fun DishaTheme(content: @Composable () -> Unit) {
    val fonts = DishaFonts(
        display = FontFamily(
            Font(R.font.cormorant_garamond_medium, FontWeight.Medium),
            Font(R.font.cormorant_garamond_semibold, FontWeight.SemiBold),
        ),
        hindi = FontFamily(
            Font(R.font.noto_sans_devanagari_regular, FontWeight.Normal),
            Font(R.font.noto_sans_devanagari_semibold, FontWeight.SemiBold),
        ),
    )
    CompositionLocalProvider(LocalFonts provides fonts) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

@Composable
fun displayStyle(size: TextUnit, color: Color = Cream): TextStyle {
    val locale = LocalLocale.current
    val fonts = LocalFonts.current
    return TextStyle(
        fontFamily = if (locale == AppLocale.HI) fonts.hindi else fonts.display,
        fontWeight = FontWeight.SemiBold,
        fontSize = size,
        color = color,
        lineHeight = size * 1.05f,
    )
}

@Composable
fun bodyStyle(size: TextUnit = 15.sp, color: Color = Cream, bold: Boolean = false): TextStyle {
    val locale = LocalLocale.current
    val fonts = LocalFonts.current
    return TextStyle(
        fontFamily = if (locale == AppLocale.HI) fonts.hindi else FontFamily.SansSerif,
        fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
        fontSize = size,
        color = color,
        lineHeight = size * 1.25f,
    )
}
