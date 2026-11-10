package com.ikshanasolutions.disha.model

data class LibraryAccess(val premium: Boolean, val homeReport: Boolean) {
    val full: Boolean get() = premium || homeReport

    fun isUnlocked(check: VaastuCheck): Boolean = full || check.tier == "free"

    fun <T> visibleRemedies(remedies: List<T>): List<T> {
        if (full || remedies.size <= 1) return remedies
        return remedies.take(1)
    }
}

enum class ScoreKind { PREVIEW, FULL }

data class PresentedScore(val score: HomeScore, val kind: ScoreKind)

fun presentedScore(
    content: ContentBundle,
    results: List<StoredResult>,
    access: LibraryAccess,
    locale: AppLocale,
): PresentedScore {
    val scoped = if (access.full) {
        results
    } else {
        val free = content.catalog.checks.filter { it.tier == "free" }.map { it.id }.toSet()
        results.filter { it.checkId in free }
    }
    return PresentedScore(
        score = homeScore(content.catalog, scoped, locale, content.strings),
        kind = if (access.full) ScoreKind.FULL else ScoreKind.PREVIEW,
    )
}
