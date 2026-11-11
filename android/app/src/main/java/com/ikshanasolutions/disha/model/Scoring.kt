package com.ikshanasolutions.disha.model

/**
 * Home score, matching the web quiz.
 *
 * Points are a percent of a perfect placement: best 100, good 75, neutral 50,
 * avoid 15. A finished remedy on a neutral placement counts as good (75). A
 * finished remedy on an avoid placement counts as neutral (50). An auspicious
 * placement stays at 100. Weights are the integer weights on each check.
 * Bands: Excellent 85+, Good 70–84, Fair 50–69, Needs care below 50.
 */
object Points {
    const val BEST = 100
    const val GOOD = 75
    const val NEUTRAL = 50
    const val AVOID = 15
}

enum class ScoreBand {
    EXCELLENT,
    GOOD,
    FAIR,
    CARE,
    ;

    fun title(content: ContentBundle, locale: AppLocale): String {
        val key = when (this) {
            EXCELLENT -> "scoreExcellent"
            GOOD -> "scoreGood"
            FAIR -> "scoreFair"
            CARE -> "scoreCare"
        }
        return content.t(key, locale)
    }
}

fun pointsFor(rating: String, remedyDone: Boolean): Int {
    return when (rating) {
        "auspicious" -> Points.BEST
        "neutral" -> if (remedyDone) Points.GOOD else Points.NEUTRAL
        else -> if (remedyDone) Points.NEUTRAL else Points.AVOID
    }
}

fun bandFor(score: Int): ScoreBand {
    return when {
        score >= 85 -> ScoreBand.EXCELLENT
        score >= 70 -> ScoreBand.GOOD
        score >= 50 -> ScoreBand.FAIR
        else -> ScoreBand.CARE
    }
}

data class StoredResult(
    val checkId: String,
    val heading: Double,
    val trueNorth: Boolean,
    val at: Long,
    val remedyHeading: Double?,
) {
    fun remedyDone(): Boolean = remedyHeading != null && remedyHeading == heading
}

fun upsertResult(list: List<StoredResult>, next: StoredResult): List<StoredResult> {
    return list.filter { it.checkId != next.checkId } + next
}

data class CategoryScore(
    val group: L10n,
    val score: Int?,
    val done: Int,
    val total: Int,
)

data class ScoreBoost(
    val checkId: String,
    val title: L10n,
    val group: L10n,
    val remedy: String,
    val gain: Int,
    val weight: Int,
)

data class HomeScore(
    val score: Int?,
    val band: ScoreBand?,
    val done: Int,
    val total: Int,
    val categories: List<CategoryScore>,
    val boosts: List<ScoreBoost>,
)

private data class ScoredRow(
    val check: VaastuCheck,
    val verdict: QuizVerdict,
    val points: Int,
    val remedyDone: Boolean,
)

fun homeScore(
    catalog: CheckCatalog,
    results: List<StoredResult>,
    locale: AppLocale,
    strings: StringTable,
): HomeScore {
    val byId = results.associateBy { it.checkId }
    val scored = catalog.checks.mapNotNull { check ->
        val saved = byId[check.id] ?: return@mapNotNull null
        val verdict = verdictForHeading(check, saved.heading, locale, strings)
        val remedyDone = saved.remedyDone() && verdict.remedies.isNotEmpty()
        ScoredRow(check, verdict, pointsFor(verdict.rating, remedyDone), remedyDone)
    }
    val score = weighted(scored.map { it.check.weight to it.points })
    val categories = checkGroups(catalog.checks).map { group ->
        val rows = scored.filter { it.check.group.en == group.group.en }
        CategoryScore(
            group = group.group,
            score = weighted(rows.map { it.check.weight to it.points }),
            done = rows.size,
            total = group.checks.size,
        )
    }
    return HomeScore(
        score = score,
        band = score?.let { bandFor(it) },
        done = scored.size,
        total = catalog.checks.size,
        categories = categories,
        boosts = biggestBoosts(scored),
    )
}

fun scoreDelta(before: Int?, after: Int?): Int? {
    return when {
        before != null && after != null -> (after - before).takeIf { it != 0 }
        before == null && after != null -> after
        else -> null
    }
}

private fun weighted(rows: List<Pair<Int, Int>>): Int? {
    val totalWeight = rows.sumOf { it.first }
    if (totalWeight <= 0) return null
    val earned = rows.sumOf { it.first.toLong() * it.second }
    return kotlin.math.round(earned.toDouble() / totalWeight).toInt()
}

private fun biggestBoosts(scored: List<ScoredRow>): List<ScoreBoost> {
    val current = weighted(scored.map { it.check.weight to it.points }) ?: return emptyList()
    val lifts = scored.mapNotNull { item ->
        if (item.remedyDone || item.verdict.remedies.isEmpty()) return@mapNotNull null
        val lifted = pointsFor(item.verdict.rating, true)
        if (lifted <= item.points) return@mapNotNull null
        val next = weighted(
            scored.map { row ->
                val points = if (row.check.id == item.check.id) lifted else row.points
                row.check.weight to points
            },
        ) ?: current
        val gain = next - current
        if (gain <= 0) return@mapNotNull null
        ScoreBoost(
            checkId = item.check.id,
            title = item.check.title,
            group = item.check.group,
            remedy = item.verdict.remedies.firstOrNull().orEmpty(),
            gain = gain,
            weight = item.check.weight,
        )
    }
    return lifts.sortedWith(compareByDescending<ScoreBoost> { it.gain }.thenByDescending { it.weight }).take(3)
}
