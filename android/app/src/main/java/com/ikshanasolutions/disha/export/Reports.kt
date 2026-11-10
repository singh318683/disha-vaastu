package com.ikshanasolutions.disha.export

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import com.ikshanasolutions.disha.R
import com.ikshanasolutions.disha.model.AppLocale
import com.ikshanasolutions.disha.model.ContentBundle
import com.ikshanasolutions.disha.model.HomeScore
import com.ikshanasolutions.disha.model.StoredResult
import com.ikshanasolutions.disha.model.verdictForHeading
import java.io.File
import java.io.FileOutputStream

private const val NAVY = 0xFF0C1430.toInt()
private const val GOLD = 0xFFD4B15A.toInt()
private const val CREAM = 0xFFF4EFE2.toInt()
private const val MUTED = 0xFFB8B09E.toInt()

fun writeShareCard(
    context: Context,
    content: ContentBundle,
    results: List<StoredResult>,
    score: HomeScore,
    locale: AppLocale,
    preview: Boolean,
): File {
    val width = 1080
    val height = 1440
    val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(NAVY)
    val gold = paint(context, 28f, GOLD, bold = true)
    val cream = paint(context, 64f, CREAM, bold = true, hindi = locale == AppLocale.HI)
    val number = paint(context, 140f, GOLD, bold = true)
    val body = paint(context, 28f, CREAM, hindi = locale == AppLocale.HI)
    val quiet = paint(context, 24f, MUTED, hindi = locale == AppLocale.HI)
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = GOLD
        style = Paint.Style.STROKE
        strokeWidth = 3f
    }
    canvas.drawRect(48f, 48f, width - 48f, height - 48f, border)
    var y = 140f
    y = drawCentered(canvas, "DISHA", gold, y, width)
    y += 36f
    y = drawCentered(canvas, content.t("homeScore", locale), cream, y, width)
    y += 20f
    y = drawCentered(canvas, score.score?.toString() ?: "—", number, y, width)
    y += 16f
    score.band?.let { band ->
        y = drawCentered(canvas, band.title(content, locale), cream.applySize(44f), y, width)
    }
    y += 16f
    val coverage = content.fill(
        "basedOn",
        locale,
        mapOf("done" to score.done.toString(), "total" to score.total.toString()),
    )
    y = drawCentered(canvas, coverage, quiet, y, width)
    y += 48f
    val shown = results.take(8)
    for (result in shown) {
        val check = content.check(result.checkId) ?: continue
        val verdict = verdictForHeading(check, result.heading, locale, content.strings)
        val line = "${check.title.text(locale)}  ·  ${verdict.placementLine}"
        y = drawLeft(canvas, line, body, y, 100f, width - 160f)
        y += 16f
        if (y > height - 180f) break
    }
    val mark = if (preview) "Disha  ·  ${content.t("scorePreview", locale)}" else "Disha"
    drawCentered(canvas, mark, gold.applySize(24f), height - 150f, width)
    drawCentered(canvas, content.catalog.framing.text(locale), quiet.applySize(22f), height - 100f, width)
    val file = File(context.cacheDir, "disha-card.png")
    FileOutputStream(file).use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    bitmap.recycle()
    return file
}

