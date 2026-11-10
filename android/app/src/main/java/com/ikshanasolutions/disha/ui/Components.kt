package com.ikshanasolutions.disha.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ikshanasolutions.disha.R
import com.ikshanasolutions.disha.model.AppLocale
import com.ikshanasolutions.disha.model.headingFromDialPoint
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@Composable
fun RoyalBackdrop(modifier: Modifier = Modifier) {
    Canvas(modifier.fillMaxSize()) {
        drawRect(Field)
        val center = Offset(size.width / 2f, size.height * 0.42f)
        for (ring in listOf(90f, 150f, 220f)) {
            drawCircle(color = Gold.copy(alpha = 0.07f), radius = ring, center = center, style = Stroke(1.5f))
        }
        var state = 0xD15A7A11L
        repeat(70) {
            state = state * 1664525L + 1013904223L
            val unit = ((state ushr 16) and 0xFFFF).toFloat() / 65535f
            val x = ((state ushr 1) and 0xFFFF).toFloat() / 65535f * size.width
            val y = unit * size.height
            drawCircle(Gold.copy(alpha = 0.12f + (unit * 0.35f)), radius = 0.6f + unit * 1.4f, center = Offset(x, y))
        }
    }
}

@Composable
fun Wordmark() {
    Text("Disha", style = displayStyle(28.sp, Gold))
}

@Composable
fun LanguageToggle(locale: AppLocale, onChange: (AppLocale) -> Unit) {
    val next = if (locale == AppLocale.EN) AppLocale.HI else AppLocale.EN
    val label = if (locale == AppLocale.EN) "हिन्दी" else "English"
    TextButton(
        onClick = { onChange(next) },
        modifier = Modifier.semantics { contentDescription = "language-toggle" },
    ) {
        Text(label, style = bodyStyle(16.sp, Gold, bold = true))
    }
}

@Composable
fun GoldButton(text: String, enabled: Boolean = true, description: String? = null, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Ink, disabledContainerColor = CardNavy, disabledContentColor = Muted),
    ) {
        Text(text, style = displayStyle(18.sp, if (enabled) Ink else Muted))
    }
}

@Composable
fun OutlineButton(text: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = CardNavy, contentColor = Cream),
    ) {
        Text(text, style = bodyStyle(16.sp, Cream, bold = true))
    }
}

@Composable
fun ScoreRing(score: Int?, diameter: Dp) {
    val number = score?.toString()
    Box(
        Modifier
            .size(diameter)
            .semantics { contentDescription = number ?: "–" },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = (size.minDimension * 0.08f).coerceIn(3f, 8f)
            drawArc(
                color = Gold.copy(alpha = 0.25f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = stroke),
            )
            if (score != null) {
                drawArc(
                    color = Gold,
                    startAngle = -90f,
                    sweepAngle = (score.coerceIn(0, 100) / 100f) * 360f,
                    useCenter = false,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
            if (score == null) {
                val width = size.minDimension * 0.34f
                val height = (size.minDimension * 0.07f).coerceAtLeast(2.5f)
                drawRoundRect(
                    color = Gold,
                    topLeft = Offset((size.width - width) / 2f, (size.height - height) / 2f),
                    size = Size(width, height),
                    cornerRadius = CornerRadius(height / 2f),
                )
            }
        }
        if (number != null) {
            val font = diameter.value * 0.32f
            Text(
                number,
                style = displayStyle(font.sp, Gold).copy(
                    lineHeight = font.sp,
                    textAlign = TextAlign.Center,
                    platformStyle = PlatformTextStyle(includeFontPadding = false),
                ),
            )
        }
    }
}

@Composable
fun MiniCompass(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val radius = size.minDimension / 2f
        val center = Offset(size.width / 2f, size.height / 2f)
        drawCircle(Gold.copy(alpha = 0.16f), radius = radius)
        drawCircle(Gold, radius = radius * 0.92f, center = center, style = Stroke(width = radius * 0.08f))
        drawLine(
            Gold,
            Offset(center.x, center.y - radius * 0.62f),
            Offset(center.x, center.y + radius * 0.28f),
            strokeWidth = radius * 0.12f,
            cap = StrokeCap.Round,
        )
        drawCircle(GoldBright, radius = radius * 0.14f, center = center)
    }
}