fun writePdf(
    context: Context,
    content: ContentBundle,
    results: List<StoredResult>,
    score: HomeScore,
): File {
    val document = PdfDocument()
    val width = 595
    val height = 842
    var pageNumber = 1
    var page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create())
    var canvas = page.canvas
    canvas.drawColor(NAVY)
    var y = 56f
    val gold = paint(context, 16f, GOLD, bold = true, hindi = true)
    val cream = paint(context, 13f, CREAM, hindi = true)
    val big = paint(context, 36f, GOLD, bold = true)
    fun newPage() {
        document.finishPage(page)
        pageNumber += 1
        page = document.startPage(PdfDocument.PageInfo.Builder(width, height, pageNumber).create())
        canvas = page.canvas
        canvas.drawColor(NAVY)
        y = 56f
    }
    fun ensure(room: Float) {
        if (y > height - 40 - room) newPage()
    }
    y = drawLeft(canvas, "Disha  ·  दिशा", gold, y, 40f, 515f)
    y += 8f
    y = drawLeft(canvas, "${score.score?.toString() ?: "—"} / 100", big, y, 40f, 515f)
    y += 6f
    score.band?.let { band ->
        val both = "${band.title(content, AppLocale.EN)}  ·  ${band.title(content, AppLocale.HI)}"
        y = drawLeft(canvas, both, cream, y, 40f, 515f)
    }
    val enCoverage = content.fill("basedOn", AppLocale.EN, mapOf("done" to "${score.done}", "total" to "${score.total}"))
    val hiCoverage = content.fill("basedOn", AppLocale.HI, mapOf("done" to "${score.done}", "total" to "${score.total}"))
    y = drawLeft(canvas, enCoverage, cream, y, 40f, 515f)
    y = drawLeft(canvas, hiCoverage, cream, y, 40f, 515f)
    y += 14f
    y = drawLeft(canvas, "${content.t("byArea", AppLocale.EN)}  ·  ${content.t("byArea", AppLocale.HI)}", gold, y, 40f, 515f)
    for (category in score.categories) {
        ensure(24f)
        val value = category.score?.toString() ?: "—"
        val line = "${category.group.en} / ${category.group.hi}    $value    ${category.done}/${category.total}"
        y = drawLeft(canvas, line, cream, y, 40f, 515f)
        y += 4f
    }
    if (score.boosts.isNotEmpty()) {
        y += 10f
        ensure(40f)
        y = drawLeft(canvas, "${content.t("biggestBoosts", AppLocale.EN)}  ·  ${content.t("biggestBoosts", AppLocale.HI)}", gold, y, 40f, 515f)
        for (boost in score.boosts) {
            ensure(22f)
            y = drawLeft(canvas, "+${boost.gain}   ${boost.title.en} / ${boost.title.hi}", cream, y, 40f, 515f)
            y += 4f
        }
    }
    y += 12f
    ensure(36f)
    y = drawLeft(canvas, "${content.t("report", AppLocale.EN)}  ·  ${content.t("report", AppLocale.HI)}", gold, y, 40f, 515f)
    val ordered = content.catalog.checks.mapNotNull { check ->
        val saved = results.firstOrNull { it.checkId == check.id } ?: return@mapNotNull null
        check to saved
    }
    for ((check, saved) in ordered) {
        ensure(70f)
        val english = verdictForHeading(check, saved.heading, AppLocale.EN, content.strings)
        val hindi = verdictForHeading(check, saved.heading, AppLocale.HI, content.strings)
        y = drawLeft(canvas, "${check.title.en}  ·  ${check.title.hi}", gold.applySize(13f), y, 40f, 515f)
        y = drawLeft(canvas, "${english.placementLine}  ·  ${content.t(english.rating, AppLocale.EN)}", cream, y, 40f, 515f)
        y = drawLeft(canvas, "${hindi.placementLine}  ·  ${content.t(hindi.rating, AppLocale.HI)}", cream, y, 40f, 515f)
        y += 8f
    }
    ensure(60f)
    y += 8f
    y = drawLeft(canvas, content.catalog.framing.en, cream.applySize(11f), y, 40f, 515f)
    drawLeft(canvas, content.catalog.framing.hi, cream.applySize(11f), y, 40f, 515f)
    document.finishPage(page)
    val file = File(context.cacheDir, "disha-report.pdf")
    FileOutputStream(file).use { document.writeTo(it) }
    document.close()
    return file
}

private fun paint(
    context: Context,
    size: Float,
    color: Int,
    bold: Boolean = false,
    hindi: Boolean = false,
): Paint {
    val font = if (hindi || bold && hindi) {
        context.resources.getFont(if (bold) R.font.noto_sans_devanagari_semibold else R.font.noto_sans_devanagari_regular)
    } else if (bold) {
        context.resources.getFont(R.font.cormorant_garamond_semibold)
    } else {
        context.resources.getFont(R.font.cormorant_garamond_medium)
    }
    return Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        textSize = size
        typeface = font
    }
}

private fun Paint.applySize(size: Float): Paint = Paint(this).apply { textSize = size }

private fun drawCentered(canvas: Canvas, text: String, paint: Paint, top: Float, width: Int): Float {
    val baseline = top - paint.fontMetrics.ascent
    canvas.drawText(text, (width - paint.measureText(text)) / 2f, baseline, paint)
    return baseline + paint.fontMetrics.descent + 4f
}

private fun drawLeft(canvas: Canvas, text: String, paint: Paint, top: Float, x: Float, maxWidth: Float): Float {
    var y = top - paint.fontMetrics.ascent
    var rest = text
    while (rest.isNotEmpty()) {
        val count = paint.breakText(rest, true, maxWidth, null).coerceAtLeast(1)
        val line = rest.substring(0, count).trimEnd()
        canvas.drawText(line, x, y, paint)
        y += paint.fontSpacing
        rest = rest.substring(count).trimStart()
    }
    return y + 2f
}