@Composable
fun LockMark(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val bodyTop = size.height * 0.42f
        drawRoundRect(
            color = Gold,
            topLeft = Offset(size.width * 0.16f, bodyTop),
            size = Size(size.width * 0.68f, size.height * 0.5f),
            cornerRadius = CornerRadius(size.minDimension * 0.12f),
        )
        drawArc(
            color = Gold,
            startAngle = 200f,
            sweepAngle = 140f,
            useCenter = false,
            topLeft = Offset(size.width * 0.26f, size.height * 0.06f),
            size = Size(size.width * 0.48f, size.height * 0.52f),
            style = Stroke(width = size.minDimension * 0.1f, cap = StrokeCap.Round),
        )
    }
}

@Composable
fun CompassDial(
    heading: Double,
    interactive: Boolean,
    onHeading: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    val typeface = LocalContext.current.resources.getFont(R.font.cormorant_garamond_semibold)
    Canvas(
        modifier
            .fillMaxSize()
            .pointerInput(interactive) {
                if (!interactive) return@pointerInput
                detectDragGestures(
                    onDragStart = { offset ->
                        val dx = offset.x - size.width / 2f
                        val dy = offset.y - size.height / 2f
                        onHeading(headingFromDialPoint(dx.toDouble(), dy.toDouble()))
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        val dx = change.position.x - size.width / 2f
                        val dy = change.position.y - size.height / 2f
                        onHeading(headingFromDialPoint(dx.toDouble(), dy.toDouble()))
                    },
                )
            },
    ) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = min(size.width, size.height) / 2f - 6f
        drawCircle(Navy, radius = radius, center = center)
        drawCircle(Gold.copy(alpha = 0.9f), radius = radius, center = center, style = Stroke(3f))
        rotate(-heading.toFloat(), center) {
            for (index in 0 until 32) {
                val angle = Math.toRadians(index * 11.25 - 90.0)
                val major = index % 8 == 0
                val inner = radius * if (major) 0.72f else 0.82f
                val outer = radius * 0.92f
                val cosA = cos(angle).toFloat()
                val sinA = sin(angle).toFloat()
                drawLine(
                    color = if (major) GoldBright else Gold.copy(alpha = 0.45f),
                    start = Offset(center.x + cosA * inner, center.y + sinA * inner),
                    end = Offset(center.x + cosA * outer, center.y + sinA * outer),
                    strokeWidth = if (major) 4f else 2f,
                    cap = StrokeCap.Round,
                )
            }
            drawIntoCanvas { canvas ->
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    this.typeface = typeface
                    textSize = radius * 0.16f
                    textAlign = android.graphics.Paint.Align.CENTER
                }
                val letters = listOf("N" to -90.0, "E" to 0.0, "S" to 90.0, "W" to 180.0)
                for ((letter, degrees) in letters) {
                    val rad = Math.toRadians(degrees)
                    val x = center.x + cos(rad).toFloat() * radius * 0.56f
                    val y = center.y + sin(rad).toFloat() * radius * 0.56f
                    paint.color = if (letter == "N") 0xFFE8CF85.toInt() else 0xFFF4EFE2.toInt()
                    canvas.nativeCanvas.drawText(letter, x, y + paint.textSize / 3f, paint)
                }
            }
        }
        val tip = Path().apply {
            moveTo(center.x, center.y - radius + 8f)
            lineTo(center.x - 9f, center.y - radius + 30f)
            lineTo(center.x + 9f, center.y - radius + 30f)
            close()
        }
        drawPath(tip, Gold)
        drawCircle(Gold, radius = 5f, center = center)
    }
}

@Composable
fun RoyalCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .background(CardNavy, RoundedCornerShape(18.dp))
            .padding(16.dp),
    ) {
        content()
    }
}

@Composable
fun ScreenBox(description: String, content: @Composable () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .semantics { contentDescription = description },
    ) {
        content()
    }
}
